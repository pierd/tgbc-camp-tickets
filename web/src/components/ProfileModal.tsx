import React, { useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  DbCollections,
  type DbProfile,
  CampState,
  campStateDisplayName,
} from "shared";
import { useAuth } from "../contexts/AuthContext";

interface ProfileModalProps {
  isOpen: boolean;
  onProfileComplete: () => void;
}

export default function ProfileModal({
  isOpen,
  onProfileComplete,
}: ProfileModalProps) {
  const { currentUser } = useAuth();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Australia");
  const [defaultCampState, setDefaultCampState] = useState<CampState>(
    CampState.auNSW
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!currentUser?.uid) {
      setError("User not authenticated");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const profileData: Omit<DbProfile, "createdAt" | "updatedAt"> = {
        name: name.trim(),
        defaultCampState,
      };

      await setDoc(doc(db, DbCollections.profiles, currentUser.uid), {
        ...profileData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      onProfileComplete();
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay profile-modal-overlay">
      <div className="modal-content profile-modal-content">
        <div className="modal-header">
          <h2>Complete Your Profile</h2>
          <p>Please provide your information to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="country">Country</label>
            <select
              id="country"
              value={country}
              onChange={(e) => {
                const newCountry = e.target.value;
                const newState =
                  newCountry === "Australia" ? CampState.auNSW : CampState.usAK;
                setCountry(newCountry);
                setDefaultCampState(newState);
              }}
              disabled={loading}
            >
              <option value="Australia">Australia</option>
              <option value="US">United States</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="defaultCampState">State/Province</label>
            <select
              id="defaultCampState"
              value={defaultCampState}
              onChange={(e) => setDefaultCampState(e.target.value as CampState)}
              disabled={loading}
            >
              {Object.entries(campStateDisplayName)
                .filter(([key]) => {
                  if (country === "Australia") {
                    return key.startsWith("au");
                  } else {
                    return key.startsWith("us");
                  }
                })
                .map(([key, displayName]) => (
                  <option key={key} value={key}>
                    {displayName}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !name.trim()}
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
