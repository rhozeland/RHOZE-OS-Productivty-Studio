import { Navigate, useParams } from "react-router-dom";
import { EventNotFound } from "@/components/events/EventNotFound";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LegacyEventRedirect = ({ manage = false }: { manage?: boolean }) => {
  const { id } = useParams();
  if (!id || !UUID_RE.test(id)) {
    return (
      <EventNotFound
        title="Invalid event link"
        message="That URL doesn't point to a real event ID."
        badId={id}
      />
    );
  }
  return <Navigate to={`/spaces/events/${id}${manage ? "/manage" : ""}`} replace />;
};

export default LegacyEventRedirect;
