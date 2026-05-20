import { useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const creatorId = params.get("creator");

  useEffect(() => {
    // Webhook is async; give it a moment then bounce to subscriptions page.
    const t = setTimeout(() => {
      navigate(creatorId ? `/profile/${creatorId}` : "/subscriptions", { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [navigate, creatorId]);

  if (!sessionId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">No checkout session found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/discover">Back to Discover</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
      </div>
      <h1 className="font-display text-2xl">You're in.</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Your subscription is being activated. We're taking you back to the creator's profile.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Activating…
      </div>
      <Button asChild size="sm" variant="ghost">
        <Link to="/subscriptions">
          View my subscriptions <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
