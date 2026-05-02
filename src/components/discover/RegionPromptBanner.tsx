/**
 * RegionPromptBanner — soft nudge shown on Discover when a logged-in user
 * hasn't set their region_code yet. Helps them appear on the globe.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "rhozeland.region-prompt.dismissed";

const RegionPromptBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1",
  );

  const { data: profile } = useQuery({
    enabled: !!user,
    queryKey: ["region-prompt", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("region_code")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!user || dismissed || profile?.region_code) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-foreground/80">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Add your region</p>
        <p className="text-xs text-muted-foreground">
          Tag where you create from so fans can find you on the globe.
        </p>
      </div>
      <Link
        to="/settings?module=profile"
        className="hidden sm:inline-flex items-center gap-1 rounded-full bg-foreground text-background text-xs font-semibold px-3 py-1.5 hover:gap-1.5 transition-all"
      >
        Set region <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default RegionPromptBanner;
