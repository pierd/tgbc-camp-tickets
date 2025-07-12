import { Timestamp } from "@firebase/firestore-types";
export declare enum DbCollections {
    permissions = "permissions",
    profiles = "profiles",
    stripeCheckoutSessions = "stripeCheckoutSessions"
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
export declare function isProfileComplete(profile: DbProfile | undefined): boolean;
export type DbStripeCheckoutSession = {
    createdAt: Timestamp;
    sessionId: string;
    userId: UserId;
    /** If set, the session has been paid */
    paidAt?: Timestamp;
    status: "pending" | "succeeded" | "failed";
    error?: string;
    sessionUrl: string;
    paymentIntents: string[];
    cents: number;
};
