import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './views/Login';
import Register from './views/Register';
import DashboardLayout from './views/DashboardLayout';
import LeadsView from './views/LeadsView';
import VerticalConfigsView from './views/VerticalConfigsView';
import UsersView from './views/UsersView';
import AuditLogsView from './views/AuditLogsView';

// Route protection guard for authenticated users
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-deep)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Route protection guard for admin-only pages
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-deep)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'super_admin' && user.role !== 'vertical_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Route guard for public login route
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-deep)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />

          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />

          {/* Protected Dashboard Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Scoped Child Views */}
            <Route index element={<LeadsView />} />
            
            <Route path="configs" element={
              <AdminRoute>
                <VerticalConfigsView />
              </AdminRoute>
            } />
            
            <Route path="users" element={
              <AdminRoute>
                <UsersView />
              </AdminRoute>
            } />
            
            <Route path="audit-logs" element={
              <AdminRoute>
                <AuditLogsView />
              </AdminRoute>
            } />
          </Route>

          {/* Catch-all fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
