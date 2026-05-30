import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SubscribeToCreatorSheet from "@/components/profile/SubscribeToCreatorSheet";
import TokenGateConnectSheet from "@/components/profile/TokenGateConnectSheet";
import { useTokenGateAccess } from "@/hooks/useTokenGateAccess";

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
 * Subscriber-or-token-holder content gate.
 *
 * Access granted if:
 *   - viewer is the owner (bypassForOwner), or
 *   - viewer has an active subscription to the creator (is_subscribed_to RPC), or
 *   - viewer holds the creator's pump.fun token (creator_token_grants, Pillar 2).
 *
 * When locked AND the creator has an approved pump.fun token linked, the
 * upsell card surfaces two paths: subscribe ($5/mo) or hold $TICKER.
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
  const [subStatus, setSubStatus] = useState<"loading" | "subscribed" | "locked">("loading");
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);

  const isOwner = bypassForOwner && user?.id === creatorId;

  const { hasAccess: holdsToken, isLoading: tokenLoading } = useTokenGateAccess(
    isOwner ? null : creatorId,
  );

  // Look up creator's approved pump.fun token (if any) to offer the
  // token-holder unlock path inside the upsell card.
  const { data: creatorToken } = useQuery({
    queryKey: ["subscriber-lock-creator-token", creatorId],
    enabled: !isOwner,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_mint_address, token_ticker, token_submission_status")
        .eq("id", creatorId)
        .maybeSingle();
      if (!data?.token_mint_address) return null;
      if (data.token_submission_status && data.token_submission_status !== "approved") return null;
      return { mint: data.token_mint_address, ticker: data.token_ticker as string | null };
    },
  });

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setSubStatus("locked");
      return;
    }
    if (isOwner) {
      setSubStatus("subscribed");
      return;
    }
    setSubStatus("loading");
    supabase
      .rpc("is_subscribed_to", {
        _creator_id: creatorId,
        ...(minTier ? { _min_tier: minTier } : {}),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[SubscriberLock] is_subscribed_to failed", error);
          setSubStatus("locked");
          return;
        }
        setSubStatus(data === true ? "subscribed" : "locked");
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId, minTier, user?.id, isOwner]);

  if (subStatus === "loading" || tokenLoading) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/20 p-6 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted/40" />
      </div>
    );
  }

  if (subStatus === "subscribed" || holdsToken) {
    return (
      <>
        {holdsToken && subStatus !== "subscribed" && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Coins className="h-3 w-3" />
            Unlocked by holding ${creatorToken?.ticker || "TOKEN"}
          </div>
        )}
        {children}
      </>
    );
  }

  const displayName = creatorName || creatorUsername || "this creator";
  const hasTokenPath = !!creatorToken;

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
              from $5/mo
              {hasTokenPath ? ", or unlock for free by holding " : " to unlock this"}
              {hasTokenPath && (
                <span className="font-medium text-foreground">
                  ${creatorToken?.ticker || "their token"}
                </span>
              )}
              {hasTokenPath ? " in your wallet." : "."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setSubSheetOpen(true)}
                disabled={!user?.id}
              >
                <Sparkles className="h-4 w-4" />
                {user?.id ? "Subscribe to unlock" : "Sign in to subscribe"}
              </Button>
              {hasTokenPath && user?.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setTokenSheetOpen(true)}
                >
                  <Coins className="h-4 w-4" />
                  Hold ${creatorToken?.ticker || "TOKEN"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <SubscribeToCreatorSheet
        open={subSheetOpen}
        onOpenChange={setSubSheetOpen}
        creatorId={creatorId}
        creatorName={creatorName ?? creatorUsername ?? undefined}
      />

      {hasTokenPath && (
        <TokenGateConnectSheet
          open={tokenSheetOpen}
          onOpenChange={setTokenSheetOpen}
          creatorId={creatorId}
          creatorName={creatorName ?? creatorUsername ?? undefined}
          ticker={creatorToken?.ticker}
        />
      )}
    </>
  );
}
