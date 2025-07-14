import { z } from "zod";
import { CampState } from "./states";

export const JoinCampRequest = z.object({
  campId: z.string(),
  state: z.enum(CampState),
  returnUrl: z.url(),
});
export type JoinCampRequest = z.infer<typeof JoinCampRequest>;

export const PayInstallmentRequest = z.object({
  campId: z.string(),
  installmentCount: z.number(),
  returnUrl: z.url(),
});
export type PayInstallmentRequest = z.infer<typeof PayInstallmentRequest>;

export const PaymentResponse = z.object({
  redirectUrl: z.url(),
});
export type PaymentResponse = z.infer<typeof PaymentResponse>;
