import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  useIsAdmin,
  useFirebaseQuery,
  queryT,
  orderByT,
  whereT,
  useParticipantInstallments,
  useStreamDocumentById,
  collectionT,
} from "../firebaseHooks";
import {
  DbCollections,
  type DbCamp,
  type DbCampParticipant,
  type DbStripeCheckoutSession,
  type DbProfile,
  Currency,
  JoinCampRequest,
  PayInstallmentRequest,
  PaymentResponse,
  isProfileComplete,
  type CampId,
} from "shared";
import { useMemo, useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import JoinCampModal from "./JoinCampModal";
import PaymentModal from "./PaymentModal";
import ProfileModal from "./ProfileModal";
import { formatDate } from "../utils";

const joinCamp = httpsCallable<JoinCampRequest, PaymentResponse>(
  functions,
  "joinCamp"
);
const payInstallment = httpsCallable<PayInstallmentRequest, PaymentResponse>(
  functions,
  "payInstallment"
);

type CampWithId = DbCamp & { id: CampId };

export function Dashboard() {
  const { currentUser, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const [joinModalCamp, setJoinModalCamp] = useState<CampWithId | null>(null);
  const [paymentModalCamp, setPaymentModalCamp] = useState<CampWithId | null>(null);
  const [, setShowProfileModal] = useState(false);

  // Payment result banner state
  const [paymentBanner, setPaymentBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Handle URL parameters for payment results
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");

    if (success !== null) {
      const isSuccess = success === "true";
      setPaymentBanner({
        type: isSuccess ? "success" : "error",
        message: isSuccess
          ? "Payment processed successfully! Your installment will appear in the system shortly."
          : "Payment failed or was cancelled. Please try again or contact support if the issue persists.",
      });

      // Remove the success parameter from URL
      urlParams.delete("success");
      const newUrl =
        window.location.pathname +
        (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);

      // Auto-dismiss banner after 5 seconds
      const timer = setTimeout(() => {
        setPaymentBanner(null);
      }, 5000);

      // Clean up timer on unmount
      return () => clearTimeout(timer);
    }
  }, []);

  // Fetch user profile
  const profileData = useStreamDocumentById(
    collectionT<DbProfile>(DbCollections.profiles),
    currentUser?.uid
  );

  // Check if profile is complete
  const profile = profileData.value?.data() as DbProfile | undefined;
  const isProfileIncomplete = !isProfileComplete(profile);

  // Show profile modal if profile is incomplete
  const shouldShowProfileModal =
    isProfileIncomplete && currentUser && profileData.status !== "loading";

  console.log("currentUser.uid", currentUser?.uid);

  // Fetch all camps
  const campsRef = collectionT<DbCamp>(DbCollections.camps);
  const campsQuery = queryT(campsRef, orderByT("createdAt", "desc"));
  const camps = useFirebaseQuery(campsQuery);

  // Fetch user's camp participants
  const participantsRef = collectionT<DbCampParticipant>(DbCollections.campParticipants);
  const participantsQuery = queryT(
    participantsRef,
    whereT("userId", "==", currentUser?.uid || ""),
    orderByT("createdAt", "desc")
  );
  const userCampParticipants = useFirebaseQuery(participantsQuery);
  const campParticipation = userCampParticipants.reduce((acc, doc) => {
    const data = doc.data();
    return { ...acc, [data.campId]: data };
  }, {} as { [campId: CampId]: DbCampParticipant });

  // Fetch installments and stripe sessions for each participant
  const installmentsData = useParticipantInstallments(userCampParticipants);

  // Categorize camps
  const categorizedCamps = useMemo(() => {
    if (!currentUser?.uid) {
      return { participating: [], available: [], past: [], loading: true };
    }

    const participating: (DbCamp & { id: CampId })[] = [];
    const available: (DbCamp & { id: CampId })[] = [];
    const past: (DbCamp & { id: CampId })[] = [];

    const now = new Date();

    camps.forEach((campDoc) => {
      const camp = campDoc.data();
      const campWithId = { ...camp, id: campDoc.id };
      const userParticipation = campParticipation[campDoc.id];
      const deadlineDate = camp.lastInstallmentDeadline.toDate();

      if (userParticipation) {
        // User participates in this camp
        if (deadlineDate < now) {
          // Camp deadline has passed - it's a past camp
          past.push(campWithId);
        } else {
          // Camp deadline hasn't passed - user is still participating
          participating.push(campWithId);
        }
      } else {
        // User doesn't participate in this camp
        if (deadlineDate < now) {
          // Camp deadline has passed - it's a past camp (not available to join)
          past.push(campWithId);
        } else {
          // Camp deadline hasn't passed - it's available to join
          available.push(campWithId);
        }
      }
    });

    // Sort each list chronologically by lastInstallmentDeadline
    const sortByDeadline = (a: CampWithId, b: CampWithId) => {
      return (
        a.lastInstallmentDeadline.toMillis() - b.lastInstallmentDeadline.toMillis()
      );
    };

    participating.sort(sortByDeadline);
    available.sort(sortByDeadline);
    past.sort(sortByDeadline);

    return { participating, available, past, loading: false };
  }, [camps, campParticipation, currentUser?.uid]);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const renderInstallmentBoxes = (
    camp: CampWithId,
    userParticipation: DbCampParticipant | undefined
  ) => {
    if (!userParticipation) {
      return null;
    }

    const participantId = `${userParticipation.userId}-${userParticipation.campId}`;
    const participantData = installmentsData.get(participantId);

    if (!participantData) {
      return null;
    }

    const { installments, stripeSessions } = participantData;

    // Create a map of stripe sessions by session ID for quick lookup
    const sessionsMap = new Map<string, DbStripeCheckoutSession>();
    stripeSessions.forEach((sessionDoc) => {
      const session = sessionDoc.data();
      sessionsMap.set(session.sessionId, session);
    });

    // Only show boxes for installments that actually exist
    const installmentBoxes: Array<{
      key: string;
      amount: number;
      status: string;
      title: string;
      date: string;
    }> = [];
    const processedSessionIds = new Set<string>();

    // Process all stripe sessions and their corresponding installments
    stripeSessions.forEach((sessionDoc) => {
      const session = sessionDoc.data();
      const sessionId = session.sessionId;

      // Skip if we've already processed this session
      if (processedSessionIds.has(sessionId)) {
        return;
      }

      // Find the corresponding installment document
      const installmentDoc = installments.find(
        (doc) => doc.data().stripeCheckoutSessionId === sessionId
      );

      if (installmentDoc || session.isInitialInstallment) {
        const status = session.status === "succeeded" ? "paid" : session.status;
        const title = session.isInitialInstallment
          ? `Initial Installment: ${formatCurrency(
              session.cents,
              camp.currency
            )} - ${status}`
          : `Installment: ${formatCurrency(
              session.cents,
              camp.currency
            )} - ${status}`;

        // Use paidAt date if available, otherwise use createdAt
        const dateToShow = session.paidAt || session.createdAt;
        const date = formatDate(dateToShow);

        installmentBoxes.push({
          key: sessionId,
          amount: session.cents,
          status,
          title,
          date,
        });

        processedSessionIds.add(sessionId);
      }
    });

    if (installmentBoxes.length === 0) {
      return null;
    }

    return (
      <div className="installment-boxes">
        <div className="installment-boxes-header">
          <strong>Installments:</strong>
        </div>
        <div className="installment-boxes-grid">
          {installmentBoxes.map((box) => (
            <div
              key={box.key}
              className={`installment-box ${box.status}`}
              title={box.title}
            >
              <div className="installment-amount">
                {formatCurrency(box.amount, camp.currency)}
              </div>
              <div className="installment-date">{box.date}</div>
              <div className="installment-status">{box.status}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const campTicketsUrl = "https://www.toughguybookclub.com/camp_tickets_iframe";

  const handleJoinCamp = async ({campId, location, promoCode}: {campId: string; location: string; promoCode: string}) => {
    try {
      const returnUrl = window.top !== window.self
        ? campTicketsUrl
        : window.location.href;

      const email = currentUser?.email;
      if (!email) {
        throw new Error("Email is required");
      }
      const result = await joinCamp({ campId, location, promoCode, returnUrl, email });
      if (result.data.paymentNeeded) {
        const { redirectUrl } = result.data;
        // Open Stripe checkout in a new window/tab
        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error("Failed to join camp:", error);
      throw error;
    }
  };

  const handlePayInstallment = async (
    campId: string,
    installmentCount: number
  ) => {
    try {
      const returnUrl = window.top !== window.self
        ? campTicketsUrl
        : window.location.href;

      const email = currentUser?.email;
      if (!email) {
        throw new Error("Email is required");
      }
      const result = await payInstallment({
        campId,
        returnUrl,
        installmentCount,
        email,
      });
      if (result.data.paymentNeeded) {
        const { redirectUrl } = result.data;
        // Open Stripe checkout in a new window/tab
        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error("Failed to pay installment:", error);
      throw error;
    }
  };

  const renderCampCard = (
    camp: CampWithId,
    type: "participating" | "available" | "past"
  ) => {
    const userParticipation = campParticipation[camp.id];
    const deadlineDate = camp.lastInstallmentDeadline.toDate();
    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isDeadlinePassed = deadlineDate < now;
    const isDeadlineApproaching = !isDeadlinePassed && daysUntilDeadline <= 7;

    // Check if camp is fully paid
    const isFullyPaid = userParticipation
      ? userParticipation.paidCents >= userParticipation.costCents
      : false;

    console.log("isFullyPaid", isFullyPaid, userParticipation);

    return (
      <div
        key={camp.id}
        className={`camp-card ${type} ${
          isDeadlineApproaching ? "deadline-approaching" : ""
        } ${isDeadlinePassed ? "deadline-passed" : ""}`}
      >
        <div className="camp-info">
          <h3 className="camp-name">{camp.name}</h3>
          <div className="camp-details">
            <div className="camp-currency">
              <strong>Currency:</strong> {camp.currency.toUpperCase()}
            </div>
            <div className="camp-pricing">
              <strong>Base Cost:</strong>{" "}
              {formatCurrency(camp.baseCostCents, camp.currency)}
              {/* {Object.entries(camp.discountCentsPerLocation).map(([location, discountCents]) =>
                discountCents > 0 ? (
                  <div className="camp-discount" key={location}>
                    <strong>{location} Discount:</strong>{" "}
                    {formatCurrency(discountCents, camp.currency)}
                  </div>
                ) : null
              )} */}
            </div>
            <div className="camp-dates">
              <strong>Created:</strong> {formatDate(camp.createdAt)}
            </div>
            <div className="camp-deadline">
              <strong>Last Installment Deadline:</strong>{" "}
              {formatDate(camp.lastInstallmentDeadline)}
              {isDeadlineApproaching && (
                <span className="deadline-warning">
                  ⚠️ Deadline in {daysUntilDeadline} days
                </span>
              )}
              {isDeadlinePassed && (
                <span className="deadline-passed-text">⏰ Deadline passed</span>
              )}
            </div>
          </div>
        </div>
        <div className="camp-actions">
          {type === "available" && (
            <button
              className="btn-primary join-camp-btn"
              onClick={() => setJoinModalCamp(camp)}
            >
              Join Camp
            </button>
          )}
          {type === "participating" && (
            <>
              {userParticipation && userParticipation.costCents > 0 && (
                <div className="participation-details">
                  <div className="payment-summary">
                    <strong>Paid:</strong>{" "}
                    {formatCurrency(userParticipation.paidCents, camp.currency)}
                  </div>
                  {renderInstallmentBoxes(camp, userParticipation)}
                  {!isFullyPaid && <div className="remaining-payment">
                    <strong>Remaining:</strong>{" "}
                    {formatCurrency(
                      userParticipation.costCents - userParticipation.paidCents,
                      camp.currency
                    )}
                  </div>}
                </div>
              )}
              <button
                className="btn-primary pay-btn"
                disabled={isFullyPaid}
                onClick={() => setPaymentModalCamp(camp)}
              >
                {isFullyPaid ? "Fully Paid" : "Pay Installment"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {profile?.name || currentUser?.email}</span>
          {isAdmin && (
            <Link to="/admin" className="nav-link">
              Admin
            </Link>
          )}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Payment result banner */}
      {paymentBanner && (
        <div className={`payment-banner ${paymentBanner.type}`}>
          <div className="banner-content">
            <span className="banner-message">{paymentBanner.message}</span>
            <button
              className="banner-close-btn"
              onClick={() => setPaymentBanner(null)}
              aria-label="Close banner"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="dashboard-content">
        {categorizedCamps.loading && (
          <section className="camp-section">
            <h2>Loading camps...</h2>
          </section>
        )}

        {!categorizedCamps.loading && categorizedCamps.participating.length === 0 && categorizedCamps.available.length === 0 && categorizedCamps.past.length === 0 && (
          <section className="camp-section">
            <h2>No camps found</h2>
          </section>
        )}

        {/* Camps the user participates in */}
        {!categorizedCamps.loading && categorizedCamps.participating.length > 0 && (
          <section className="camp-section">
            <h2>
              Camps You're Participating In (
              {categorizedCamps.participating.length})
            </h2>
            <div className="camps-grid">
              {categorizedCamps.participating.map((camp) =>
                renderCampCard(camp, "participating")
              )}
            </div>
          </section>
        )}

        {/* Camps available to join */}
        {!categorizedCamps.loading && categorizedCamps.available.length > 0 && (
          <section className="camp-section">
            <h2>
              Camps Available to Join ({categorizedCamps.available.length})
            </h2>
            <div className="camps-grid">
              {categorizedCamps.available.map((camp) =>
                renderCampCard(camp, "available")
              )}
            </div>
          </section>
        )}

        {/* Past camps */}
        {!categorizedCamps.loading && categorizedCamps.past.length > 0 && (
          <section className="camp-section">
            <h2>Past Camps ({categorizedCamps.past.length})</h2>
            <div className="camps-grid">
              {categorizedCamps.past.map((camp) =>
                renderCampCard(camp, "past")
              )}
            </div>
          </section>
        )}
      </main>

      {joinModalCamp && (
        <JoinCampModal
          isOpen={!!joinModalCamp}
          onClose={() => setJoinModalCamp(null)}
          camp={joinModalCamp}
          onJoin={handleJoinCamp}
        />
      )}

      {paymentModalCamp && (
        <PaymentModal
          isOpen={!!paymentModalCamp}
          onClose={() => setPaymentModalCamp(null)}
          camp={paymentModalCamp}
          participant={campParticipation[paymentModalCamp.id]}
          onPay={handlePayInstallment}
        />
      )}

      {shouldShowProfileModal && (
        <ProfileModal
          isOpen={shouldShowProfileModal}
          onProfileComplete={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
