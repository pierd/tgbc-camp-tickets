import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useIsAdmin } from '../firebaseHooks';

export function Dashboard() {
  const { currentUser, logout } = useAuth();
  const isAdmin = useIsAdmin();

  console.log("currentUser.uid", currentUser?.uid);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {currentUser?.email}</span>
          {isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="placeholder">
          <h2>Welcome to your Dashboard!</h2>
          <p>This is a placeholder for your main dashboard content.</p>
          <p>You can add your app's main features here.</p>
        </div>
      </main>
    </div>
  );
}
