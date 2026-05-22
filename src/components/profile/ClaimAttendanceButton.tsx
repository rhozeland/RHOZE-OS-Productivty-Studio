import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * v10.3 — phase-1 on-chain attendance claim.
 *
 * Honor system: a logged-in fan taps "I went" → row inserted into
 * `event_attendance_claims` → `claim-event-attendance` edge fn anchors a memo
 * TX on Solana and drops the standard event_attendance reward.
 *
 * Hides itself on the creator's own profile (you can't claim your own event).
 */
export function ClaimAttendanceButton({
  profileId,
  profileUserId,
  lumaUrl,
}: {
  profileId: string;
  profileUserId: string;
  lumaUrl: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Don't render the button on your own profile.
  const isOwn = user?.id === profileUserId;

  const { data: existing, isLoading } = useQuery({
    enabled: !!user && !isOwn,
    queryKey: ["attendance-claim", user?.id, lumaUrl],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_attendance_claims")
        .select("id, memo_signature, anchored_at")
        .eq("user_id", user!.id)
        .eq("luma_url", lumaUrl)
        .maybeSingle();
      return data;
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("claim-event-attendance", {
        body: { profile_id: profileId, luma_url: lumaUrl },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error && !(data as { pending?: boolean })?.pending) {
        throw new Error((data as { error: string }).error);
      }
      return data as { signature?: string; explorer?: string; pending?: boolean };
    },
    onSuccess: (r) => {
      if (r.signature) {
        toast.success("Attendance anchored on Solana — $RHOZE on the way ✨");
      } else {
        toast.success("Attendance recorded — anchoring shortly");
      }
      qc.invalidateQueries({ queryKey: ["attendance-claim"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't record attendance"),
  });

  if (isOwn || !user) return null;
  if (isLoading) {
    return (
      <Button size="sm" variant="outline" disabled className="h-8 text-xs">
        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Checking…
      </Button>
    );
  }

  if (existing?.memo_signature) {
    return (
      <a
        href={`https://solscan.io/tx/${existing.memo_signature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Attended · on-chain
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  }

  if (existing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Anchoring…
      </span>
    );
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" /> I went — claim on-chain
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={() => claim.mutate()}
        disabled={claim.isPending}
      >
        {claim.isPending ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Anchoring…
          </>
        ) : (
          "Confirm attendance"
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs text-muted-foreground"
        onClick={() => setOpen(false)}
        disabled={claim.isPending}
      >
        Cancel
      </Button>
    </div>
  );
}

export default ClaimAttendanceButton;
