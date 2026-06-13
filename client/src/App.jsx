import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore.js';

import Loader from './components/Loader.jsx';

// Lazy load layouts and views to implement code splitting (Section 12 specifications)
const AppLayout = lazy(() => import('./layouts/AppLayout.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));

const LeadsPage = lazy(() => import('./pages/LeadsPage.jsx'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));

const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const AdminVerticalsPage = lazy(() => import('./pages/AdminVerticalsPage.jsx'));
const AdminFieldsPage = lazy(() => import('./pages/AdminFieldsPage.jsx'));
const AdminSubVerticalFieldsPage = lazy(() => import('./pages/AdminSubVerticalFieldsPage.jsx'));
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.jsx'));

// Loader spinner
const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen"
    style={{ background: 'linear-gradient(135deg, #faf7f2 0%, #f0e8dc 100%)' }}>
    <Loader />
  </div>
);

// Route Guard for authenticated users
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Route Guard for administrative permission checks
const PermissionRoute = ({ children, roleRequired }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;

  if (roleRequired === 'admin' && user.role !== 'super_admin' && user.role !== 'vertical_admin') {
    return <Navigate to="/leads" replace />;
  }

  if (roleRequired === 'super' && user.role !== 'super_admin') {
    return <Navigate to="/leads" replace />;
  }

  return children;
};

// Public Route Guard (prevents double-login access)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/leads" replace /> : children;
};

export const App = () => {
  const { isInitializing, initializeAuth } = useAuthStore();

  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#2d2520',
            border: '1px solid rgba(200,149,108,0.25)',
            borderRadius: '10px',
            fontSize: '13px',
            boxShadow: '0 4px 16px rgba(45,37,32,0.10)',
          },
          duration: 4000
        }}
      />
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public Authentication routes */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/forgot-password" element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            } />
            <Route path="/reset-password/:token" element={
              <PublicRoute>
                <ResetPasswordPage />
              </PublicRoute>
            } />

            {/* Protected Dashboard Layout workspace */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              {/* Redirect root path to leads */}
              <Route index element={<Navigate to="/leads" replace />} />

              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<LeadDetailPage />} />

              <Route path="reports" element={<ReportsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="follow-ups" element={<FollowUpsPage />} />

              {/* Admin Scoped views */}
              <Route path="admin/dashboard" element={
                <PermissionRoute roleRequired="admin">
                  <AdminDashboardPage />
                </PermissionRoute>
              } />
              <Route path="admin/users" element={
                <PermissionRoute roleRequired="admin">
                  <AdminUsersPage />
                </PermissionRoute>
              } />
              <Route path="admin/verticals" element={
                <PermissionRoute roleRequired="admin">
                  <AdminVerticalsPage />
                </PermissionRoute>
              } />
              <Route path="admin/verticals/:id/fields" element={
                <PermissionRoute roleRequired="admin">
                  <AdminFieldsPage />
                </PermissionRoute>
              } />
              <Route path="admin/sub-verticals/:subVerticalId/fields" element={
                <PermissionRoute roleRequired="admin">
                  <AdminSubVerticalFieldsPage />
                </PermissionRoute>
              } />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/leads" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

export default App;
