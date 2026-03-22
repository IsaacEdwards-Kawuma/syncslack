import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Workspace from './pages/Workspace.jsx';

function Private({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
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
      <Route
        path="/*"
        element={
          <Private>
            <SocketProvider>
              <Workspace />
            </SocketProvider>
          </Private>
        }
      />
    </Routes>
  );
}
