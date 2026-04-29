import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * `/profile` resolves to the current user's profile page.
 * Guests get bounced to /auth so the dock's "Profile" pillar always means
 * "your profile" — not a generic profiles index.
 */
export const ProfileRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={`/profiles/${user.id}`} replace />;
};
