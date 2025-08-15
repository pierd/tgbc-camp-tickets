import { z } from "zod";

export const JoinCampRequest = z.object({
  campId: z.string(),
  location: z.string(),
  promoCode: z.string(),
  returnUrl: z.url(),
  email: z.email(),
});
export type JoinCampRequest = z.infer<typeof JoinCampRequest>;

export const PayInstallmentRequest = z.object({
  campId: z.string(),
  installmentCount: z.number(),
  returnUrl: z.url(),
  email: z.email(),
});
export type PayInstallmentRequest = z.infer<typeof PayInstallmentRequest>;

export const PaymentResponse = z.discriminatedUnion("paymentNeeded", [
  z.object({
    paymentNeeded: z.literal(true),
    redirectUrl: z.url(),
  }),
  z.object({
    paymentNeeded: z.literal(false),
  }),
]);
export type PaymentResponse = z.infer<typeof PaymentResponse>;
