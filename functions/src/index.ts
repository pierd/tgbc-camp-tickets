import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import {
  calculateParticipantCostCents,
  CampState,
  DbCamp,
  DbCampParticipant,
  DbCampParticipantInstallment,
  DbCollections,
  DbStripeCheckoutSession,
  getCampParticipantId,
  JoinCampRequest,
  PayInstallmentRequest,
  PaymentResponse,
} from "shared";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import {
  FieldValue,
  Timestamp,
  UpdateData,
  WithFieldValue,
} from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

initializeApp();
setGlobalOptions({
  region: "australia-southeast2",
});

import { collection, db } from "./typedFirebase";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_WEBHOOK_DEV_SECRET =
  "whsec_85287fbdf6aaf99ead2a184d0c60fff9130d9eff9c5de3c0ff9be1697e857dbf";

export const joinCamp = onCall<JoinCampRequest>(
  { cors: /.*/ },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User is not authenticated");
    }
    const { campId, returnUrl, state, email } = request.data;
    return initiatePayment(request.auth.uid, campId, returnUrl, email, {
      isInitialInstallment: true,
      state,
    });
  }
);

export const payInstallment = onCall<PayInstallmentRequest>(
  { cors: /.*/ },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User is not authenticated");
    }
    const { campId, returnUrl, installmentCount, email } = request.data;
    return initiatePayment(request.auth.uid, campId, returnUrl, email, {
      isInitialInstallment: false,
      installmentCount,
    });
  }
);

async function initiatePayment(
  userId: string,
  campId: string,
  returnUrl: string,
  email: string,
  options:
    | { isInitialInstallment: true; state: CampState }
    | { isInitialInstallment: false; installmentCount: number }
) {
  const campRef = collection<DbCamp>(DbCollections.camps).doc(campId);
  const camp = await campRef.get();
  const campData = camp.data();
  if (!campData) {
    throw new HttpsError("not-found", "Camp not found");
  }

  const participantRef = collection<DbCampParticipant>(
    DbCollections.campParticipants
  ).doc(getCampParticipantId({ userId, campId }));
  const participant = await participantRef.get();
  const fetchedParticipantData = participant.data();
  let participantData: Omit<DbCampParticipant, "createdAt" | "updatedAt"> &
    WithFieldValue<{ createdAt: Timestamp; updatedAt: Timestamp }>;
  if (fetchedParticipantData !== undefined) {
    participantData = fetchedParticipantData;
    if (options.isInitialInstallment) {
      throw new HttpsError(
        "invalid-argument",
        "User has already joined the camp"
      );
    }
  } else {
    if (!options.isInitialInstallment) {
      throw new HttpsError("invalid-argument", "User has not joined the camp");
    }
    participantData = {
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      userId,
      campId,
      paidCents: 0,
      state: options.state,
    };
  }

  const participantCostCents = calculateParticipantCostCents(
    campData,
    participantData.state
  );
  if (participantData.paidCents >= participantCostCents) {
    throw new HttpsError(
      "invalid-argument",
      "User has already paid for the camp"
    );
  }

  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY.value());

  const successUrl = `${returnUrl}?success=true`;
  const cancelUrl = `${returnUrl}?success=false`;
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: campData.currency,
          product_data: {
            name: campData.name,
          },
          unit_amount: campData.initialInstallmentCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    tax_id_collection: {
      enabled: true,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email,
  });
  logger.debug("Stripe checkout session created", session);
  if (!session.url) {
    logger.error("Failed to create checkout session", session);
  }
  await collection<DbStripeCheckoutSession>(
    DbCollections.stripeCheckoutSessions
  )
    .doc(session.id)
    .set({
      createdAt: FieldValue.serverTimestamp(),
      sessionId: session.id,
      userId,
      campId,
      status: "pending",
      paymentIntents: [],
      sessionUrl: session.url || cancelUrl,
      cents: campData.initialInstallmentCents,
      ...(options.isInitialInstallment
        ? {
            isInitialInstallment: true,
            participantState: participantData.state,
          }
        : {
            isInitialInstallment: false,
          }),
    });

  const response: PaymentResponse = {
    redirectUrl: session.url || cancelUrl,
  };
  return response;
}

