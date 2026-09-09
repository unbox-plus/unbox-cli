/** Serializa dado estruturado para dentro de <script type="application/ld+json">.
 *
 *  O `<` PRECISA virar \u003c: qualquer string vinda do catálogo (título, descrição, uma
 *  resposta de FAQ) que contenha `</script>` fecharia a tag e derrubaria o resto da página.
 *  É a única sanitização necessária aqui, e vale para todo JSON-LD do projeto.
 */
export function ldJson(dado: unknown): string {
  return JSON.stringify(dado).replace(/</g, "\\u003c");
}
