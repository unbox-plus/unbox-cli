// Self-check das regras de edição de itens da assinatura: npx tsx scripts/check-subscription-items.ts
import assert from "node:assert/strict";
import { checkItemsChange } from "../lib/subscription-items";
import { subscriptionItemsSchema } from "../lib/schemas";

const off = {};
const a = { productId: "A", variantId: "a1", quantity: 2 };
const b = { productId: "B", variantId: null, quantity: 1 };

assert.ok(checkItemsChange([a], [{ ...a, quantity: 3 }], off), "quantidade sem flag");
assert.equal(checkItemsChange([a], [{ ...a, quantity: 3 }], { canChangeProductQuantity: true }), null);
assert.ok(checkItemsChange([a, b], [a], off), "remover sem flag");
assert.equal(checkItemsChange([a, b], [a], { canRemoveProducts: true }), null);
assert.ok(checkItemsChange([a], [a, b], off), "adicionar sem flag");
assert.equal(checkItemsChange([a], [a, b], { canAddProducts: true }), null);
assert.equal(checkItemsChange([a], [{ ...a, variantId: "a2" }], off), null, "troca de variante passa com tudo desligado");
assert.equal(checkItemsChange([a], [a], off), null, "sem mudança");

assert.equal(subscriptionItemsSchema.safeParse([]).success, false, "lista vazia");
assert.equal(subscriptionItemsSchema.safeParse([{ ...a, quantity: 0 }]).success, false);
assert.equal(subscriptionItemsSchema.safeParse([a, b]).success, true);
console.log("ok");
