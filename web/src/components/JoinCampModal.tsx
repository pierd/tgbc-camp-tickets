import React, { useState } from "react";
import {
  calculateParticipantCostCents,
  CampState,
  campStateDisplayName,
  Currency,
  type DbCamp,
  type DbProfile,
} from "shared";

interface JoinCampModalProps {
  isOpen: boolean;
  onClose: () => void;
  camp: DbCamp & { id: string };
  onJoin: (campId: string, state: CampState) => Promise<void>;
  userProfile?: DbProfile;
}

const JoinCampModal: React.FC<JoinCampModalProps> = ({
  isOpen,
  onClose,
  camp,
  onJoin,
  userProfile,
}) => {
  const [selectedState, setSelectedState] = useState<CampState>(
    userProfile?.defaultCampState || camp.state
  );
  const [isLoading, setIsLoading] = useState(false);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onJoin(camp.id, selectedState);
    } catch (error) {
      console.error("Failed to join camp:", error);
      alert("Failed to join camp. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const participantCost = calculateParticipantCostCents(camp, selectedState);
  const isInState = selectedState === camp.state;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Join Camp: {camp.name}</h2>
          <button onClick={onClose} className="modal-close">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="join-camp-form">
          <div className="camp-summary">
            <h3>Camp Details</h3>
            <div className="camp-info-grid">
              <div>
                <strong>Camp Name:</strong> {camp.name}
              </div>
              <div>
                <strong>Camp Location:</strong>{" "}
                {campStateDisplayName[camp.state]}
              </div>
              <div>
                <strong>Currency:</strong> {camp.currency.toUpperCase()}
              </div>
              <div>
                <strong>Total Cost:</strong>{" "}
                {formatCurrency(camp.totalCostCents, camp.currency)}
              </div>
              <div>
                <strong>Initial Installment:</strong>{" "}
                {formatCurrency(camp.initialInstallmentCents, camp.currency)}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="state">Your State</label>
            <select
              id="state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value as CampState)}
              required
            >
              <optgroup label="Australia">
                {Object.entries(campStateDisplayName)
                  .filter(([key]) => key.startsWith("au"))
                  .map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="United States">
                {Object.entries(campStateDisplayName)
                  .filter(([key]) => key.startsWith("us"))
                  .map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div className="cost-breakdown">
            <h3>Cost Breakdown</h3>
            <div className="cost-details">
              <div>
                <strong>Base Cost:</strong>{" "}
                {formatCurrency(camp.totalCostCents, camp.currency)}
              </div>
              {isInState ? (
                <div>
                  <strong>In-State Extra Cost:</strong> +
                  {formatCurrency(camp.inStateExtraCostCents, camp.currency)}
                </div>
              ) : (
                <div>
                  <strong>Out-of-State Rebate:</strong> -
                  {formatCurrency(camp.outOfStateRebateCents, camp.currency)}
                </div>
              )}
              <div className="total-cost">
                <strong>Your Total Cost:</strong>{" "}
                {formatCurrency(participantCost, camp.currency)}
              </div>
              <div className="initial-payment">
                <strong>Initial Payment:</strong>{" "}
                {formatCurrency(camp.initialInstallmentCents, camp.currency)}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Joining..." : "Join Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinCampModal;
