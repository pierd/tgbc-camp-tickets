import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useIsAdmin, useFirebaseQuery, queryT, orderByT, whereT } from '../firebaseHooks';
import { collection } from 'firebase/firestore';
import { db } from '../firebase';
import { DbCollections, type DbCamp, type DbCampParticipant, CampState, Currency, campStateDisplayName, JoinCampRequest, PayInstallmentRequest, PaymentResponse, calculateParticipantCostCents } from 'shared';
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import JoinCampModal from './JoinCampModal';
import PaymentModal from './PaymentModal';

const joinCamp = httpsCallable<JoinCampRequest, PaymentResponse>(functions, 'joinCamp');
const payInstallment = httpsCallable<PayInstallmentRequest, PaymentResponse>(functions, 'payInstallment');

export function Dashboard() {
  const { currentUser, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const [joinModalCamp, setJoinModalCamp] = useState<(DbCamp & { id: string }) | null>(null);
  const [paymentModalCamp, setPaymentModalCamp] = useState<(DbCamp & { id: string }) | null>(null);

  console.log("currentUser.uid", currentUser?.uid);

  // Fetch all camps
  const campsRef = collection(db, DbCollections.camps);
  const campsQuery = queryT(campsRef, orderByT('createdAt', 'desc'));
  const camps = useFirebaseQuery(campsQuery);

  // Fetch user's camp participants
  const participantsRef = collection(db, DbCollections.campParticipants);
  const participantsQuery = queryT(
    participantsRef,
    whereT('userId', '==', currentUser?.uid || ''),
    orderByT('createdAt', 'desc')
  );
  const participants = useFirebaseQuery(participantsQuery);

  // Categorize camps
  const categorizedCamps = useMemo(() => {
    if (!currentUser?.uid) return { participating: [], available: [], past: [] };

    const userParticipations = new Map<string, DbCampParticipant>();
    participants.forEach(doc => {
      const participant = doc.data() as DbCampParticipant;
      userParticipations.set(participant.campId, participant);
    });

    const participating: (DbCamp & { id: string })[] = [];
    const available: (DbCamp & { id: string })[] = [];
    const past: (DbCamp & { id: string })[] = [];

    const now = new Date();

    camps.forEach(campDoc => {
      const camp = campDoc.data() as DbCamp;
      const campWithId = { ...camp, id: campDoc.id };
      const userParticipation = userParticipations.get(campDoc.id);
      const deadlineDate = new Date(camp.lastInstallmentDeadline.seconds * 1000);

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
    const sortByDeadline = (a: DbCamp & { id: string }, b: DbCamp & { id: string }) => {
      return a.lastInstallmentDeadline.seconds - b.lastInstallmentDeadline.seconds;
    };

    participating.sort(sortByDeadline);
    available.sort(sortByDeadline);
    past.sort(sortByDeadline);

    return { participating, available, past };
  }, [camps, participants, currentUser?.uid]);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const handleJoinCamp = async (campId: string, state: CampState) => {
    try {
      const returnUrl = window.location.href;
      const result = await joinCamp({ campId, state, returnUrl });
      const { redirectUrl } = result.data;
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Failed to join camp:', error);
      throw error;
    }
  };

  const handlePayInstallment = async (campId: string, installmentCount: number) => {
    try {
      const returnUrl = window.location.href;
      const result = await payInstallment({ campId, returnUrl, installmentCount });
      const { redirectUrl } = result.data;
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Failed to pay installment:', error);
      throw error;
    }
  };

  const renderCampCard = (camp: DbCamp & { id: string }, type: 'participating' | 'available' | 'past') => {
    const userParticipation = participants.find(doc => doc.data().campId === camp.id)?.data() as DbCampParticipant | undefined;
    const deadlineDate = new Date(camp.lastInstallmentDeadline.seconds * 1000);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isDeadlinePassed = deadlineDate < now;
    const isDeadlineApproaching = !isDeadlinePassed && daysUntilDeadline <= 7;

    // Check if camp is fully paid
    const isFullyPaid = userParticipation ?
      userParticipation.paidCents >= calculateParticipantCostCents(camp, userParticipation.state) :
      false;

    return (
      <div key={camp.id} className={`camp-card ${type} ${isDeadlineApproaching ? 'deadline-approaching' : ''} ${isDeadlinePassed ? 'deadline-passed' : ''}`}>
        <div className="camp-info">
          <h3 className="camp-name">{camp.name}</h3>
          <div className="camp-details">
            <div className="camp-location">
              <strong>Location:</strong> {campStateDisplayName[camp.state as CampState] || camp.state}
            </div>
            <div className="camp-currency">
              <strong>Currency:</strong> {camp.currency.toUpperCase()}
            </div>
            <div className="camp-pricing">
              <strong>Total Cost:</strong> {formatCurrency(camp.totalCostCents, camp.currency)}
            </div>
            <div className="camp-dates">
              <strong>Created:</strong> {formatDate(camp.createdAt)}
            </div>
            <div className="camp-deadline">
              <strong>Last Installment Deadline:</strong> {formatDate(camp.lastInstallmentDeadline)}
              {isDeadlineApproaching && (
                <span className="deadline-warning">⚠️ Deadline in {daysUntilDeadline} days</span>
              )}
              {isDeadlinePassed && (
                <span className="deadline-passed-text">⏰ Deadline passed</span>
              )}
            </div>
            {userParticipation && (
              <div className="participation-info">
                <strong>Your State:</strong> {campStateDisplayName[userParticipation.state as CampState]}
                <br />
                <strong>Paid:</strong> {formatCurrency(userParticipation.paidCents, camp.currency)}
              </div>
            )}
          </div>
        </div>
        <div className="camp-actions">
          {type === 'available' && (
            <button
              className="btn-primary join-camp-btn"
              onClick={() => setJoinModalCamp(camp)}
            >
              Join Camp
            </button>
          )}
          {type === 'participating' && (
            <>
              <Link to={`/camp/${camp.id}`} className="btn-secondary view-details-btn">
                View Details
              </Link>
              {!isFullyPaid && (
                <button
                  className="btn-primary pay-btn"
                  onClick={() => setPaymentModalCamp(camp)}
                >
                  Pay
                </button>
              )}
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
          <span>Welcome, {currentUser?.email}</span>
          {isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {/* Camps the user participates in */}
        <section className="camp-section">
          <h2>Camps You're Participating In ({categorizedCamps.participating.length})</h2>
          {categorizedCamps.participating.length === 0 ? (
            <div className="no-camps">
              <p>You're not participating in any camps yet.</p>
            </div>
          ) : (
            <div className="camps-grid">
              {categorizedCamps.participating.map(camp => renderCampCard(camp, 'participating'))}
            </div>
          )}
        </section>

        {/* Camps available to join */}
        <section className="camp-section">
          <h2>Camps Available to Join ({categorizedCamps.available.length})</h2>
          {categorizedCamps.available.length === 0 ? (
            <div className="no-camps">
              <p>No camps are currently available to join.</p>
            </div>
          ) : (
            <div className="camps-grid">
              {categorizedCamps.available.map(camp => renderCampCard(camp, 'available'))}
            </div>
          )}
        </section>

        {/* Past camps */}
        <section className="camp-section">
          <h2>Past Camps ({categorizedCamps.past.length})</h2>
          {categorizedCamps.past.length === 0 ? (
            <div className="no-camps">
              <p>You haven't participated in any past camps.</p>
            </div>
          ) : (
            <div className="camps-grid">
              {categorizedCamps.past.map(camp => renderCampCard(camp, 'past'))}
            </div>
          )}
        </section>
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
          participant={participants.find(doc => doc.data().campId === paymentModalCamp.id)?.data() as DbCampParticipant}
          onPay={handlePayInstallment}
        />
      )}
    </div>
  );
}
