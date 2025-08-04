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
} from "../firebaseHooks";
import { collection } from "firebase/firestore";
import { db } from "../firebase";
import {
  DbCollections,
  type DbCamp,
  type DbCampParticipant,
  type DbStripeCheckoutSession,
  type DbProfile,
  CampState,
  Currency,
  campStateDisplayName,
  JoinCampRequest,
  PayInstallmentRequest,
  PaymentResponse,
  calculateParticipantCostCents,
  isProfileComplete,
} from "shared";
import { useMemo, useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import JoinCampModal from "./JoinCampModal";
import PaymentModal from "./PaymentModal";
import ProfileModal from "./ProfileModal";

const joinCamp = httpsCallable<JoinCampRequest, PaymentResponse>(
  functions,
  "joinCamp"
);
const payInstallment = httpsCallable<PayInstallmentRequest, PaymentResponse>(
  functions,
  "payInstallment"
);

export function Dashboard() {
  const { currentUser, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const [joinModalCamp, setJoinModalCamp] = useState<
    (DbCamp & { id: string }) | null
  >(null);
  const [paymentModalCamp, setPaymentModalCamp] = useState<
    (DbCamp & { id: string }) | null
  >(null);
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
    collection(db, DbCollections.profiles),
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
  const campsRef = collection(db, DbCollections.camps);
  const campsQuery = queryT(campsRef, orderByT("createdAt", "desc"));
  const camps = useFirebaseQuery(campsQuery);

  // Fetch user's camp participants
  const participantsRef = collection(db, DbCollections.campParticipants);
  const participantsQuery = queryT(
    participantsRef,
    whereT("userId", "==", currentUser?.uid || ""),
    orderByT("createdAt", "desc")
  );
  const participants = useFirebaseQuery(participantsQuery);

  // Fetch installments and stripe sessions for each participant
  const installmentsData = useParticipantInstallments(participants as any);

  // Categorize camps
  const categorizedCamps = useMemo(() => {
    if (!currentUser?.uid)
      return { participating: [], available: [], past: [] };

    const userParticipations = new Map<string, DbCampParticipant>();
    participants.forEach((doc) => {
      const participant = doc.data() as DbCampParticipant;
      userParticipations.set(participant.campId, participant);
    });

    const participating: (DbCamp & { id: string })[] = [];
    const available: (DbCamp & { id: string })[] = [];
    const past: (DbCamp & { id: string })[] = [];

    const now = new Date();

    camps.forEach((campDoc) => {
      const camp = campDoc.data() as DbCamp;
      const campWithId = { ...camp, id: campDoc.id };
      const userParticipation = userParticipations.get(campDoc.id);
      const deadlineDate = new Date(
        camp.lastInstallmentDeadline.seconds * 1000
      );

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
    const sortByDeadline = (
      a: DbCamp & { id: string },
      b: DbCamp & { id: string }
    ) => {
      return (
        a.lastInstallmentDeadline.seconds - b.lastInstallmentDeadline.seconds
      );
    };

    participating.sort(sortByDeadline);
    available.sort(sortByDeadline);
    past.sort(sortByDeadline);

    return { participating, available, past };
  }, [camps, participants, currentUser?.uid]);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  const renderInstallmentBoxes = (
    camp: DbCamp & { id: string },
    userParticipation: DbCampParticipant | undefined
  ) => {
    if (!userParticipation) return null;

    const participantId = `${userParticipation.userId}-${userParticipation.campId}`;
    const participantData = installmentsData.get(participantId);

    if (!participantData) return null;

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
      if (processedSessionIds.has(sessionId)) return;

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

    if (installmentBoxes.length === 0) return null;

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

  const handleJoinCamp = async (campId: string, state: CampState) => {
    try {
      const returnUrl = window.location.href;
      const email = currentUser?.email;
      if (!email) {
        throw new Error("Email is required");
      }
      const result = await joinCamp({ campId, state, returnUrl, email });
      const { redirectUrl } = result.data;
      // Check if we're in an iframe and navigate parent window instead
      if (window.top && window.top !== window.self) {
        window.top.location.href = redirectUrl;
      } else {
        window.location.href = redirectUrl;
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
      const returnUrl = window.location.href;
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
      const { redirectUrl } = result.data;
      // Check if we're in an iframe and navigate parent window instead
      if (window.top && window.top !== window.self) {
        window.top.location.href = redirectUrl;
      } else {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error("Failed to pay installment:", error);
      throw error;
    }
  };

  const renderCampCard = (
    camp: DbCamp & { id: string },
    type: "participating" | "available" | "past"
  ) => {
    const userParticipation = participants
      .find((doc) => doc.data().campId === camp.id)
      ?.data() as DbCampParticipant | undefined;
    const deadlineDate = new Date(camp.lastInstallmentDeadline.seconds * 1000);
    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isDeadlinePassed = deadlineDate < now;
    const isDeadlineApproaching = !isDeadlinePassed && daysUntilDeadline <= 7;

    // Check if camp is fully paid
    const isFullyPaid = userParticipation
      ? userParticipation.paidCents >=
        calculateParticipantCostCents(camp, userParticipation.state)
      : false;

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
            <div className="camp-location">
              <strong>Location:</strong>{" "}
              {campStateDisplayName[camp.state as CampState] || camp.state}
            </div>
            <div className="camp-currency">
              <strong>Currency:</strong> {camp.currency.toUpperCase()}
            </div>
            <div className="camp-pricing">
              <strong>Total Cost:</strong>{" "}
              {formatCurrency(camp.totalCostCents, camp.currency)}
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
          {type === "participating" && !isFullyPaid && (
            <>
              {userParticipation && (
                <div className="participation-details">
                  <div className="payment-summary">
                    <strong>Paid:</strong>{" "}
                    {formatCurrency(userParticipation.paidCents, camp.currency)}
                  </div>
                  {renderInstallmentBoxes(camp, userParticipation)}
                  <div className="remaining-payment">
                    <strong>Remaining:</strong>{" "}
                    {formatCurrency(
                      calculateParticipantCostCents(
                        camp,
                        userParticipation.state
                      ) - userParticipation.paidCents,
                      camp.currency
                    )}
                  </div>
                </div>
              )}
              <button
                className="btn-primary pay-btn"
                onClick={() => setPaymentModalCamp(camp)}
              >
                Pay Installment
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
        {/* Camps the user participates in */}
        {categorizedCamps.participating.length > 0 && (
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
        {categorizedCamps.available.length > 0 && (
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
        {categorizedCamps.past.length > 0 && (
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
          userProfile={profile}
        />
      )}

      {paymentModalCamp && (
        <PaymentModal
          isOpen={!!paymentModalCamp}
          onClose={() => setPaymentModalCamp(null)}
          camp={paymentModalCamp}
          participant={
            participants
              .find((doc) => doc.data().campId === paymentModalCamp.id)
              ?.data() as DbCampParticipant
          }
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
