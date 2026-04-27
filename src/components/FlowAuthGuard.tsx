import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Guards the /flow route. Logged-out visitors are redirected to
 * /explore/studios with a toast explaining that Flow Mode requires an
 * account. Authed users see the wrapped page as normal.
 */
export const FlowAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const toastedRef = useRef(false);

  useEffect(() => {
    if (!loading && !user && !toastedRef.current) {
      toastedRef.current = true;
      toast("Flow Mode is for members", {
        description: "Sign in to swipe, save, and post in Flow.",
      });
    }
  }, [loading, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/explore/studios" replace />;
  return <>{children}</>;
};

export default FlowAuthGuard;
