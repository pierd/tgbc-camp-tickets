import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useIsAdmin, useStreamDocumentById, whereT } from "../firebaseHooks";
import {
  collection,
  CollectionReference,
  doc,
  DocumentReference,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  calculateParticipantCostCents,
  DbCollections,
  type DbCamp,
  type DbCampParticipant,
  type DbProfile,
} from "shared";
import {
  useStreamDocument,
  useFirebaseQuery,
  queryT,
  orderByT,
} from "../firebaseHooks";
import { campStateDisplayName } from "shared";
import CampModal from "./CampModal";
import { ParticipantProfile } from "./ParticipantProfile";

export const AdminCampDetails: React.FC = () => {
  const { campId } = useParams<{ campId: string }>();
  const { currentUser } = useAuth();
  const isAdmin = useIsAdmin();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch user profile
  const profileData = useStreamDocumentById(
    collection(db, DbCollections.profiles),
    currentUser?.uid
  );
  const profile = profileData.value?.data() as DbProfile | undefined;

  if (!campId) {
    return <div>Camp ID not found</div>;
  }

  // Get camp details
  const campRef = doc(db, DbCollections.camps, campId) as DocumentReference<
    DbCamp,
    DbCamp
  >;
  const campData = useStreamDocument<DbCamp, DbCamp>(campRef);

  // Get participants for this camp
  const participantsQuery = queryT(
    collection(db, DbCollections.campParticipants) as CollectionReference<
      DbCampParticipant,
      DbCampParticipant
    >,
    whereT("campId", "==", campId),
    orderByT("createdAt", "desc")
  );
  const participants = useFirebaseQuery(participantsQuery);

  if (!isAdmin) {
    return <div>You are not authorized to access this page</div>;
  }

  if (campData.status === "loading") {
    return <div>Loading camp details...</div>;
  }

  if (campData.status === "error") {
    return <div>Error loading camp: {campData.message}</div>;
  }

  const camp = campData.value?.data();
  if (!camp) {
    return <div>Camp not found</div>;
  }

  const formatCurrency = (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: camp.currency.toUpperCase(),
    }).format(dollars);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  return (
    <div className="admin-camp-details">
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1>Camp Details: {camp.name}</h1>
            <p>Welcome, {profile?.name || currentUser?.email}</p>
          </div>
          <div className="admin-nav">
            <Link to="/admin" className="nav-link">
              ← Back to Admin
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary edit-camp-btn"
            >
              Edit Camp
            </button>
          </div>
        </div>
      </header>

      <main className="admin-content">
        {/* Camp Details Section */}
        <div className="camp-details-section">
          <h2>Camp Information</h2>
          <div className="camp-details-grid">
            <div className="detail-card">
              <h3>Basic Info</h3>
              <div className="detail-item">
                <strong>Name:</strong> {camp.name}
              </div>
              <div className="detail-item">
                <strong>State:</strong> {campStateDisplayName[camp.state]}
              </div>
              <div className="detail-item">
                <strong>Currency:</strong> {camp.currency.toUpperCase()}
              </div>
              <div className="detail-item">
                <strong>Created:</strong> {formatDate(camp.createdAt)}
              </div>
              <div className="detail-item">
                <strong>Last Updated:</strong> {formatDate(camp.updatedAt)}
              </div>
              <div className="detail-item">
                <strong>Last Installment Deadline:</strong>{" "}
                {formatDate(camp.lastInstallmentDeadline)}
              </div>
            </div>

            <div className="detail-card">
              <h3>Pricing</h3>
              <div className="detail-item">
                <strong>Initial Installment:</strong>{" "}
                {formatCurrency(camp.initialInstallmentCents)}
              </div>
              <div className="detail-item">
                <strong>Installment Amount:</strong>{" "}
                {formatCurrency(camp.installmentCents)}
              </div>
              <div className="detail-item">
                <strong>Total Cost:</strong>{" "}
                {formatCurrency(camp.totalCostCents)}
              </div>
              <div className="detail-item">
                <strong>Out of State Rebate:</strong>{" "}
                {formatCurrency(camp.outOfStateRebateCents)}
              </div>
              <div className="detail-item">
                <strong>In State Extra Cost:</strong>{" "}
                {formatCurrency(camp.inStateExtraCostCents)}
              </div>
            </div>
          </div>
        </div>

        {/* Participants Section */}
        {participants.length > 0 && (
          <div className="participants-section">
            <h2>Participants ({participants.length})</h2>
            <div className="participants-list">
              {participants.map((participantDoc) => {
                const participant = participantDoc.data();
                return (
                  <div key={participantDoc.id} className="participant-card">
                    <div className="participant-info">
                      <ParticipantProfile userId={participant.userId} />
                      <div className="participant-id">
                        <strong>User ID:</strong> {participantDoc.id}
                      </div>
                      <div className="participant-state">
                        <strong>State:</strong>{" "}
                        {
                          campStateDisplayName[
                            participant.state as keyof typeof campStateDisplayName
                          ]
                        }
                      </div>
                      <div className="participant-joined">
                        <strong>Joined:</strong>{" "}
                        {formatDate(participant.createdAt)}
                      </div>
                      <div className="participant-paid">
                        <strong>Paid:</strong>{" "}
                        {formatCurrency(participant.paidCents)}
                        {participant.paidCents ===
                        calculateParticipantCostCents(camp, participant.state)
                          ? " (Fully Paid)"
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <CampModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="edit"
        campToEdit={camp ? { ...camp, id: campId! } : undefined}
      />
    </div>
  );
};
