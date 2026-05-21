/**
 * TicketCheckoutReturnPage — landing after Stripe Embedded Checkout completes.
 *
 * The webhook (payments-webhook → claim-event-ticket) is the source of truth
 * for issuing tickets — this page just confirms and routes the buyer back to
 * the event (or their newly issued ticket if signed in).
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const TicketCheckoutReturnPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const sessionId = params.get("session_id");
  const eventId = params.get("event_id");
  const [tries, setTries] = useState(0);

  // Poll for our ticket — webhook should land within a few seconds.
  const { data: ticket } = useQuery({
    queryKey: ["ticket-after-checkout", sessionId, user?.id, tries],
    enabled: !!sessionId && !!user,
    refetchInterval: ticketReadyInterval,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_tickets")
        .select("id")
        .eq("holder_id", user!.id)
        .eq("event_id", eventId!)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  useEffect(() => {
    if (!ticket) {
      const t = setTimeout(() => setTries((n) => n + 1), 2000);
      return () => clearTimeout(t);
    }
  }, [ticket]);

  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-5">
      <div className="inline-flex h-14 w-14 rounded-full bg-emerald-500/10 items-center justify-center">
        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-semibold">Payment received</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your ticket is being issued. We've also emailed a confirmation and
          sign-in link.
        </p>
      </div>
      {ticket ? (
        <Link to={`/tickets/${ticket}`}>
          <Button className="rounded-full gap-2">
            <Ticket className="h-4 w-4" /> View ticket
          </Button>
        </Link>
      ) : (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Issuing ticket…
        </div>
      )}
      {eventId && (
        <div>
          <Link
            to={`/spaces/events/${eventId}`}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Back to event
          </Link>
        </div>
      )}
    </div>
  );
};

const ticketReadyInterval = (q: any) => (q.state.data ? false : 2000);

export default TicketCheckoutReturnPage;
