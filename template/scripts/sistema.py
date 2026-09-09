#!/usr/bin/env python3
"""Orçamento de sistema visual — conta o que faz a loja ter "cara de IA".

POR QUE ISTO EXISTE
O `escala.py` irmão mede o TETO da tipografia (tipo grande demais). Este mede a
QUANTIDADE — que é outro defeito, com outra causa e outro sintoma. O levantamento
de 334 ajustes em três lojas do CLI achou a causa mecânica do diagnóstico que o
Bruno deu duas vezes ("ta tudo com mt cara de AI... qual design system vc ta
seguindo?"):

    escala tipográfica    76 tamanhos distintos     (alvo ~6)
    raios                 10 valores                (alvo: derivados de um token)
    cor fora de token     14+ hex soltos            (alvo: zero)

Nenhum desses três é cobrado em lugar nenhum da esteira hoje. E nenhum se conserta
com prompt: o gerador acrescenta um tamanho novo a cada seção porque cada acréscimo
é individualmente defensável. Orçamento obriga a gastar; instrução deixa acumular.

O QUE CONTA COMO DEFINIÇÃO DE TOKEN (e por isso não é violação)
O bloco `:root` / `@theme` do globals.css é onde as cores DEVEM viver — hex ali é a
definição, não o vazamento. Violação é hex escrito em componente ou em regra CSS
fora do bloco de tokens.

USO
    sistema.py <dir-do-projeto> [--tipos 8] [--raios 5] [--hex 0] [--secoes 8]

CÓDIGOS DE SAÍDA
    0  dentro do orçamento
    1  estourou algum teto
    2  O GATE NÃO RODOU (caminho errado, ou varreu zero arquivo)

O 2 existe pela mesma razão do 2 do escala.py: gate que varre o vazio e diz "limpo"
aprova sem ter olhado.
"""
import re
import sys
import pathlib
from collections import Counter

EXT_CODIGO = {".tsx", ".ts", ".jsx", ".js"}
EXT_CSS = {".css"}
IGNORAR = {"node_modules", ".next", ".git", "shots", "reviews", "public", "marca"}

# ── tipografia ────────────────────────────────────────────────────────────────
# Tailwind arbitrário `text-[13px]` / `text-[clamp(...)]` e utilitários nomeados.
RE_TEXT_ARB = re.compile(r"text-\[([^\]]+)\]")
RE_TEXT_NOM = re.compile(r"\btext-(xs|sm|base|lg|xl|[2-9]xl)\b")
RE_CSS_FS = re.compile(r"font-size:\s*([^;}]+)")

# ── raios ─────────────────────────────────────────────────────────────────────
RE_ROUND_ARB = re.compile(r"rounded(?:-[a-z]{1,2})?-\[([^\]]+)\]")
RE_ROUND_NOM = re.compile(r"\brounded(?:-[trbl]{1,2})?-(none|sm|md|lg|xl|[2-3]xl|full)\b")
RE_CSS_RADIUS = re.compile(r"border-radius:\s*([^;}]+)")

# ── cor ───────────────────────────────────────────────────────────────────────
# ── largura de container ──────────────────────────────────────────────────────
# "A margem esta errada" quase nunca e margem: sao larguras de container divergentes.
# Na Punch o scaffold entregou cabecalho 1400, rodape 1180 e <main> 1240, e o cliente
# reclamou em TRES rodadas diferentes porque cada tela expunha uma combinacao.
# So contam as larguras de PAGINA (>=1000px): abaixo disso sao medidas de leitura e
# larguras de componente, que legitimamente variam.
RE_CONTAINER = re.compile(r"max-w-\[(\d{4,})px\]")
PISO_CONTAINER = 1000

RE_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RE_FALLBACK = re.compile(r"var\(\s*(--[A-Za-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)")


def arquivos(raiz, exts):
    for p in raiz.rglob("*"):
        if p.suffix.lower() not in exts:
            continue
        if any(parte in IGNORAR for parte in p.parts):
            continue
        yield p


def normalizar(valor):
    """`13px`, ` 13px `, `13PX` são o mesmo tamanho. clamp() conta como um valor próprio."""
    return re.sub(r"\s+", "", valor).lower()


def bloco_de_tokens(texto):
    """Devolve os intervalos (ini, fim) de `:root{...}` e `@theme{...}` — onde hex é lei."""
    faixas = []
    for m in re.finditer(r"(:root[^{]*|@theme[^{]*)\{", texto):
        i = m.end() - 1
        prof = 0
        for j in range(i, len(texto)):
            if texto[j] == "{":
                prof += 1
            elif texto[j] == "}":
                prof -= 1
                if prof == 0:
                    faixas.append((m.start(), j))
                    break
    return faixas


