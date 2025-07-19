import React from "react";
import { doc, DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { campStateDisplayName, DbCollections, type DbProfile } from "shared";
import { useStreamDocument } from "../firebaseHooks";

interface ParticipantProfileProps {
  userId: string;
}

export const ParticipantProfile: React.FC<ParticipantProfileProps> = ({ userId }) => {
  // Get profile details
  const profileRef = doc(db, DbCollections.profiles, userId) as DocumentReference<
    DbProfile,
    DbProfile
  >;
  const profileData = useStreamDocument<DbProfile, DbProfile>(profileRef);

  if (profileData.status === "loading") {
    return <div className="profile-loading">Loading profile...</div>;
  }

  if (profileData.status === "error") {
    return <div className="profile-error">Profile not found</div>;
  }

  const profile = profileData.value?.data();
  if (!profile) {
    return <div className="profile-not-found">No profile data</div>;
  }

  return (
    <div className="participant-profile">
      <div className="profile-info">
        <div className="profile-name">
          <strong>Name:</strong> {profile.name}
        </div>
        <div className="profile-default-state">
          <strong>Default State:</strong> {campStateDisplayName[profile.defaultCampState]}
        </div>
      </div>
    </div>
  );
};
