import { Link } from "react-router-dom";
import { ArrowLeft, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared empty/error state for event detail pages. Used by:
 *   - EventDetailPage when the lookup returns no row or errors out
 *   - LegacyEventRedirect when the URL param isn't a valid UUID
 *     (so we don't bounce the user into a doomed /spaces/events/:id load)
 */
export const EventNotFound = ({
  title = "Event not found",
  message = "This event may have been removed, or the link is invalid.",
  badId,
}: {
  title?: string;
  message?: string;
  badId?: string;
}) => (
  <div className="max-w-xl mx-auto py-20 px-4 text-center">
    <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mb-4">
      <CalendarX className="h-5 w-5 text-muted-foreground" />
    </div>
    <h1 className="font-display text-2xl font-bold mb-2">{title}</h1>
    <p className="text-sm text-muted-foreground mb-2">{message}</p>
    {badId ? (
      <p className="text-xs text-muted-foreground/70 mb-6 font-mono break-all">
        ID: {badId}
      </p>
    ) : (
      <div className="mb-6" />
    )}
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <Button
        variant="outline"
        onClick={() => window.history.back()}
        className="rounded-full gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" /> Go back
      </Button>
      <Button asChild className="rounded-full">
        <Link to="/discover?view=events">Browse events</Link>
      </Button>
    </div>
  </div>
);
