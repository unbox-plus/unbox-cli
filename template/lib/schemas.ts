// Schemas de validação (zod) usados no BFF. A fonte da verdade de validação é o servidor.
import { z } from "zod";

const digits = (s: string) => s.replace(/\D/g, "");

/** DDDs em uso no Brasil (Anatel). A Unbox valida o DDD e recusa o pedido: o comprimento
 *  sozinho não basta (testado contra produção, DDD "01" passa aqui e é recusado lá). */
const DDD_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Normaliza o telefone: só dígitos e SEM o zero à esquerda do DDD. Muita gente escreve
 *  "011 3333-4444"; com o zero vira 12 dígitos e o DDD chega como "01", que a Unbox recusa.
 *  Tirar o zero é entender o que a pessoa quis dizer: "011 99360-3233" vira 11993603233 e
 *  "019 8765-4321" vira DDD 19. */
const telefone = (s: string) => digits(s).replace(/^0+/, "");

export const addressSchema = z.object({
  fullName: z.string().min(3, "Informe o nome completo."),
  // CPF/CNPJ: 11 ou 14 dígitos (taxPayerId é necessário na prática — doc 05)
  taxPayerId: z.string().transform(digits).refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ inválido."),
  postal: z.string().transform(digits).refine((v) => v.length === 8, "CEP inválido."),
  address1: z.string().min(2, "Informe o logradouro."),
  number: z.string().min(1, "Informe o número."),
  neighborhood: z.string().min(1, "Informe o bairro."),
  city: z.string().min(2, "Informe a cidade."),
  region: z.string().length(2, "UF deve ter 2 letras."),
  phone: z.string().transform(telefone)
    .refine((v) => v.length >= 10 && v.length <= 11, "Telefone inválido: informe DDD e número.")
    .refine((v) => DDD_VALIDOS.has(Number(v.slice(0, 2))), "DDD inválido. Confira o número com DDD."),
  country: z.string().default("BR"),
  address2: z.string().optional(),
  cityCode: z.string().optional(),
});
export type AddressForm = z.infer<typeof addressSchema>;

export const cardSchema = z.object({
  cardHolder: z.string().min(3, "Nome impresso no cartão."),
  cardNumber: z.string().transform(digits).refine((v) => v.length >= 13 && v.length <= 19, "Número do cartão inválido."),
  expirationMonth: z.string().transform(digits).refine((v) => +v >= 1 && +v <= 12, "Mês inválido."),
  expirationYear: z.string().transform(digits).refine((v) => v.length === 2 || v.length === 4, "Ano inválido."),
  securityCode: z.string().transform(digits).refine((v) => v.length >= 3 && v.length <= 4, "CVV inválido."),
  installments: z.number().int().min(1).max(12).optional(),
});

export const emailSchema = z.string().email("E-mail inválido.");

export const otpSchema = z.object({
  email: emailSchema,
  otp: z.string().min(4, "Código inválido."),
});

// device (antifraude Unbox) coletado no navegador — 8 campos, type BROWSER.
// timezoneOffset em MINUTOS (getTimezoneOffset(), BRT → 180) — ver ponto aberto em unbox/types.ts.
export const deviceSchema = z.object({
  type: z.literal("BROWSER"),
  colorDepth: z.number(),
  javaEnabled: z.boolean(),
  userAgent: z.string().max(1024),
  language: z.string().max(64),
  screenHeight: z.number(),
  screenWidth: z.number(),
  timezoneOffset: z.number(),
});

export const placeOrderSchema = z.object({
  email: emailSchema,
  address: addressSchema,
  payment: z.union([
    z.object({ type: z.literal("pix") }),
    z.object({ type: z.literal("card"), card: cardSchema }),
  ]),
  recurringItemsFrequencyId: z.string().optional(),
  // opcional: se o browser não mandar, o servidor cai no fallback { type: "API" }.
  device: deviceSchema.optional(),
});