def medir(raiz):
    tipos, raios, hexes, fallbacks = Counter(), Counter(), Counter(), {}
    containers = {}
    onde_hex = {}
    vistos = 0

    for p in arquivos(raiz, EXT_CODIGO | EXT_CSS):
        vistos += 1
        try:
            t = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for m in RE_TEXT_ARB.finditer(t):
            v = normalizar(m.group(1))
            if "px" in v or "rem" in v or "clamp" in v or "vw" in v:
                tipos[v] += 1
        for m in RE_TEXT_NOM.finditer(t):
            tipos["tw:" + m.group(1)] += 1
        for m in RE_CSS_FS.finditer(t):
            tipos[normalizar(m.group(1))] += 1

        for m in RE_ROUND_ARB.finditer(t):
            raios[normalizar(m.group(1))] += 1
        for m in RE_ROUND_NOM.finditer(t):
            raios["tw:" + m.group(1)] += 1
        for m in RE_CSS_RADIUS.finditer(t):
            raios[normalizar(m.group(1))] += 1

        for m in RE_CONTAINER.finditer(t):
            larg = int(m.group(1))
            if larg >= PISO_CONTAINER:
                containers.setdefault(larg, set()).add(str(p.relative_to(raiz)))

        faixas = bloco_de_tokens(t) if p.suffix.lower() in EXT_CSS else []
        # intervalos ocupados por fallback de var(): contam separado
        faixas_fb = []
        for m in RE_FALLBACK.finditer(t):
            faixas_fb.append((m.start(), m.end()))
            fallbacks.setdefault(m.group(1), Counter())[m.group(2).lower()] += 1
        for m in RE_HEX.finditer(t):
            if any(ini <= m.start() <= fim for ini, fim in faixas):
                continue  # definição de token, não vazamento
            if any(ini <= m.start() <= fim for ini, fim in faixas_fb):
                continue  # fallback de var(), medido à parte
            h = m.group(0).lower()
            hexes[h] += 1
            onde_hex.setdefault(h, []).append(
                f"{p.relative_to(raiz)}:{t.count(chr(10), 0, m.start()) + 1}"
            )

    return vistos, tipos, raios, hexes, onde_hex, fallbacks, containers


def contar_secoes(raiz):
    """Momentos da home, lidos da receita. Devolve None quando não há receita."""
    for nome in ("components/home/home-recipe.ts", "components/home/home-recipe.tsx"):
        p = raiz / nome
        if p.exists():
            t = p.read_text(encoding="utf-8", errors="ignore")
            return len(re.findall(r"\bsection:\s*[\"']", t))
    return None


def linha(rotulo, achado, teto, amostra=""):
    marca = "ok " if achado <= teto else "ESTOUROU"
    print(f"{marca:9}{rotulo:<26}{achado:>4}  (teto {teto}){amostra}")
    return achado <= teto


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    raiz = pathlib.Path(args[0]).resolve()
    tetos = {"tipos": 8, "raios": 5, "hex": 0, "secoes": 8}
    for chave in tetos:
        flag = f"--{chave}"
        if flag in args:
            tetos[chave] = int(args[args.index(flag) + 1])

    if not raiz.is_dir():
        print(f"ERRO: {raiz} nao e um diretorio — o gate NAO RODOU", file=sys.stderr)
        sys.exit(2)

    vistos, tipos, raios, hexes, onde_hex, fallbacks, containers = medir(raiz)
    if vistos == 0:
        print(f"ERRO: nenhum arquivo varrido em {raiz} — o gate NAO RODOU", file=sys.stderr)
        sys.exit(2)

    print(f"Orcamento de sistema · {vistos} arquivos varridos em {raiz.name}\n")
    ok = True
    ok &= linha("tamanhos de tipo", len(tipos), tetos["tipos"])
    ok &= linha("raios", len(raios), tetos["raios"])
    ok &= linha("hex fora de token", len(hexes), tetos["hex"])

    secoes = contar_secoes(raiz)
    if secoes is not None:
        ok &= linha("momentos da home", secoes, tetos["secoes"])
    else:
        print(f"{'—':9}{'momentos da home':<26}   ?  (sem receita encontrada)")

    if len(tipos) > tetos["tipos"]:
        print("\n  tipos mais usados:", ", ".join(f"{v}×{n}" for v, n in tipos.most_common(6)))
        print("  os", len(tipos) - 6, "restantes sao a gordura:", ", ".join(list(tipos)[6:18]))
    if len(raios) > tetos["raios"]:
        print("\n  raios:", ", ".join(f"{v}×{n}" for v, n in raios.most_common(12)))
    if hexes:
        print("\n  hex fora de token:")
        for h, n in hexes.most_common(12):
            print(f"    {h}  {n}×  {onde_hex[h][0]}")

    if containers:
        ok &= linha("larguras de container", len(containers), 1)
        if len(containers) > 1:
            print("\n  cada largura e um alinhamento diferente na mesma pagina:")
            for larg in sorted(containers, reverse=True):
                arqs = sorted(containers[larg])
                print(f"    {larg}px  em {len(arqs)}: " + ", ".join(arqs[:3]))

    mentirosos = {tok: c for tok, c in fallbacks.items() if len(c) > 1}
    if mentirosos:
        print("\n  fallback de var() com mais de um hex — pelo menos um mente:")
        for tok, c in list(mentirosos.items())[:8]:
            print(f"    {tok}: " + ", ".join(f"{h} ({n}×)" for h, n in c.most_common()))
        ok = False

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
