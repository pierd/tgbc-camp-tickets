import type { Timestamp } from "@firebase/firestore-types";

export function formatDate(timestamp: Timestamp | undefined) {
  if (!timestamp) {
    return "N/A";
  }
  return timestamp.toDate().toLocaleDateString();
}
