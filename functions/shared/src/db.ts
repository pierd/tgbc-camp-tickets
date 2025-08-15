import { Timestamp } from "@firebase/firestore-types";

export enum DbCollections {
  permissions = "permissions",
  profiles = "profiles",
  camps = "camps",
  // sub-collection of `camps`
  promoCodes = "promoCodes",
  campParticipants = "participants",
  // sub-collection of `campParticipants`
  installments = "installments",
  stripeCheckoutSessions = "stripeCheckoutSessions",
}

export type UserId = string;

/** Not editable by the user, visible only to the user */
export interface DbPermission {
  /** Can access and modify all data */
  isAdmin: boolean;
}

/** Editable by the user, visible to all users */
export type DbProfile = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  name: string;
};

export function isProfileComplete(profile: DbProfile | undefined) {
  return !!profile?.name;
}

export enum Currency {
  AUD = "aud",
  EURO = "eur",
  USD = "usd",
}

export type CampId = string;

export type DbCamp = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  name: string;
  lastInstallmentDeadline: Timestamp;
  currency: Currency;
  initialInstallmentCents: number;
  installmentCents: number;
  baseCostCents: number;
  discountCentsPerLocation: Record<string, number>;
};

// keyed by `code`
export type DbPromoCode = {
  discountCents: number;
};

export function sanitizePromoCode(promoCode: string) {
  return promoCode.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function calculateParticipantCostCents(
  campData: DbCamp,
  participantLocation: string,
  promoCodeDiscountCents: number,
) {
  return Math.max(
    0,
    campData.baseCostCents -
      (campData.discountCentsPerLocation[participantLocation] ?? 0) -
      promoCodeDiscountCents,
  );
}

// keyed by `userId-campId`
export type DbCampParticipant = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: UserId;
  location: string;
  promoCode: string;
  campId: CampId;
  costCents: number;
  paidCents: number;
};

export function getCampParticipantId({
  userId,
  campId,
}: {
  userId: UserId;
  campId: CampId;
}) {
  return `${userId}-${campId}`;
}

export type DbCampParticipantInstallment = {
  createdAt: Timestamp;
  stripeCheckoutSessionId: string;
};

export type DbStripeCheckoutSession = {
  createdAt: Timestamp;
  sessionId: string;
  userId: UserId;
  campId: string;
  /** If set, the session has been paid */
  paidAt?: Timestamp;
  status: "pending" | "succeeded" | "failed";
  error?: string;
  sessionUrl: string;
  paymentIntents: string[];
  cents: number;
} & (
  | {
      isInitialInstallment: true;
      location: string;
      promoCode: string;
    }
  | {
      isInitialInstallment: false;
    }
);
