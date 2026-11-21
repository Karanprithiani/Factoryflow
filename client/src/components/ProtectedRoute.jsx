// ProtectedRoute.jsx — blocks pages from unauthorized users.
// If not logged in → redirect to /login.
// If logged in but wrong role → redirect to / (dashboard).

import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * allowedRoles is an array like ['admin', 'store'].
 * If omitted, any authenticated user can access the route.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
