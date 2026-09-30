import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { PageSpinner } from './components/ui';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/auth/PasswordPages';
import { DashboardPage } from './pages/DashboardPage';
import { FarmsPage } from './pages/farms/FarmsPage';
import { FarmFormPage } from './pages/farms/FarmFormPage';
import { FarmDetailPage } from './pages/farms/FarmDetailPage';
import { AnalysisDetailPage } from './pages/AnalysisDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { BillingPage } from './pages/BillingPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminFarmsPage } from './pages/admin/AdminFarmsPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminSubscriptionsPage } from './pages/admin/AdminSubscriptionsPage';
import { AdminPlansPage } from './pages/admin/AdminPlansPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
}

function NotFoundPage() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-5xl">🛰️</p>
      <h1 className="text-xl font-bold">Page not found</h1>
      <a href="/dashboard" className="text-sm text-brand-600 hover:underline">
        Back to dashboard
      </a>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/farms" element={<FarmsPage />} />
        <Route path="/farms/new" element={<FarmFormPage />} />
        <Route path="/farms/:farmId" element={<FarmDetailPage />} />
        <Route path="/farms/:farmId/edit" element={<FarmFormPage />} />
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/farms"
          element={
            <RequireAdmin>
              <AdminFarmsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <RequireAdmin>
              <AdminPaymentsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/subscriptions"
          element={
            <RequireAdmin>
              <AdminSubscriptionsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/plans"
          element={
            <RequireAdmin>
              <AdminPlansPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
