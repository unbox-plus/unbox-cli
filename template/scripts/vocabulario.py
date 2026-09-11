#!/usr/bin/env python3
"""Cobertura do vocabulário gráfico — a medida do degrau 1 da escada.

POR QUE ISTO EXISTE
"Cara de AI" não é falta de capricho: é variedade sem sistema. O olho lê repetição
como intenção e variedade como acidente. Em TRÊS marcas diferentes, a virada de "podia
ser de qualquer um" para "tem dono" veio do mesmo movimento — um punhado de marcas
gráficas próprias, repetidas em toda seção. Nas três, o vocabulário coube em uma linha:

    uma cafeteria    .pilula .selo .micro .numeral .regua   ("é barato e é o que faz
                                                              o site ter dono")
    uma bebida       código de cor por tampa em TODO componente que lista produto
    um pet shop      o estilo adesivo com contorno

E o defeito que este script pega não é a AUSÊNCIA do vocabulário — é ele existir e não
ter sido distribuído. Medido numa loja gerada, com o prefixo `casa-`:

    casa-rotulo         24 usos    <- voz tipográfica: distribuída
    casa-display        16 usos
    casa-filete          1 uso     <- filete dourado 44x2px: a marca da casa
    casa-roda            1 uso        usada UMA vez cada
    casa-pop             1 uso
    casa-parallax        0 usos    <- definida e nunca usada

Uma linha dourada numa seção é decoração. A mesma linha em nove seções é assinatura.

O QUE ELE MEDE
1. o vocabulário declarado (classes `.<prefixo>-*` no CSS da marca)
2. quantas vezes cada uma é de fato usada, e quais estão mortas
3. COBERTURA POR SEÇÃO: quantas seções da receita carregam pelo menos uma marca da casa
   — uma seção sem nenhuma é uma seção que poderia estar em qualquer loja
4. cobertura por página (home / catálogo / produto / carrinho), que é onde a assinatura
   costuma parar: o vocabulário chega na home e não atravessa para as internas

USO
    vocabulario.py <dir-do-projeto> [--prefixo casa] [--cobertura 0.7] [--minimo 3]

CÓDIGOS DE SAÍDA
    0  o vocabulário está distribuído
    1  existe vocabulário, mas ele não cobre a loja
    2  O GATE NÃO RODOU (caminho errado, sem CSS, ou nenhuma classe de marca encontrada)

O 2 é o mesmo do sistema.py ao lado: gate que varre o vazio e diz "limpo" aprova sem ter olhado.
"""
import re
import sys
import pathlib
from collections import Counter

# Ancorado na RAIZ do projeto de proposito: `marca/` (briefing) se ignora, mas
# `components/marca/` e onde vivem os componentes de marca — foi la que a primeira
# versao deste script perdeu uma das marcas da casa e a declarou morta.
IGNORAR_RAIZ = {"node_modules", ".next", ".git", "shots", "reviews", "public", "marca"}

# Classes utilitárias do próprio framework não são vocabulário de marca: elas resolvem
# layout, não identidade. Quem assina a página é o filete, a roda, o selo — não o
# container da seção.
SUFIXO_UTILITARIO = re.compile(r"-(secao|tela|trilho|container|grid|wrap|layout|sr)$")

RE_CLASSE_CSS = re.compile(r"^\.([a-z][a-z0-9]*)-([a-z0-9-]+)\s*(?:,|\{|::|:)", re.M)

# Nem toda marca da casa e uma classe CSS. Numa das lojas medidas, duas das marcas
# (uma chuva de particulas e uma roda tipografica) sao COMPONENTES em components/marca/
# — a primeira versao deste script so contava classes e reportou o vocabulario como muito
# menos distribuido do que ele esta: a chuva aparece em 8 lugares, nao em 1.
DIR_COMPONENTES_MARCA = "components/marca"
RE_COMPONENTE = re.compile(r"export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9]*)")


def arquivos(raiz, exts):
    for p in raiz.rglob("*"):
        if p.suffix.lower() not in exts:
            continue
        rel = p.relative_to(raiz).parts
        if rel and rel[0] in IGNORAR_RAIZ:
            continue
        yield p


def descobrir_vocabulario(raiz, prefixo=None):
    """Lê o CSS e devolve (prefixo, {classe: descricao curta})."""
    css = list(arquivos(raiz, {".css"}))
    if not css:
        return None, {}

    achadas = Counter()
    por_prefixo = {}
    for p in css:
        t = p.read_text(encoding="utf-8", errors="ignore")
        for m in RE_CLASSE_CSS.finditer(t):
            pre, resto = m.group(1), m.group(2)
            achadas[pre] += 1
            por_prefixo.setdefault(pre, set()).add(f"{pre}-{resto}")

    if prefixo is None:
        # O prefixo da casa é o que tem mais classes distintas: um prefixo curto,
        # derivado do nome da marca, com muitas classes penduradas nele.
        # Prefixos de framework (tw, sm, md) não chegam perto em variedade.
        candidatos = sorted(por_prefixo.items(), key=lambda kv: -len(kv[1]))
        if not candidatos or len(candidatos[0][1]) < 3:
            return None, {}
        prefixo = candidatos[0][0]

    return prefixo, sorted(por_prefixo.get(prefixo, set()))


def componentes_de_marca(raiz):
    """Componentes exportados de components/marca/ — marcas da casa que nao sao classe."""
    base = raiz / DIR_COMPONENTES_MARCA
    nomes = set()
    if base.is_dir():
        for p in base.rglob("*.tsx"):
            nomes |= set(RE_COMPONENTE.findall(p.read_text(encoding="utf-8", errors="ignore")))
    return sorted(nomes)


