#!/usr/bin/env bash
# Lista os repositórios que o token do GitHub enxerga e estima, para cada loja gerada pela
# CLI, qual versão do @unbox-plus/cli serviu de base. Não clona nada: lê a árvore e os poucos
# arquivos necessários pela API do GitHub (≈ 1 chamada de árvore + até 5 de conteúdo por loja).
#
# Uso:
#   token=ghp_xxx ./tools/cli-version-lojas.sh
#   token=ghp_xxx json=1 ./tools/cli-version-lojas.sh     # saída em JSON (uma linha por loja)
#   token=ghp_xxx todos=1 ./tools/cli-version-lojas.sh    # inclui os repos ignorados (não-loja)
#
# Lê a branch padrão de cada repo. "Versão" é a mais alta cujos marcadores estão todos
# presentes; "lacunas" são marcadores de versões anteriores que faltam (arquivo editado ou
# removido pela loja, ou atualização parcial). Loja sincronizada à mão com uma versão nova
# aparece com a versão para a qual foi atualizada, não com a que a gerou.
set -euo pipefail

TOKEN="${token:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "uso: token=<github token> $0" >&2
  exit 2
fi
command -v python3 >/dev/null || { echo "python3 não encontrado" >&2; exit 2; }

export CLI_VERSION_TOKEN="$TOKEN"
export CLI_VERSION_TABELA="$(dirname "$0")/../src/version-markers.json"
exec python3 -I - <<'PY'
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

TOKEN = os.environ.pop("CLI_VERSION_TOKEN")
AS_JSON = os.environ.get("json") == "1"
SHOW_ALL = os.environ.get("todos") == "1"
API = os.environ.get("GITHUB_API_URL", "https://api.github.com")

# A tabela de marcadores mora em src/version-markers.json (a mesma da skill migrar-loja-analisar e do
# gate check-migracao.mjs). Do `carimbo.desde` em diante a loja traz a versão no package.json e o marcador não é usado.
TABELA = json.load(open(os.environ.pop("CLI_VERSION_TABELA"), encoding="utf-8"))
MARKERS = [(m["versao"], m["npm"], [tuple(c) for c in m["checagens"]]) for m in TABELA["marcadores"]]
ALIASES = TABELA["aliases"]
CARIMBO = TABELA["carimbo"]
VERSIONS = [m[0] for m in MARKERS]
# arquivos que, juntos, dizem que o repo é uma loja gerada pela CLI
STORE_SIGNS = ("agents/MANAGER.md", "scripts/check-unbox-brand.mjs")


def gh(path, raw=False):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github.raw" if raw else "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "unbox-cli-version-scan",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
        return (body.decode("utf-8", "replace") if raw else json.loads(body)), r.headers


def list_repos():
    url = "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name"
    repos = []
    while url:
        data, headers = gh(url)
        repos.extend(data)
        m = re.search(r'<([^>]+)>;\s*rel="next"', headers.get("Link", ""))
        url = m.group(1) if m else None
    return repos


class Repo:
    def __init__(self, full_name, ref):
        self.full_name, self.ref = full_name, ref
        tree, _ = gh(f"/repos/{full_name}/git/trees/{urllib.parse.quote(ref, safe='')}?recursive=1")
        self.truncated = tree.get("truncated", False)
        self.files = {e["path"] for e in tree["tree"] if e["type"] == "blob"}
        self.dirs = {e["path"] for e in tree["tree"] if e["type"] == "tree"}
        self._cache = {}

    def read(self, path):
        if path not in self.files:
            return None
        if path not in self._cache:
            q = urllib.parse.quote(path)
            ref = urllib.parse.quote(self.ref, safe="")
            self._cache[path], _ = gh(f"/repos/{self.full_name}/contents/{q}?ref={ref}", raw=True)
        return self._cache[path]

    def check(self, c):
        kind, rel = c[0], c[1]
        if kind == "file":
            return rel in self.files
        if kind == "dir":
            return rel in self.dirs
        txt = self.read(rel)
        if txt is None:
            return False
        hit = re.search(c[2], txt) is not None
        return hit if kind == "grep" else not hit


def scan(meta):
    name = meta["full_name"]
    ref = meta.get("default_branch") or "main"
    base = {"repo": name, "branch": ref}
    if meta.get("size", 1) == 0:
        return {**base, "loja": False, "motivo": "repo vazio"}
    try:
        repo = Repo(name, ref)
    except urllib.error.HTTPError as e:
        return {**base, "loja": False, "motivo": f"árvore inacessível (HTTP {e.code})"}
    if not any(s in repo.files for s in STORE_SIGNS):
        return {**base, "loja": False, "motivo": "não é loja da CLI"}
    try:
        pkg = repo.read(CARIMBO["arquivo"])
        carimbo = None
        if pkg:
            obj = json.loads(pkg)
            for parte in CARIMBO["campo"].split("."):
                obj = obj.get(parte) if isinstance(obj, dict) else None
            carimbo = obj
        if carimbo:
            return {**base, "loja": True, "versao": str(carimbo), "npm": True, "lacunas": [], "carimbo": True,
                    "truncada": repo.truncated}
        hits = {v: all(repo.check(c) for c in cs) for v, _, cs in MARKERS}
    except urllib.error.HTTPError as e:
        return {**base, "loja": True, "versao": None, "erro": f"HTTP {e.code} lendo arquivo"}
    best = max((i for i, v in enumerate(VERSIONS) if hits[v]), default=None)
    if best is None:
        return {**base, "loja": True, "versao": "< 0.17.1", "npm": False, "lacunas": [],
                "truncada": repo.truncated}
    gaps = [v for v in VERSIONS[:best] if not hits[v]]
    v = VERSIONS[best]
    return {**base, "loja": True, "versao": ALIASES.get(v, v), "npm": MARKERS[best][1],
            "lacunas": gaps, "truncada": repo.truncated}


def main():
    try:
        repos = list_repos()
    except urllib.error.HTTPError as e:
        print(f"falha ao listar repositórios: HTTP {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)
    print(f"{len(repos)} repositórios visíveis pelo token; analisando…", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(scan, repos))

    stores = [r for r in results if r["loja"]]
    shown = results if SHOW_ALL else stores
    if AS_JSON:
        for r in shown:
            print(json.dumps(r, ensure_ascii=False))
    else:
        rows = [("REPO", "BRANCH", "VERSÃO CLI", "NPM", "LACUNAS / OBS")]
        for r in shown:
            if not r["loja"]:
                rows.append((r["repo"], r["branch"], "-", "-", r["motivo"]))
                continue
            obs = ", ".join(r.get("lacunas") or [])
            if r.get("erro"):
                obs = r["erro"]
            if r.get("truncada"):
                obs = (obs + "; " if obs else "") + "árvore truncada pela API"
            npm = "sim" if r.get("npm") else "não"
            rows.append((r["repo"], r["branch"], r["versao"] or "?", npm, obs))
        w = [max(len(row[i]) for row in rows) for i in range(4)]
        for row in rows:
            print("  ".join(row[i].ljust(w[i]) for i in range(4)) + "  " + row[4])
    print(f"{len(stores)} lojas da CLI, {len(results) - len(stores)} repositórios ignorados.", file=sys.stderr)


main()
PY
