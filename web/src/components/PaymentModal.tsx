import { useState } from "react";
import {
  type DbCamp,
  type DbCampParticipant,
  Currency,
  calculateParticipantCostCents,
} from "shared";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  camp: DbCamp & { id: string };
  participant: DbCampParticipant;
  onPay: (campId: string, installmentCount: number) => Promise<void>;
}

export default function PaymentModal({
  isOpen,
  onClose,
  camp,
  participant,
  onPay,
}: PaymentModalProps) {
  const [installmentCount, setInstallmentCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  const totalCostCents = calculateParticipantCostCents(camp, participant.state);
  const remainingCents = totalCostCents - participant.paidCents;
  const maxInstallments = Math.ceil(remainingCents / camp.installmentCents);
  const installmentAmountCents = Math.min(
    camp.installmentCents,
    remainingCents
  );
  const totalPaymentCents = installmentCount * installmentAmountCents;

  const formatCurrency = (cents: number, currency: Currency) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  const handlePay = async () => {
    setIsLoading(true);
    try {
      await onPay(camp.id, installmentCount);
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Pay for {camp.name}</h2>
          <button onClick={onClose} className="modal-close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="payment-summary">
            <div className="payment-row">
              <span>Total Cost:</span>
              <span>{formatCurrency(totalCostCents, camp.currency)}</span>
            </div>
            <div className="payment-row">
              <span>Already Paid:</span>
              <span>
                {formatCurrency(participant.paidCents, camp.currency)}
              </span>
            </div>
            <div className="payment-row payment-row-remaining">
              <span>Remaining:</span>
              <span>{formatCurrency(remainingCents, camp.currency)}</span>
            </div>
          </div>

          <div className="installment-selection">
            <label htmlFor="installment-count">Number of Installments:</label>
            <select
              id="installment-count"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
              disabled={isLoading}
            >
              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(
                (num) => (
                  <option key={num} value={num}>
                    {num} installment{num > 1 ? "s" : ""} (
                    {formatCurrency(
                      num * installmentAmountCents,
                      camp.currency
                    )}
                    )
                  </option>
                )
              )}
            </select>
          </div>

          <div className="payment-total">
            <strong>Total Payment:</strong>{" "}
            {formatCurrency(totalPaymentCents, camp.currency)}
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Pay Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
