import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collectionT, useIsAdmin, useStreamDocumentById } from "../firebaseHooks";
import { DbCollections, type DbProfile } from "shared";

export type ShowLink = "dashboard" | "admin";

export const DashboardHeader = ({ title, showLink, children }: { title: string; showLink?: ShowLink; children?: React.ReactNode }) => {
  const { currentUser, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const profile = useStreamDocumentById(
    collectionT<DbProfile>(DbCollections.profiles),
    currentUser?.uid
  ).value?.data();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <header className="dashboard-header">
        <img
          src="/TGBC_Logo_Transparent_PNG_2024.png"
          alt="TGBC Logo"
          style={{
            height: "80px",
            width: "auto",
            objectFit: "contain",
            display: "block",
            margin: 0,
            padding: 0,
          }}
        />
        <h1>{title}</h1>
        <div className="user-info">
          <span>Welcome, {profile?.name || currentUser?.email}</span>
          {showLink === "dashboard" && (
            <Link to="/" className="nav-link">
              Dashboard
            </Link>
          )}
          {isAdmin && showLink === "admin" && (
            <Link to="/admin" className="nav-link">
              Admin
            </Link>
          )}
          {children}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>
  );
}
