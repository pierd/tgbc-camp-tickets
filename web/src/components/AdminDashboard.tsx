import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useIsAdmin } from '../firebaseHooks';

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <div>You are not authorized to access this page</div>;
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Welcome, {currentUser?.email}</p>
          </div>
          <div className="admin-nav">
            <Link to="/" className="nav-link">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <div className="admin-section">
          <h2>Camp Ticket Management</h2>
          <p>This is the admin dashboard for managing camp tickets.</p>

          <div className="admin-stats">
            <div className="stat-card">
              <h3>Total Tickets</h3>
              <p className="stat-number">0</p>
            </div>
            <div className="stat-card">
              <h3>Sold Tickets</h3>
              <p className="stat-number">0</p>
            </div>
            <div className="stat-card">
              <h3>Available Tickets</h3>
              <p className="stat-number">0</p>
            </div>
          </div>

          <div className="admin-actions">
            <button className="admin-btn">Create New Ticket Batch</button>
            <button className="admin-btn">View All Tickets</button>
            <button className="admin-btn">Export Data</button>
          </div>
        </div>
      </main>
    </div>
  );
};
