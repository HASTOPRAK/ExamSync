import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";

/**
 * Wraps a set of routes requiring authentication.
 * Optional `roles` prop restricts access to specific roles.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>...</Route>
 *   <Route element={<ProtectedRoute roles={["teacher","admin"]} />}>...</Route>
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still validating the stored token — render nothing to avoid flash
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // Logged in but wrong role — send to their home
    const home = user.role === "student" ? "/schedule" : "/";
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
