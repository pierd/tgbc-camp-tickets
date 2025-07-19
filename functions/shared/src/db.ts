import { Timestamp } from "@firebase/firestore-types";
import { CampState } from "./states";

export enum DbCollections {
  permissions = "permissions",
  profiles = "profiles",
  camps = "camps",
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
  defaultCampState: CampState;
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
  state: CampState;
  lastInstallmentDeadline: Timestamp;
  currency: Currency;
  initialInstallmentCents: number;
  installmentCents: number;
  totalCostCents: number;
  outOfStateRebateCents: number;
  inStateExtraCostCents: number;
};

export function calculateParticipantCostCents(
  campData: DbCamp,
  participantState: CampState
) {
  return (
    campData.totalCostCents +
    (campData.state === participantState
      ? campData.inStateExtraCostCents
      : -campData.outOfStateRebateCents)
  );
}

// keyed by `userId-campId`
export type DbCampParticipant = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: UserId;
  state: CampState;
  campId: CampId;
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
      participantState: CampState;
    }
  | {
      isInitialInstallment: false;
    }
);