export const handleStripeWebhook = onRequest(
  { cors: /.*/ },
  async (request, response) => {
    const payload = request.rawBody;
    logger.debug("Stripe webhook received");
    const sig = request.headers["stripe-signature"];
    if (!sig) {
      logger.error("Stripe webhook error", "No signature");
      response.send("OK");
      return;
    }

    const secret = STRIPE_WEBHOOK_SECRET.value();
    if (!secret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    const secrets = [secret];
    if (isEmulator) {
      secrets.push(STRIPE_WEBHOOK_DEV_SECRET);
    }
    let event: Stripe.Event | undefined;
    for (const secret of secrets) {
      try {
        event = Stripe.webhooks.constructEvent(payload, sig, secret);
        break;
      } catch (err) {
        logger.warn(`Stripe webhook ${secret} error`, err);
      }
    }
    if (!event) {
      logger.error("Stripe webhook error", "No valid secret");
      response.send("OK");
      return;
    }

    logger.debug(`Stripe webhook event`, event);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await fulfillCheckoutSession(event.data.object, true);
    } else if (
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await fulfillCheckoutSession(event.data.object, false);
    } else {
      logger.warn("Stripe webhook event not handled", event);
    }
    response.send("OK");
  }
);

async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  successEvent: boolean
) {
  logger.info("Fulfilling checkout session", session);
  const sessionRef = collection<DbStripeCheckoutSession>(
    DbCollections.stripeCheckoutSessions
  ).doc(session.id);
  await db.runTransaction(async (transaction) => {
    const sessionData = (await transaction.get(sessionRef.ref)).data();
    if (!sessionData) {
      logger.error("Checkout session not found", session);
      return;
    }

    if (sessionData.status !== "pending") {
      logger.warn("Checkout session already fulfilled", session);
      return;
    }

    const failed = !successEvent || session.payment_status === "unpaid";

    if (session.payment_status === "unpaid") {
      transaction.update(sessionRef.ref, {
        status: "failed",
      });
      return;
    }

    if (!failed) {
      // success event - create participant installment (and participant if needed)
      const campRef = collection<DbCamp>(DbCollections.camps).doc(
        sessionData.campId
      );
      const camp = await campRef.get();
      const campData = camp.data();
      if (!campData) {
        throw new HttpsError("not-found", "Camp not found");
      }

      logger.info(
        "Creating participant installment",
        sessionData.userId,
        session.id
      );
      const participantRef = collection<DbCampParticipant>(
        DbCollections.campParticipants
      ).doc(
        getCampParticipantId({
          userId: sessionData.userId,
          campId: sessionData.campId,
        })
      );
      if (sessionData.isInitialInstallment) {
        transaction.set(participantRef.ref, {
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          userId: sessionData.userId,
          campId: sessionData.campId,
          paidCents: sessionData.cents,
          state: sessionData.participantState,
        });
      } else {
        transaction.update(participantRef.ref, {
          updatedAt: FieldValue.serverTimestamp(),
          paidCents: FieldValue.increment(sessionData.cents),
        });
      }
      transaction.set(
        participantRef
          .collection<DbCampParticipantInstallment>(DbCollections.installments)
          .doc(session.id).ref,
        {
          createdAt: FieldValue.serverTimestamp(),
          stripeCheckoutSessionId: session.id,
        }
      );
    }

    const updateData: UpdateData<DbStripeCheckoutSession> = {
      status: failed ? "failed" : "succeeded",
      paidAt: FieldValue.serverTimestamp(),
    };
    if (session.payment_intent) {
      updateData.paymentIntents = FieldValue.arrayUnion(session.payment_intent);
    }
    transaction.update(sessionRef.ref, updateData);
  });
}
