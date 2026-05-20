import { useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SubscribeToCreatorSheet from "@/components/profile/SubscribeToCreatorSheet";

interface SubscriberLockProps {
  /** The creator whose subscription is required to unlock the content. */
  creatorId: string;
  /** Creator display name + handle for the upsell card. */
  creatorName?: string | null;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  /** Optional minimum tier slug ("creator_sub_basic" | "creator_sub_standard" | "creator_sub_premium"). */
  minTier?: string;
  /** Short label for what's locked. e.g. "private post", "DM thread". */
  unlockLabel?: string;
  /** Content shown when the viewer IS subscribed. */
  children: React.ReactNode;
  /** If true, the creator viewing their own content always sees `children`. Default true. */
  bypassForOwner?: boolean;
}

/**
 * Subscriber-only content gate.
 *
 * v10: subscriptions are the spine. Wrap any private feed post, DM thread,
 * behind-the-scenes work, etc. with `<SubscriberLock creatorId={...}>` and
 * non-subscribers see a tasteful upsell that opens `<SubscribeToCreatorSheet />`.
 *
 * Access check uses the `is_subscribed_to(_creator_id, _min_tier)` RPC which
 * honors Stripe's `cancel_at_period_end=true` rule — canceled subscribers keep
 * access until `current_period_end`.
 */
export function SubscriberLock({
  creatorId,
  creatorName,
  creatorUsername,
  creatorAvatar,
  minTier,
  unlockLabel = "this",
  children,
  bypassForOwner = true,
}: SubscriberLockProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "subscribed" | "locked">("loading");
  const [sheetOpen, setSheetOpen] = useState(false);

  const isOwner = bypassForOwner && user?.id === creatorId;

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setStatus("locked");
      return;
    }
    if (isOwner) {
      setStatus("subscribed");
      return;
    }
    setStatus("loading");
    supabase
      .rpc("is_subscribed_to", {
        _creator_id: creatorId,
        ...(minTier ? { _min_tier: minTier } : {}),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[SubscriberLock] is_subscribed_to failed", error);
          setStatus("locked");
          return;
        }
        setStatus(data === true ? "subscribed" : "locked");
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId, minTier, user?.id, isOwner]);

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/20 p-6 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted/40" />
      </div>
    );
  }

  if (status === "subscribed") return <>{children}</>;

  const displayName = creatorName || creatorUsername || "this creator";

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Subscribers-only {unlockLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Subscribe to <span className="font-medium text-foreground">{displayName}</span>{" "}
              from $5/mo to unlock this and everything else behind their paywall.
            </p>
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setSheetOpen(true)}
              disabled={!user?.id}
            >
              <Sparkles className="h-4 w-4" />
              {user?.id ? "Subscribe to unlock" : "Sign in to subscribe"}
            </Button>
          </div>
        </div>
      </div>

      <SubscribeToCreatorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        creatorId={creatorId}
        creatorName={creatorName ?? undefined}
        creatorUsername={creatorUsername ?? undefined}
        creatorAvatar={creatorAvatar ?? undefined}
      />
    </>
  );
}
