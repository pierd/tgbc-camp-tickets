import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  DbCollections,
  type DbCamp,
  CampState,
  Currency,
  campStateDisplayName,
  isSameCountry,
} from "shared";

interface CampModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  campToEdit?: DbCamp & { id: string };
}

const CampModal: React.FC<CampModalProps> = ({
  isOpen,
  onClose,
  mode,
  campToEdit,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    country: "Australia",
    state: CampState.auNSW,
    currency: Currency.AUD,
    initialInstallmentCents: 0,
    installmentCents: 0,
    baseCostCents: 0,
    discountPerStateCents: {} as Partial<Record<CampState, number>>,
    lastInstallmentDeadline: "",
  });

  const [newStateToAdd, setNewStateToAdd] = useState<CampState | "">("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Helper function to convert integer dollars to cents
  const dollarsToCents = (dollars: string): number => {
    const num = parseInt(dollars) || 0;
    return num * 100;
  };

  // Helper function to convert cents to integer dollars
  const centsToDollars = (cents: number): string => {
    return Math.floor(cents / 100).toString();
  };

  // Helper function to convert Timestamp to date string for input
  const timestampToDateString = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toISOString().split("T")[0];
  };

  // Helper function to convert date string to Timestamp
  const dateStringToTimestamp = (dateString: string): Timestamp => {
    const date = new Date(dateString);
    return Timestamp.fromDate(date);
  };

  // Validation function
  const validateForm = (): string[] => {
    const errors: string[] = [];

    // Check if any discount is bigger than base cost
    for (const [state, discountCents] of (Object.entries(formData.discountPerStateCents) as [CampState, number][])) {
      if (discountCents > formData.baseCostCents) {
        errors.push(`Discount for ${campStateDisplayName[state]} cannot be larger than base cost`);
      }
    }

    // Find the biggest discount
    const biggestDiscount = Math.max(...Object.values(formData.discountPerStateCents), 0);

    // Check if initial installment is bigger than base cost minus biggest discount
    const maxInitialInstallment = formData.baseCostCents - biggestDiscount;
    if (formData.initialInstallmentCents > maxInitialInstallment) {
      errors.push(`Initial installment cannot be larger than base cost minus biggest discount (${centsToDollars(maxInitialInstallment)})`);
    }

    // Check if installment amount is valid (non-negative)
    if (formData.installmentCents < 0) {
      errors.push("Installment amount cannot be negative");
    } else {
      // For every discount: (base minus discount minus initial installment) must be divisible by installment amount
      for (const [state, discountCents] of (Object.entries(formData.discountPerStateCents) as [CampState, number][])) {
        const remainingAmount = formData.baseCostCents - discountCents - formData.initialInstallmentCents;
        if (remainingAmount >= 0 && remainingAmount % formData.installmentCents !== 0) {
          errors.push(`For ${campStateDisplayName[state]}: remaining amount after discount and initial installment (${centsToDollars(remainingAmount)}) must be divisible by installment amount (${centsToDollars(formData.installmentCents)})`);
        }
      }
    }

    return errors;
  };

  // Update validation errors when form data changes
  useEffect(() => {
    const errors = validateForm();
    setValidationErrors(errors);
  }, [formData]);

  // Initialize form data when editing
  useEffect(() => {
    if (mode === "edit" && campToEdit) {
      const country = campToEdit.state.startsWith("au") ? "Australia" : "US";
      setFormData({
        name: campToEdit.name,
        country,
        state: campToEdit.state,
        currency: campToEdit.currency,
        initialInstallmentCents: campToEdit.initialInstallmentCents,
        installmentCents: campToEdit.installmentCents,
        baseCostCents: campToEdit.baseCostCents,
        discountPerStateCents: campToEdit.discountPerStateCents,
        lastInstallmentDeadline: timestampToDateString(
          campToEdit.lastInstallmentDeadline
        ),
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        country: "Australia",
        state: CampState.auNSW,
        currency: Currency.AUD,
        initialInstallmentCents: 0,
        installmentCents: 0,
        baseCostCents: 0,
        discountPerStateCents: {},
        lastInstallmentDeadline: "",
      });
    }
  }, [mode, campToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for validation errors before submitting
    const errors = validateForm();
    if (errors.length > 0) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return;
    }

    try {
      const campData = {
        name: formData.name,
        state: formData.state,
        currency: formData.currency,
        initialInstallmentCents: formData.initialInstallmentCents,
        installmentCents: formData.installmentCents,
        baseCostCents: formData.baseCostCents,
        discountPerStateCents: formData.discountPerStateCents,
        lastInstallmentDeadline: formData.lastInstallmentDeadline
          ? dateStringToTimestamp(formData.lastInstallmentDeadline)
          : Timestamp.now(),
      };

      if (mode === "create") {
        const now = Timestamp.now();
        await addDoc(collection(db, DbCollections.camps), {
          ...campData,
          createdAt: now,
          updatedAt: now,
        });
      } else if (mode === "edit" && campToEdit) {
        const campRef = doc(db, DbCollections.camps, campToEdit.id);
        await updateDoc(campRef, {
          ...campData,
          updatedAt: Timestamp.now(),
        });
      }

      onClose();
    } catch (error) {
      console.error(
        `Error ${mode === "create" ? "creating" : "updating"} camp:`,
        error
      );
      alert(
        `Failed to ${
          mode === "create" ? "create" : "update"
        } camp. Please try again.`
      );
    }
  };

  const addStateDiscount = () => {
    if (newStateToAdd && !formData.discountPerStateCents[newStateToAdd]) {
      setFormData({
        ...formData,
        discountPerStateCents: {
          ...formData.discountPerStateCents,
          [newStateToAdd]: 0,
        },
      });
      setNewStateToAdd("");
    }
  };

  const removeStateDiscount = (state: CampState) => {
    const newDiscounts = { ...formData.discountPerStateCents };
    delete newDiscounts[state];
    setFormData({
      ...formData,
      discountPerStateCents: newDiscounts,
    });
  };

  const updateStateDiscount = (state: CampState, value: string) => {
    setFormData({
      ...formData,
      discountPerStateCents: {
        ...formData.discountPerStateCents,
        [state]: dollarsToCents(value),
      },
    });
  };

  // Get available states that haven't been added yet
  const availableStates = (Object.entries(campStateDisplayName) as [CampState, string][])
    .filter(([key]) => isSameCountry(formData.state, key) && formData.discountPerStateCents[key] === undefined)
    .map(([key, value]) => ({ key, value }));

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{mode === "create" ? "Add New Camp" : "Edit Camp"}</h2>
          <button onClick={onClose} className="modal-close">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="camp-form">
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>Validation Errors:</h4>
              <ul>
                {validationErrors.map((error, index) => (
                  <li key={index} className="error-message">{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="name">Camp Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="country">Country</label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                const newState =
                  newCountry === "Australia" ? CampState.auNSW : CampState.usAK;
                setFormData({
                  ...formData,
                  country: newCountry,
                  state: newState,
                  currency:
                    newCountry === "Australia" ? Currency.AUD : Currency.USD,
                });
              }}
              required
            >
              <option value="Australia">Australia</option>
              <option value="US">United States</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="state">State</label>
            <select
              id="state"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value as CampState })
              }
              required
            >
              {Object.entries(campStateDisplayName)
                .filter(([key]) => {
                  if (formData.country === "Australia") {
                    return key.startsWith("au");
                  } else {
                    return key.startsWith("us");
                  }
                })
                .map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  currency: e.target.value as Currency,
                })
              }
              required
            >
              <option value={Currency.AUD}>AUD</option>
              <option value={Currency.USD}>USD</option>
              <option value={Currency.EURO}>EUR</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="lastInstallmentDeadline">
              Last Installment Deadline
            </label>
            <input
              id="lastInstallmentDeadline"
              type="date"
              value={formData.lastInstallmentDeadline}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  lastInstallmentDeadline: e.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="initialInstallment">Initial Installment</label>
              <div className="money-input">
                <span className="currency-symbol">
                  {formData.currency === Currency.USD
                    ? "$"
                    : formData.currency === Currency.EURO
                    ? "€"
                    : "A$"}
                </span>
                <input
                  id="initialInstallment"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.initialInstallmentCents)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initialInstallmentCents: dollarsToCents(e.target.value),
                    })
                  }
                  required
                />
              </div>
              {formData.baseCostCents > 0 && (
                <div className="form-help">
                  Max: {centsToDollars(Math.max(0, formData.baseCostCents - Math.max(...Object.values(formData.discountPerStateCents), 0)))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="installmentAmount">Installment Amount</label>
              <div className="money-input">
                <span className="currency-symbol">
                  {formData.currency === Currency.USD
                    ? "$"
                    : formData.currency === Currency.EURO
                    ? "€"
                    : "A$"}
                </span>
                <input
                  id="installmentAmount"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.installmentCents)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      installmentCents: dollarsToCents(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="baseCost">Base Cost</label>
            <div className="money-input">
              <span className="currency-symbol">
                {formData.currency === Currency.USD
                  ? "$"
                  : formData.currency === Currency.EURO
                  ? "€"
                  : "A$"}
              </span>
              <input
                id="baseCost"
                type="number"
                min="0"
                value={centsToDollars(formData.baseCostCents)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    baseCostCents: dollarsToCents(e.target.value),
                  })
                }
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>State Discounts</label>
            <div className="discounts-section">
              <div className="add-discount-section">
                <select
                  value={newStateToAdd}
                  onChange={(e) => setNewStateToAdd(e.target.value as CampState)}
                >
                  <option value="">Select a state to add discount...</option>
                  {availableStates.map(({ key, value }) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addStateDiscount}
                  disabled={!newStateToAdd}
                  className="btn-secondary"
                >
                  Add Discount
                </button>
              </div>

              {Object.entries(formData.discountPerStateCents).length > 0 && (
                <div className="discounts-list">
                  {Object.entries(formData.discountPerStateCents).map(
                    ([state, discountCents]) => (
                      <div key={state} className="discount-item">
                        <div className="discount-state">
                          {campStateDisplayName[state as CampState]}
                        </div>
                        <div className="money-input">
                          <span className="currency-symbol">
                            {formData.currency === Currency.USD
                              ? "$"
                              : formData.currency === Currency.EURO
                              ? "€"
                              : "A$"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={centsToDollars(discountCents)}
                            onChange={(e) =>
                              updateStateDiscount(state as CampState, e.target.value)
                            }
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStateDiscount(state as CampState)}
                          className="btn-remove"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary ${validationErrors.length > 0 ? 'btn-disabled' : ''}`}
              disabled={validationErrors.length > 0}
            >
              {mode === "create" ? "Create Camp" : "Update Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampModal;