def usos(raiz, classes, comps=()):
    """Conta uso de cada marca (classe OU componente) e mapeia arquivo -> marcas."""
    contagem = Counter()
    por_arquivo = {}
    base_marca = (raiz / DIR_COMPONENTES_MARCA).resolve()
    for p in arquivos(raiz, {".tsx", ".jsx"}):
        # a definicao do componente nao conta como uso dele
        dentro_da_definicao = str(p.resolve()).startswith(str(base_marca))
        t = p.read_text(encoding="utf-8", errors="ignore")
        presentes = set()
        for c in classes:
            n = len(re.findall(r"\b" + re.escape(c) + r"\b", t))
            if n:
                contagem[c] += n
                presentes.add(c)
        if not dentro_da_definicao:
            for c in comps:
                n = len(re.findall(r"<" + re.escape(c) + r"\b", t))
                if n:
                    contagem[c] += n
                    presentes.add(c)
        if presentes:
            por_arquivo[p] = presentes
    return contagem, por_arquivo


def secoes_da_receita(raiz):
    for nome in ("components/home/home-recipe.ts", "components/home/home-recipe.tsx"):
        p = raiz / nome
        if p.exists():
            t = p.read_text(encoding="utf-8", errors="ignore")
            return re.findall(r"\bsection:\s*[\"']([^\"']+)[\"']", t)
    return []


def arquivo_da_secao(raiz, nome):
    for cand in (
        raiz / "components/home/sections" / f"{nome}.tsx",
        raiz / "components/home" / f"{nome}.tsx",
    ):
        if cand.exists():
            return cand
    return None


PAGINAS = {
    "home": ["components/home"],
    "catálogo (PLP)": ["components/catalog", "app/(loja)/produtos"],
    "produto (PDP)": ["components/product", "app/(loja)/produto"],
    "carrinho": ["components/cart", "app/(loja)/carrinho"],
}


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    raiz = pathlib.Path(args[0]).resolve()
    prefixo = args[args.index("--prefixo") + 1] if "--prefixo" in args else None
    alvo_cob = float(args[args.index("--cobertura") + 1]) if "--cobertura" in args else 0.7
    minimo = int(args[args.index("--minimo") + 1]) if "--minimo" in args else 3

    if not raiz.is_dir():
        print(f"ERRO: {raiz} nao e um diretorio — o gate NAO RODOU", file=sys.stderr)
        sys.exit(2)

    prefixo, classes = descobrir_vocabulario(raiz, prefixo)
    if not classes:
        print(
            "ERRO: nenhum vocabulario de marca encontrado no CSS — o gate NAO RODOU.\n"
            "      Ou a loja nao tem vocabulario proprio (que ja e o achado do degrau 1),\n"
            "      ou o prefixo precisa vir em --prefixo.",
            file=sys.stderr,
        )
        sys.exit(2)

    comps = componentes_de_marca(raiz)
    contagem, por_arquivo = usos(raiz, classes, comps)

    # marcas gráficas = o vocabulário menos os utilitários de layout, mais os componentes
    marcas = [c for c in classes if not SUFIXO_UTILITARIO.search(c)] + list(comps)
    mortas = [c for c in marcas if contagem[c] == 0]
    unicas = [c for c in marcas if contagem[c] == 1]

    print(f"Vocabulario grafico: {len(classes)} classes `{prefixo}-*` + {len(comps)} componentes de marca\n")
    for c in sorted(marcas, key=lambda x: -contagem[x]):
        n = contagem[c]
        estado = "MORTA " if n == 0 else ("uso unico" if n == 1 else "")
        print(f"  {c:<28}{n:>4} usos   {estado}")

    ok = True

    # ── cobertura por seção da home ───────────────────────────────────────────
    secoes = secoes_da_receita(raiz)
    if secoes:
        sem_marca = []
        for s in secoes:
            f = arquivo_da_secao(raiz, s)
            if f is None:
                continue
            if not (por_arquivo.get(f, set()) & set(marcas)):
                sem_marca.append(s)
        cobertas = len(secoes) - len(sem_marca)
        frac = cobertas / len(secoes) if secoes else 0
        print(f"\nCobertura da home: {cobertas}/{len(secoes)} secoes carregam ao menos uma marca da casa")
        if sem_marca:
            print("  sem nenhuma marca (poderiam estar em qualquer loja):")
            for s in sem_marca:
                print(f"    - {s}")
        if frac < alvo_cob:
            print(f"  ABAIXO DO ALVO ({frac:.0%} < {alvo_cob:.0%})")
            ok = False
    else:
        print("\n(sem receita de home encontrada — cobertura por secao nao medida)")

    # ── cobertura por página ──────────────────────────────────────────────────
    print("\nCobertura por pagina:")
    for pagina, dirs in PAGINAS.items():
        marcas_ali = set()
        for d in dirs:
            base = raiz / d
            if not base.exists():
                continue
            for f, cs in por_arquivo.items():
                try:
                    f.relative_to(base)
                except ValueError:
                    continue
                marcas_ali |= cs & set(marcas)
        estado = "" if len(marcas_ali) >= minimo else f"  <- abaixo de {minimo}"
        print(f"  {pagina:<18}{len(marcas_ali):>3} marcas distintas{estado}")
        if len(marcas_ali) < minimo:
            ok = False

    if mortas or unicas:
        print()
        if mortas:
            print(f"  {len(mortas)} marca(s) MORTA(S): " + ", ".join(mortas))
            ok = False
        if unicas:
            print(f"  {len(unicas)} marca(s) de USO UNICO: " + ", ".join(unicas))
            print("    uma marca usada uma vez e decoracao; usada em toda secao e assinatura.")
            ok = False

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
