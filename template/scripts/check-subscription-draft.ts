// Self-check do rascunho de itens da assinatura: npx tsx scripts/check-subscription-draft.ts
import assert from "node:assert/strict";
import {
  addItem,
  changeCount,
  createDraft,
  isDirty,
  isLastActive,
  removeItem,
  setQuantity,
  swapVariant,
  toPayload,
  undoRemove,
  validateDraft,
} from "../lib/subscription-draft";

const a = { productId: "A", variantId: "a1", quantity: 2 };
const b = { productId: "B", variantId: "b1", quantity: 1 };
const saved = [a, b];

let d = createDraft(saved);
assert.equal(isDirty(saved, d), false, "começa igual ao salvo");

d = removeItem(d, 1);
assert.equal(isDirty(saved, d), true);
assert.deepEqual(toPayload(d), [a], "removido não vai ao servidor");
assert.equal(isLastActive(d, 0), true, "sobrou um ativo");
d = undoRemove(d, 1);
assert.equal(isDirty(saved, d), false, "desfazer volta ao salvo");

d = swapVariant(d, 0, "a2");
assert.equal(isDirty(saved, d), true);
d = swapVariant(d, 0, "a1");
assert.equal(isDirty(saved, d), false, "trocar e voltar não é mudança");

d = setQuantity(d, 0, 0);
assert.equal(d[0].quantity, 1, "mínimo 1");

d = addItem(createDraft(saved), {
  productId: "C",
  variantId: "c1",
  quantity: 3,
});
assert.equal(d.length, 3);
assert.equal(d[2].isNew, true);
assert.equal(
  addItem(d, { productId: "C", variantId: "c1", quantity: 1 }),
  d,
  "mesma variante não entra duas vezes",
);
assert.ok(!("isNew" in toPayload(d)[2]), "payload sem marcas do rascunho");

d = removeItem(removeItem(createDraft(saved), 0), 1);
assert.ok(validateDraft(d), "lista vazia não salva");
assert.equal(validateDraft(createDraft(saved)), null);
d = createDraft(saved);
assert.equal(changeCount(saved, d), 0);
assert.equal(
  changeCount(saved, swapVariant(d, 0, "a2")),
  1,
  "trocar variante conta 1",
);
assert.equal(
  changeCount(saved, setQuantity(removeItem(d, 1), 0, 5)),
  2,
  "remover um e mudar a quantidade de outro",
);
assert.equal(
  changeCount(
    saved,
    addItem(d, { productId: "C", variantId: "c1", quantity: 1 }),
  ),
  1,
);
// kit: os itens escolhidos viajam no payload e contam como mudança quando mudam
const kitA = {
  productKitId: "K",
  picks: [
    { productId: "x", productVariantId: "x1", quantity: 2 },
    { productId: "y", productVariantId: "y1", quantity: 1 },
  ],
};
const kitB = {
  productKitId: "K",
  picks: [{ productId: "x", productVariantId: "x1", quantity: 3 }],
};
const savedKit = [{ productId: "K", variantId: "k1", quantity: 1, kit: kitA }];
d = createDraft(savedKit);
assert.equal(isDirty(savedKit, d), false, "kit igual ao salvo");
assert.deepEqual(toPayload(d)[0].kit, kitA, "o kit vai no payload");
const novo = addItem(createDraft(saved), {
  productId: "K2",
  variantId: "k2",
  quantity: 1,
  kit: kitB,
});
assert.deepEqual(
  toPayload(novo)[2].kit,
  kitB,
  "kit adicionado mantém os itens escolhidos",
);
assert.equal(
  changeCount(savedKit, [{ ...savedKit[0], kit: kitB }]),
  1,
  "trocar os itens do kit é 1 alteração",
);
assert.equal(
  isDirty(savedKit, [
    { ...savedKit[0], kit: { ...kitA, picks: [...kitA.picks].reverse() } },
  ]),
  false,
  "ordem dos itens não conta",
);
console.log("ok");
