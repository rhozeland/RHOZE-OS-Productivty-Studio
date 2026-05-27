/**
 * AdminTokenSubmissions — review pending creator token (pump.fun) submissions.
 *
 * Lists profiles with token_submission_status='pending' and lets an admin
 * approve (promotes shadow → live) or reject (with optional note) via the
 * `review_token_submission` RPC.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, Coins } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  token_mint_address: string | null;
  token_ticker: string | null;
  token_mint_address_pending: string | null;
  token_ticker_pending: string | null;
  token_submitted_at: string | null;
};

const AdminTokenSubmissions = () => {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-token-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,user_id,display_name,username,avatar_url,token_mint_address,token_ticker,token_mint_address_pending,token_ticker_pending,token_submitted_at",
        )
        .eq("token_submission_status", "pending")
        .order("token_submitted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const review = async (userId: string, approve: boolean) => {
    setBusy(userId);
    try {
      const { error } = await (supabase as any).rpc("review_token_submission", {
        _user_id: userId,
        _approve: approve,
        _note: notes[userId]?.trim() || null,
      });
      if (error) throw error;
      toast.success(approve ? "Token approved · now live." : "Submission rejected.");
      setNotes((n) => ({ ...n, [userId]: "" }));
      qc.invalidateQueries({ queryKey: ["admin-token-submissions"] });
    } catch (e: any) {
      toast.error(e.message || "Review failed");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-10 text-center">
        <Coins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No pending token submissions</p>
        <p className="text-xs text-muted-foreground">
          When Verified Artists link a pump.fun token, they'll show up here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const name = r.display_name || r.username || "Creator";
        const pumpUrl = r.token_mint_address_pending
          ? `https://pump.fun/coin/${r.token_mint_address_pending}`
          : null;
        return (
          <div
            key={r.id}
            className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={r.avatar_url ?? undefined} />
                <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profiles/${r.user_id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {name}
                  </Link>
                  {r.username && (
                    <span className="text-xs text-muted-foreground">@{r.username}</span>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {r.token_submitted_at
                      ? formatDistanceToNow(new Date(r.token_submitted_at), { addSuffix: true })
                      : "—"}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-16 shrink-0">Pending:</span>
                    <span className="font-mono text-foreground">
                      {r.token_ticker_pending ? `$${r.token_ticker_pending} · ` : ""}
                    </span>
                    <span className="font-mono text-muted-foreground break-all">
                      {r.token_mint_address_pending}
                    </span>
                    {pumpUrl && (
                      <a
                        href={pumpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {(r.token_mint_address || r.token_ticker) && (
                    <div className="flex items-center gap-2 opacity-70">
                      <span className="text-muted-foreground w-16 shrink-0">Current:</span>
                      <span className="font-mono">
                        {r.token_ticker ? `$${r.token_ticker} · ` : ""}
                        {r.token_mint_address || "—"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Textarea
              placeholder="Optional reviewer note (shown to creator on rejection)…"
              value={notes[r.user_id] || ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.user_id]: e.target.value }))}
              rows={2}
              className="text-xs"
            />

            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === r.user_id}
                onClick={() => review(r.user_id, false)}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                disabled={busy === r.user_id}
                onClick={() => review(r.user_id, true)}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve · go live
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminTokenSubmissions;
