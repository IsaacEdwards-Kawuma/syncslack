import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Workspace from './pages/Workspace.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFound from './pages/NotFound.jsx';
import HelpPage from './pages/HelpPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';

function Private() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-violet-50/40 to-slate-100 dark:from-slate-950 dark:via-violet-950/30 dark:to-slate-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(139, 92, 246, 0.15), transparent), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(99, 102, 241, 0.1), transparent)',
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl motion-safe:animate-pulse" />
            <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600 dark:border-violet-400/25 dark:border-t-violet-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 motion-safe:animate-pulse dark:text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={loading ? null : isAuthenticated ? <Navigate to="/" replace /> : <Register />}
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/" element={<Private />}>
        <Route element={<AppLayout />}>
          <Route index element={<SocketProvider><Workspace /></SocketProvider>} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
