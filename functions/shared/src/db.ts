import { Timestamp } from "@firebase/firestore-types";
import { CampState } from "./states";

export enum DbCollections {
  permissions = "permissions",
  profiles = "profiles",
  camps = "camps",
  // sub-collection of `camps`
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

export type DbCamp = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  name: string;
  state: CampState;
  initialInstallmentCents: number;
  installmentCents: number;
  totalCostCents: number;
  outOfStateRebateCents: number;
  inStateExtraCostCents: number;
};

// keyed by `userId`
export type DbCampParticipant = {
  createdAt: Timestamp;
  state: CampState;
};

export type DbCampParticipantInstallment = {
  createdAt: Timestamp;
  stripeCheckoutSessionId: string;
};

export type DbStripeCheckoutSession = {
  createdAt: Timestamp;
  sessionId: string;
  userId: UserId;
  // item: Item; // TODO: add this
  /** If set, the session has been paid */
  paidAt?: Timestamp;
  status: "pending" | "succeeded" | "failed";
  error?: string;
  sessionUrl: string;
  paymentIntents: string[];
  cents: number;
};
