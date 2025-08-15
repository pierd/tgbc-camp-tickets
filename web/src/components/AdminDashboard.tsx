import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  useIsAdmin,
  useFirebaseQuery,
  queryT,
  orderByT,
  useStreamDocumentById,
  collectionT,
} from "../firebaseHooks";
import {
  DbCollections,
  type DbCamp,
  Currency,
  type DbProfile,
} from "shared";
import CampModal from "./CampModal";
import { formatDate } from "../utils";

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = useIsAdmin();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [campToEdit, setCampToEdit] = useState<
    (DbCamp & { id: string }) | undefined
  >();

  // Fetch user profile
  const profileData = useStreamDocumentById(
    collectionT<DbProfile>(DbCollections.profiles),
    currentUser?.uid
  );
  const profile = profileData.value?.data() as DbProfile | undefined;

  // Get camps from Firebase
  const campsRef = collectionT<DbCamp>(DbCollections.camps);
  const campsQuery = queryT(campsRef, orderByT("createdAt", "desc"));
  const camps = useFirebaseQuery(campsQuery);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setCampToEdit(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (camp: DbCamp & { id: string }) => {
    setModalMode("edit");
    setCampToEdit(camp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCampToEdit(undefined);
  };

  if (!isAdmin) {
    return <div>You are not authorized to access this page</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Welcome, {profile?.name || currentUser?.email}</p>
          </div>
          <div className="admin-nav">
            <Link to="/" className="nav-link">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <div className="admin-section">
          <div className="section-header">
            <h2>Camp Management</h2>
            <button
              onClick={handleOpenCreateModal}
              className="btn-primary add-camp-btn"
            >
              + Add New Camp
            </button>
          </div>

          <div className="camps-list">
            {camps.length === 0 ? (
              <div className="no-camps">
                <p>
                  No camps have been created yet. Create your first camp to get
                  started.
                </p>
              </div>
            ) : (
              camps.map((campDoc) => {
                const camp = campDoc.data();
                return (
                  <div key={campDoc.id} className="camp-card">
                    <div className="camp-info">
                      <h3 className="camp-name">{camp.name}</h3>
                      <div className="camp-details">
                        <div className="camp-currency">
                          <strong>Currency:</strong>{" "}
                          {camp.currency.toUpperCase()}
                        </div>
                        <div className="camp-pricing">
                          <strong>Base Cost:</strong>{" "}
                          {formatCurrency(camp.baseCostCents, camp.currency)}
                        </div>
                        <div className="camp-dates">
                          <strong>Created:</strong> {formatDate(camp.createdAt)}
                        </div>
                        <div className="camp-deadline">
                          <strong>Last Installment Deadline:</strong>{" "}
                          {formatDate(camp.lastInstallmentDeadline)}
                        </div>
                      </div>
                    </div>
                    <div className="camp-actions">
                      <Link
                        to={`/admin/camp/${campDoc.id}`}
                        className="btn-secondary view-details-btn"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() =>
                          handleOpenEditModal({
                            ...camp,
                            id: campDoc.id,
                          } as DbCamp & { id: string })
                        }
                        className="btn-primary edit-camp-btn"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <CampModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode={modalMode}
        campToEdit={campToEdit}
      />
    </div>
  );
};
