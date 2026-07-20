import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Tables from './pages/Tables';
import FoodDrinks from './pages/FoodDrinks';
import Analytics from './pages/Analytics';
import Bills from './pages/Bills';
import AuthPage from './pages/auth/AuthPage';

// Guard: redirects to /auth if not authenticated
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(59,130,246,0.2)',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/auth" replace />;
}

// Guard: redirects logged-in users away from /auth
function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) return null;

  return currentUser ? <Navigate to="/tables" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public — Auth */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />

      {/* Protected — Main App */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/tables" replace />} />
        <Route path="tables" element={<Tables />} />
        <Route path="food" element={<FoodDrinks />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="bills" element={<Bills />} />
        <Route path="expenses" element={<Navigate to="/analytics" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
