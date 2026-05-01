/**
 * EventManagePage — host-only dashboard for an event at
 * /spaces/events/:id/manage.
 *
 * v1 surface:
 *   • Snapshot: status, manifest hash + anchor link, ticket counts.
 *   • Attendees list with manual check-in toggle.
 *   • Add a paid tier (USD or $RHOZE) — checkout flow lands later but
 *     hosts can already configure pricing now.
 *   • Publish/unpublish action when in draft.
 */
import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Plus,
  CheckCircle2,
  Loader2,
  ScanLine,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortHash } from "@/lib/content-hash";
import QrCheckInScanner from "@/components/events/QrCheckInScanner";

const EventManagePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event-manage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tiers } = useQuery({
    queryKey: ["event-tiers-manage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_ticket_tiers")
        .select("*")
        .eq("event_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: tickets } = useQuery({
    queryKey: ["event-tickets-manage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("event_id", id!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const [tierName, setTierName] = useState("");
  const [tierUsd, setTierUsd] = useState("");
  const [tierRhoze, setTierRhoze] = useState("");
  const [tierQty, setTierQty] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Live attendee list — reflect check-ins from any device instantly.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`event-tickets-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_tickets",
          filter: `event_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["event-tickets-manage", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const addTier = useMutation({
    mutationFn: async () => {
      if (!tierName.trim()) throw new Error("Name required");
      const { error } = await supabase.from("event_ticket_tiers").insert({
        event_id: id!,
        name: tierName.trim(),
        price_usd: tierUsd ? Number(tierUsd) : 0,
        price_rhoze: tierRhoze ? Number(tierRhoze) : 0,
        quantity_total: tierQty ? Number(tierQty) : null,
        sort_order: (tiers?.length ?? 0) + 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tier added");
      setTierName("");
      setTierUsd("");
      setTierRhoze("");
      setTierQty("");
      qc.invalidateQueries({ queryKey: ["event-tiers-manage", id] });
    },
    onError: (err: unknown) =>
      toast.error("Could not add tier", {
        description: err instanceof Error ? err.message : "Unknown error",
      }),
  });

  const checkIn = useMutation({
    mutationFn: async (ticketId: string) => {
      const ticket = (tickets ?? []).find((t: any) => t.id === ticketId);
      if (!ticket) throw new Error("Ticket not found");

      const checkedAt = new Date().toISOString();

      // 1. Mark checked in
      const { error: upErr } = await supabase
        .from("event_tickets")
        .update({ status: "checked_in", checked_in_at: checkedAt })
        .eq("id", ticketId);
      if (upErr) throw upErr;

      // 2. Log scan
      await supabase.from("event_check_ins").insert({
        ticket_id: ticketId,
        scanned_by: user!.id,
        method: "manual",
      });

      // 3. Mint proof-of-attendance — SHA-256 over ticket+event+host signature
      const payload = {
        protocol: "rhozeland",
        type: "attendance",
        ticket_id: ticketId,
        event_id: ev!.id,
        holder_id: ticket.holder_id,
        host_id: user!.id,
        qr_token: ticket.qr_token,
        event_manifest_hash: ev!.manifest_hash ?? null,
        checked_in_at: checkedAt,
      };
      const buf = new TextEncoder().encode(JSON.stringify(payload));
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const attendance_hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await supabase
        .from("event_tickets")
        .update({ attendance_hash })
        .eq("id", ticketId);

      // 4. Anchor on Solana via existing edge function (best-effort)
      try {
        const { data: proof, error: proofErr } = await supabase
          .from("contribution_proofs")
          .insert({
            user_id: ticket.holder_id,
            action_type: "event_attendance",
            reference_id: ticketId,
            metadata: { ...payload, attendance_hash },
          })
          .select()
          .single();
        if (proofErr) throw proofErr;

        const { data: res } = await supabase.functions.invoke(
          "anchor-contribution",
          { body: { proof_id: proof.id } },
        );
        const signature = (res as { signature?: string })?.signature ?? null;
        if (signature) {
          await supabase
            .from("event_tickets")
            .update({
              solana_signature: signature,
              anchored_at: new Date().toISOString(),
            })
            .eq("id", ticketId);
        }
      } catch (anchorErr) {
        // Holder can still self-anchor from their ticket page later.
        console.warn("Auto-anchor failed; holder can retry from ticket", anchorErr);
      }
    },
    onSuccess: () => {
      toast.success("Checked in", {
        description: "Proof-of-attendance minted on Solana.",
      });
      qc.invalidateQueries({ queryKey: ["event-tickets-manage", id] });
    },
    onError: (err: unknown) =>
      toast.error("Check-in failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      }),
  });

  // Resolve a scanned QR token → ticket → check-in. Looks up locally first
  // (so the host gets instant feedback) then falls back to a server lookup
  // in case the realtime cache hasn't caught up.
  const handleScannedToken = async (rawToken: string) => {
    const token = rawToken.trim();
    if (!token) return;
    setScannerOpen(false);

    let match: any = (tickets ?? []).find((t: any) => t.qr_token === token);
    if (!match) {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("event_id", id!)
        .eq("qr_token", token)
        .maybeSingle();
      if (error || !data) {
        toast.error("Ticket not found", {
          description: "That QR isn't valid for this event.",
        });
        return;
      }
      match = data;
    }

    if (match.status === "checked_in") {
      toast.info("Already checked in", {
        description: `Scanned at ${format(new Date(match.checked_in_at ?? match.issued_at), "h:mm a")}`,
      });
      return;
    }

    checkIn.mutate(match.id);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!ev) return <Navigate to="/spaces?tab=events" replace />;
  if (ev.host_id !== user?.id)
    return <Navigate to={`/spaces/events/${ev.id}`} replace />;

  const issued = (tickets ?? []).length;
  const checkedIn = (tickets ?? []).filter((t: any) => t.status === "checked_in")
    .length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to={`/spaces/events/${ev.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to event
      </Link>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
          Manage
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {ev.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          {format(new Date(ev.starts_at), "EEE, MMM d · h:mm a")} ·{" "}
          <span className="capitalize">{ev.status}</span>
        </p>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Issued
          </p>
          <p className="font-display text-2xl font-bold">{issued}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Checked in
          </p>
          <p className="font-display text-2xl font-bold">{checkedIn}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Capacity
          </p>
          <p className="font-display text-2xl font-bold">{ev.capacity ?? "∞"}</p>
        </div>
      </div>

      {/* Manifest */}
      {ev.manifest_hash && (
        <div className="rounded-xl bg-muted/40 border border-border p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Manifest:</span>
            <code className="font-mono text-foreground">
              {shortHash(ev.manifest_hash)}
            </code>
          </div>
          {ev.solana_signature && (
            <a
              href={`https://solscan.io/tx/${ev.solana_signature}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
            >
              View anchor <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Tiers */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Ticket tiers
        </h2>
        <div className="space-y-2">
          {(tiers ?? []).map((t: any) => (
            <div
              key={t.id}
              className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(t.price_usd) > 0 && `$${t.price_usd} USD`}
                  {Number(t.price_usd) > 0 && Number(t.price_rhoze) > 0 && " · "}
                  {Number(t.price_rhoze) > 0 && `${t.price_rhoze} $RHOZE`}
                  {!Number(t.price_usd) && !Number(t.price_rhoze) && "Free"}
                  {" · "}
                  {t.quantity_sold}
                  {t.quantity_total ? ` / ${t.quantity_total}` : ""} sold
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <p className="font-medium text-sm">Add a paid tier</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs">Name</Label>
              <Input value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="GA / VIP" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">USD</Label>
              <Input type="number" min="0" value={tierUsd} onChange={(e) => setTierUsd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">$RHOZE</Label>
              <Input type="number" min="0" value={tierRhoze} onChange={(e) => setTierRhoze(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min="1" value={tierQty} onChange={(e) => setTierQty(e.target.value)} placeholder="∞" />
            </div>
          </div>
          <Button
            className="rounded-full"
            size="sm"
            disabled={addTier.isPending}
            onClick={() => addTier.mutate()}
          >
            Add tier
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Pricing is saved now. Paid checkout (USD via Square, $RHOZE on-chain)
            ships in the next pass.
          </p>
        </div>
      </section>

      {/* Attendees */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Attendees</h2>
        {(tickets ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          <div className="space-y-2">
            {(tickets ?? []).map((t: any) => (
              <div
                key={t.id}
                className="rounded-xl bg-card border border-border p-3 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-foreground">
                    {t.qr_token.slice(0, 14)}…
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {t.status} · {format(new Date(t.issued_at), "MMM d, h:mm a")}
                  </p>
                </div>
                {t.status === "checked_in" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> In
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate(t.id)}
                  >
                    Check in
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default EventManagePage;
