import React, { useState, useEffect } from "react";
import {
  calculateParticipantCostCents,
  Currency,
  DbCollections,
  type DbCamp,
  type DbPromoCode,
  sanitizePromoCode,
} from "shared";
import { collectionT } from "../firebaseHooks";
import { collection, CollectionReference, doc, getDoc } from "firebase/firestore";

interface JoinCampModalProps {
  isOpen: boolean;
  onClose: () => void;
  camp: DbCamp & { id: string };
  onJoin: (options: {campId: string; location: string; promoCode: string}) => Promise<void>;
}

const JoinCampModal: React.FC<JoinCampModalProps> = ({
  isOpen,
  onClose,
  camp,
  onJoin,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [promoCode, setPromoCode] = useState<string>("");
  const [promoCodeDiscountCents, setPromoCodeDiscountCents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Clear errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setValidationErrors([]);
    }
  }, [isOpen]);

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const applyPromoCode = async (code: string): Promise<number> => {
    const campRef = doc(collectionT<DbCamp>(DbCollections.camps), camp.id);
    const campPromoCodesRef = collection(campRef, DbCollections.promoCodes) as CollectionReference<DbPromoCode, DbPromoCode>;
    const promoCodeRef = doc(campPromoCodesRef, code);
    const promoCodeDoc = await getDoc(promoCodeRef);
    const promoCodeData = promoCodeDoc.data();
    if (!promoCodeData) {
      setValidationErrors(prev => [...prev.filter(err => !err.includes('Promo code not found')), `Promo code not found: ${code}`]);
      return 0;
    }
    // Clear promo code error if successful
    setValidationErrors(prev => prev.filter(err => !err.includes('Promo code not found')));
    return promoCodeData.discountCents;
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      setValidationErrors(prev => [...prev.filter(err => !err.includes('Please enter a promo code')), "Please enter a promo code"]);
      return;
    }

    setIsApplyingPromo(true);
    try {
      setPromoCodeDiscountCents(await applyPromoCode(promoCode));
    } catch (error) {
      console.error("Failed to apply promo code:", error);
      setValidationErrors(prev => [...prev, "Failed to apply promo code. Please try again."]);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setIsLoading(true);

    try {
      await onJoin({campId: camp.id, location: selectedLocation, promoCode});
      onClose();
    } catch (error) {
      console.error("Failed to join camp:", error);
      setValidationErrors(prev => [...prev, "Failed to join camp. Please try again."]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPromoCode(sanitizePromoCode(e.target.value));
    setValidationErrors(prev => prev.filter(err => !err.includes('Promo code')));
  };

  if (!isOpen) {
    return null;
  }

  const participantCost = calculateParticipantCostCents(camp, selectedLocation, promoCodeDiscountCents);
  const discountCents = camp.discountCentsPerLocation[selectedLocation] ?? 0;
  const initialInstallmentCents = Math.min(camp.initialInstallmentCents, participantCost);

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
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>Errors:</h4>
              <ul>
                {validationErrors.map((error, index) => (
                  <li key={index} className="error-message">{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="camp-summary">
            <h3>Camp Details</h3>
            <div className="camp-info-grid">
              <div>
                <strong>Camp Name:</strong> {camp.name}
              </div>
              <div>
                <strong>Currency:</strong> {camp.currency.toUpperCase()}
              </div>
              <div>
                <strong>Base Cost:</strong>{" "}
                {formatCurrency(camp.baseCostCents, camp.currency)}
              </div>
              <div>
                <strong>Initial Installment:</strong>{" "}
                {formatCurrency(camp.initialInstallmentCents, camp.currency)}
              </div>
            </div>
          </div>

          <div className="location-input-group">
            <label htmlFor="location">Your Location</label>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="">(N/A) Select a location...</option>
              {Object.entries(camp.discountCentsPerLocation).map(([location]) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="promo-code-input-group">
            <label htmlFor="promoCode">Promo Code</label>
            <input
              id="promoCode"
              value={promoCode}
              onChange={handlePromoCodeChange}
              placeholder="Enter promo code"
            />
            <button
              type="button"
              onClick={handleApplyPromoCode}
              disabled={!promoCode.trim() || isApplyingPromo}
            >
              {isApplyingPromo ? "Applying..." : "Apply"}
            </button>
          </div>

          <div className="cost-breakdown">
            <h3>Cost Breakdown</h3>
            <div className="cost-details">
              {promoCodeDiscountCents + discountCents > 0 && (
                <>
                  <div>
                    <strong>Base Cost:</strong>{" "}
                    {formatCurrency(camp.baseCostCents, camp.currency)}
                  </div>
                  {discountCents > 0 && (
                    <div>
                      <strong>Location discount:</strong> -
                      {formatCurrency(discountCents, camp.currency)}
                    </div>
                  )}
                  {promoCodeDiscountCents > 0 && (
                    <div>
                      <strong>Promo code discount:</strong> -
                      {formatCurrency(promoCodeDiscountCents, camp.currency)}
                    </div>
                  )}
                </>
              )}
              <div className="total-cost">
                <strong>Total Cost:</strong>{" "}
                {formatCurrency(participantCost, camp.currency)}
              </div>
              <div className="initial-payment">
                <strong>Initial Payment:</strong>{" "}
                {formatCurrency(initialInstallmentCents, camp.currency)}
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
            <button type="submit" className="btn-primary" disabled={isLoading || isApplyingPromo}>
              {isLoading ? "Joining..." : "Join Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinCampModal;
