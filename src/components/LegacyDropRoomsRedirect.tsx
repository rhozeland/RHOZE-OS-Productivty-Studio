import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Redirects any legacy `/droprooms/*` path to its canonical `/drop-rooms/*`
 * counterpart, preserving sub-paths, search params, and hash so deep links
 * (and the `:id` route) survive the rewrite. Resolved BEFORE any component
 * evaluates active-link styling because React Router matches this route
 * and immediately issues a `<Navigate replace />`.
 */
export const LegacyDropRoomsRedirect = () => {
  const { "*": rest } = useParams();
  const { search, hash } = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return <Navigate to={`/drop-rooms${suffix}${search}${hash}`} replace />;
};
