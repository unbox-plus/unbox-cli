// Preload dos testes de regressão do create (`node --import test/helpers/inject.mjs ...`).
//
// Com UNBOX_TEST_ANSWERS preenchida, faz o processo se passar por um terminal e entrega as
// respostas do wizard pelo `prompts.inject`, na ordem em que as perguntas aparecem. Roda igual no
// código antigo e no novo: os dois importam o MESMO `prompts` (o node_modules da cópia antiga é um
// symlink para o do repositório), então a injeção vale para quem perguntar.
import prompts from "prompts";

const respostas = process.env.UNBOX_TEST_ANSWERS ? JSON.parse(process.env.UNBOX_TEST_ANSWERS) : null;
if (respostas) {
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  prompts.inject(respostas);
}
