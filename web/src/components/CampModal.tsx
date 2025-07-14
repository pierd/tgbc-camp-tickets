import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useIsAdmin, useFirebaseQuery, queryT, orderByT } from '../firebaseHooks';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DbCollections, type DbCamp, CampState, Currency, campStateDisplayName } from 'shared';

interface CampModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  campToEdit?: DbCamp & { id: string };
}

const CampModal: React.FC<CampModalProps> = ({ isOpen, onClose, mode, campToEdit }) => {
  const [formData, setFormData] = useState({
    name: '',
    country: 'Australia',
    state: CampState.auNSW,
    currency: Currency.AUD,
    initialInstallmentCents: 0,
    installmentCents: 0,
    totalCostCents: 0,
    outOfStateRebateCents: 0,
    inStateExtraCostCents: 0,
  });

  // Helper function to convert integer dollars to cents
  const dollarsToCents = (dollars: string): number => {
    const num = parseInt(dollars) || 0;
    return num * 100;
  };

  // Helper function to convert cents to integer dollars
  const centsToDollars = (cents: number): string => {
    return Math.floor(cents / 100).toString();
  };

  // Initialize form data when editing
  useEffect(() => {
    if (mode === 'edit' && campToEdit) {
      const country = campToEdit.state.startsWith('au') ? 'Australia' : 'US';
      setFormData({
        name: campToEdit.name,
        country,
        state: campToEdit.state,
        currency: campToEdit.currency,
        initialInstallmentCents: campToEdit.initialInstallmentCents,
        installmentCents: campToEdit.installmentCents,
        totalCostCents: campToEdit.totalCostCents,
        outOfStateRebateCents: campToEdit.outOfStateRebateCents,
        inStateExtraCostCents: campToEdit.inStateExtraCostCents,
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        country: 'Australia',
        state: CampState.auNSW,
        currency: Currency.AUD,
        initialInstallmentCents: 0,
        installmentCents: 0,
        totalCostCents: 0,
        outOfStateRebateCents: 0,
        inStateExtraCostCents: 0,
      });
    }
  }, [mode, campToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const campData = {
        name: formData.name,
        state: formData.state,
        currency: formData.currency,
        initialInstallmentCents: formData.initialInstallmentCents,
        installmentCents: formData.installmentCents,
        totalCostCents: formData.totalCostCents,
        outOfStateRebateCents: formData.outOfStateRebateCents,
        inStateExtraCostCents: formData.inStateExtraCostCents,
      };

      if (mode === 'create') {
        const now = Timestamp.now();
        await addDoc(collection(db, DbCollections.camps), {
          ...campData,
          createdAt: now,
          updatedAt: now,
        });
      } else if (mode === 'edit' && campToEdit) {
        const campRef = doc(db, DbCollections.camps, campToEdit.id);
        await updateDoc(campRef, {
          ...campData,
          updatedAt: Timestamp.now(),
        });
      }

      onClose();
    } catch (error) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} camp:`, error);
      alert(`Failed to ${mode === 'create' ? 'create' : 'update'} camp. Please try again.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Add New Camp' : 'Edit Camp'}</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="camp-form">
          <div className="form-group">
            <label htmlFor="name">Camp Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                const newState = newCountry === 'Australia' ? CampState.auNSW : CampState.usAK;
                setFormData({
                  ...formData,
                  country: newCountry,
                  state: newState,
                  currency: newCountry === 'Australia' ? Currency.AUD : Currency.USD
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
              onChange={(e) => setFormData({ ...formData, state: e.target.value as CampState })}
              required
            >
              {Object.entries(campStateDisplayName)
                .filter(([key]) => {
                  if (formData.country === 'Australia') {
                    return key.startsWith('au');
                  } else {
                    return key.startsWith('us');
                  }
                })
                .map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
              required
            >
              <option value={Currency.AUD}>AUD</option>
              <option value={Currency.USD}>USD</option>
              <option value={Currency.EURO}>EUR</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="initialInstallment">Initial Installment</label>
              <div className="money-input">
                <span className="currency-symbol">{formData.currency === Currency.USD ? '$' : formData.currency === Currency.EURO ? '€' : 'A$'}</span>
                <input
                  id="initialInstallment"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.initialInstallmentCents)}
                  onChange={(e) => setFormData({ ...formData, initialInstallmentCents: dollarsToCents(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="installmentAmount">Installment Amount</label>
              <div className="money-input">
                <span className="currency-symbol">{formData.currency === Currency.USD ? '$' : formData.currency === Currency.EURO ? '€' : 'A$'}</span>
                <input
                  id="installmentAmount"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.installmentCents)}
                  onChange={(e) => setFormData({ ...formData, installmentCents: dollarsToCents(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="totalCost">Total Cost</label>
            <div className="money-input">
              <span className="currency-symbol">{formData.currency === Currency.USD ? '$' : formData.currency === Currency.EURO ? '€' : 'A$'}</span>
              <input
                id="totalCost"
                type="number"
                min="0"
                value={centsToDollars(formData.totalCostCents)}
                onChange={(e) => setFormData({ ...formData, totalCostCents: dollarsToCents(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="outOfStateRebate">Out of State Rebate</label>
              <div className="money-input">
                <span className="currency-symbol">{formData.currency === Currency.USD ? '$' : formData.currency === Currency.EURO ? '€' : 'A$'}</span>
                <input
                  id="outOfStateRebate"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.outOfStateRebateCents)}
                  onChange={(e) => setFormData({ ...formData, outOfStateRebateCents: dollarsToCents(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="inStateExtraCost">In State Extra Cost</label>
              <div className="money-input">
                <span className="currency-symbol">{formData.currency === Currency.USD ? '$' : formData.currency === Currency.EURO ? '€' : 'A$'}</span>
                <input
                  id="inStateExtraCost"
                  type="number"
                  min="0"
                  value={centsToDollars(formData.inStateExtraCostCents)}
                  onChange={(e) => setFormData({ ...formData, inStateExtraCostCents: dollarsToCents(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {mode === 'create' ? 'Create Camp' : 'Update Camp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampModal;
