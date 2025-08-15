import React, { useState, useEffect, useCallback } from "react";
import {
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  collection,
  CollectionReference,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import type { Timestamp as TimestampType } from "@firebase/firestore-types";
import {
  DbCollections,
  type DbCamp,
  Currency,
  type DbPromoCode,
  sanitizePromoCode,
} from "shared";
import { collectionT, queryT, useFirebaseQuery } from "../firebaseHooks";

function CurrencySymbol({ currency }: { currency: Currency }) {
  return <span className="currency-symbol">
    {currency === Currency.USD
      ? "$"
      : currency === Currency.EURO
      ? "€"
      : "A$"}
  </span>
}

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
  const campRef = campToEdit ? doc(collectionT<DbCamp>(DbCollections.camps), campToEdit.id) : undefined;
  const promoCodesRef = campRef ? collection(campRef, DbCollections.promoCodes) as CollectionReference<DbPromoCode, DbPromoCode> : undefined;
  const promoCodes = useFirebaseQuery(promoCodesRef ? queryT(promoCodesRef) : undefined);

  const [formData, setFormData] = useState({
    name: "",
    currency: Currency.AUD,
    initialInstallmentCents: 0,
    installmentCents: 0,
    baseCostCents: 0,
    discountCentsPerLocation: {} as Record<string, number>,
    lastInstallmentDeadline: "",
    promoCodeDiscountCents: {} as Record<string, number>,
  });

  const [newLocationToAdd, setNewLocationToAdd] = useState<string | "">("");
  const [newPromoCodeToAdd, setNewPromoCodeToAdd] = useState<string | "">("");
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
  const timestampToDateString = (timestamp: Timestamp | TimestampType | undefined): string => {
    if (!timestamp) {
      return "";
    }
    const date = timestamp.toDate();
    return date.toISOString().split("T")[0];
  };

  // Helper function to convert date string to Timestamp
  const dateStringToTimestamp = (dateString: string): Timestamp => {
    const date = new Date(dateString);
    return Timestamp.fromDate(date);
  };

  // Validation function
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    // Check if any discount is bigger than base cost
    for (const [location, discountCents] of (Object.entries(formData.discountCentsPerLocation) as [string, number][])) {
      if (discountCents > formData.baseCostCents) {
        errors.push(`Discount for "${location}" cannot be larger than base cost`);
      }
    }

    // For every discount: (base minus discount minus initial installment) must be divisible by installment amount
    for (const [location, discountCents] of (Object.entries(formData.discountCentsPerLocation) as [string, number][])) {
      const remainingAmount = formData.baseCostCents - discountCents - formData.initialInstallmentCents;
      if (remainingAmount >= 0 && remainingAmount % formData.installmentCents !== 0) {
        errors.push(`For "${location}": remaining amount after discount and initial installment (${centsToDollars(remainingAmount)}) must be divisible by installment amount (${centsToDollars(formData.installmentCents)})`);
      }
    }

    return errors;
  }, [formData]);

  // Update validation errors when form data changes
  useEffect(() => {
    const errors = validateForm();
    setValidationErrors(errors);
  }, [formData, validateForm]);

  // Initialize form data when editing
  useEffect(() => {
    if (mode === "edit" && campToEdit) {
      setFormData({
        name: campToEdit.name,
        currency: campToEdit.currency,
        initialInstallmentCents: campToEdit.initialInstallmentCents,
        installmentCents: campToEdit.installmentCents,
        baseCostCents: campToEdit.baseCostCents,
        discountCentsPerLocation: campToEdit.discountCentsPerLocation,
        lastInstallmentDeadline: timestampToDateString(
          campToEdit.lastInstallmentDeadline
        ),
        promoCodeDiscountCents: promoCodes.reduce((acc, promoCodeDoc) => {
          const promoCode = promoCodeDoc.data();
          return {
            ...acc,
            [promoCodeDoc.id]: promoCode.discountCents,
          };
        }, {} as Record<string, number>),
      });
    } else if (mode === "create") {
      // Reset form for create mode
      setFormData({
        name: "",
        currency: Currency.AUD,
        initialInstallmentCents: 0,
        installmentCents: 0,
        baseCostCents: 0,
        discountCentsPerLocation: {},
        lastInstallmentDeadline: "",
        promoCodeDiscountCents: {},
      });
    }
  }, [mode, campToEdit, promoCodes]);

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
        currency: formData.currency,
        initialInstallmentCents: formData.initialInstallmentCents,
        installmentCents: formData.installmentCents,
        baseCostCents: formData.baseCostCents,
        discountCentsPerLocation: formData.discountCentsPerLocation,
        lastInstallmentDeadline: formData.lastInstallmentDeadline
          ? dateStringToTimestamp(formData.lastInstallmentDeadline)
          : Timestamp.now(),
      };

      const promises: Promise<void>[] = [];
      if (mode === "create") {
        const now = Timestamp.now();
        const campRef = await addDoc(collectionT<DbCamp>(DbCollections.camps), {
          ...campData,
          createdAt: now,
          updatedAt: now,
        });
        // add promo codes
        const promoCodesRef = collection(campRef, DbCollections.promoCodes) as CollectionReference<DbPromoCode, DbPromoCode>;
        for (const [promoCodeId, discountCents] of Object.entries(formData.promoCodeDiscountCents)) {
          promises.push(setDoc(doc(promoCodesRef, promoCodeId), { discountCents }));
        }
        // delete removed promo codes
        promoCodes.forEach((promoCodeDoc) => {
          if (!formData.promoCodeDiscountCents[promoCodeDoc.id]) {
            promises.push(deleteDoc(doc(promoCodesRef, promoCodeDoc.id)));
          }
        });
      } else if (mode === "edit" && campToEdit && campRef && promoCodesRef) {
        await updateDoc(campRef, {
          ...campData,
          updatedAt: Timestamp.now(),
        });
        // add promo codes
        for (const [promoCodeId, discountCents] of Object.entries(formData.promoCodeDiscountCents)) {
          promises.push(setDoc(doc(promoCodesRef, promoCodeId), { discountCents }));
        }
        // delete removed promo codes
        promoCodes.forEach((promoCodeDoc) => {
          if (!formData.promoCodeDiscountCents[promoCodeDoc.id]) {
            promises.push(deleteDoc(doc(promoCodesRef, promoCodeDoc.id)));
          }
        });
      }
      await Promise.all(promises);

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

  const addLocationDiscount = () => {
    if (newLocationToAdd && !formData.discountCentsPerLocation[newLocationToAdd]) {
      setFormData({
        ...formData,
        discountCentsPerLocation: {
          ...formData.discountCentsPerLocation,
          [newLocationToAdd]: 0,
        },
      });
      setNewLocationToAdd("");
    }
  };

  const removeLocationDiscount = (location: string) => {
    const newDiscounts = { ...formData.discountCentsPerLocation };
    delete newDiscounts[location];
    setFormData({
      ...formData,
      discountCentsPerLocation: newDiscounts,
    });
  };

  const updateLocationDiscount = (location: string, value: string) => {
    setFormData({
      ...formData,
      discountCentsPerLocation: {
        ...formData.discountCentsPerLocation,
        [location]: dollarsToCents(value),
      },
    });
  };

  const addPromoCodeDiscount = () => {
    if (newPromoCodeToAdd && !formData.promoCodeDiscountCents[newPromoCodeToAdd]) {
      setFormData({
        ...formData,
        promoCodeDiscountCents: {
          ...formData.promoCodeDiscountCents,
          [newPromoCodeToAdd]: 0,
        },
      });
      setNewPromoCodeToAdd("");
    }
  };

  const removePromoCodeDiscount = (promoCodeId: string) => {
    const newDiscounts = { ...formData.promoCodeDiscountCents };
    delete newDiscounts[promoCodeId];
    setFormData({
      ...formData,
      promoCodeDiscountCents: newDiscounts,
    });
  };

  const updatePromoCodeDiscount = (promoCodeId: string, value: string) => {
    setFormData({
      ...formData,
      promoCodeDiscountCents: {
        ...formData.promoCodeDiscountCents,
        [promoCodeId]: dollarsToCents(value),
      },
    });
  };

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
                <CurrencySymbol currency={formData.currency} />
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
            </div>

            <div className="form-group">
              <label htmlFor="installmentAmount">Installment Amount</label>
              <div className="money-input">
                <CurrencySymbol currency={formData.currency} />
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
              <CurrencySymbol currency={formData.currency} />
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
            <label>Location Discounts</label>
            <div className="discounts-section">
              <div className="add-discount-section">
                <input
                  type="text"
                  value={newLocationToAdd}
                  onChange={(e) => setNewLocationToAdd(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addLocationDiscount}
                  disabled={!newLocationToAdd}
                  className="btn-secondary"
                >
                  Add Discount
                </button>
              </div>

              {Object.entries(formData.discountCentsPerLocation).length > 0 && (
                <div className="discounts-list">
                  {Object.entries(formData.discountCentsPerLocation).map(
                    ([location, discountCents]) => (
                      <div key={location} className="discount-item-row">
                        <div className="discount-location">
                          {location}
                        </div>
                        <div className="money-input">
                          <CurrencySymbol currency={formData.currency} />
                          <input
                            type="number"
                            min="0"
                            value={centsToDollars(discountCents)}
                            onChange={(e) =>
                              updateLocationDiscount(location, e.target.value)
                            }
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLocationDiscount(location)}
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

          <div className="form-group">
            <label>Promo Code Discounts</label>
            <div className="discounts-section">
              <div className="add-discount-section">
                <input
                  type="text"
                  value={newPromoCodeToAdd}
                  onChange={(e) => setNewPromoCodeToAdd(sanitizePromoCode(e.target.value))}
                />
                <button
                  type="button"
                  onClick={addPromoCodeDiscount}
                  disabled={!newPromoCodeToAdd}
                  className="btn-secondary"
                >
                  Add Promo Code
                </button>
              </div>

              {Object.entries(formData.promoCodeDiscountCents).length > 0 && (
                <div className="discounts-list">
                  {Object.entries(formData.promoCodeDiscountCents).map(
                    ([promoCodeId, discountCents]) => (
                      <div key={promoCodeId} className="discount-item-row">
                        <div className="discount-promo-code">
                          {promoCodeId}
                        </div>
                        <div className="money-input">
                          <CurrencySymbol currency={formData.currency} />
                          <input
                            type="number"
                            min="0"
                            value={centsToDollars(discountCents)}
                            onChange={(e) =>
                              updatePromoCodeDiscount(promoCodeId, e.target.value)
                            }
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePromoCodeDiscount(promoCodeId)}
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
