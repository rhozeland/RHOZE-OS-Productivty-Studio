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
  Search,
  Image as ImageIcon,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortHash } from "@/lib/content-hash";
import QrCheckInScanner from "@/components/events/QrCheckInScanner";
import EventCollaborators from "@/components/events/EventCollaborators";
import EventMediaManager from "@/components/events/EventMediaManager";
import HostFiatPayoutPanel from "@/components/seller/HostFiatPayoutPanel";
import { fiatToRhoze, formatMoney, COUNTRY_CURRENCY } from "@/lib/event-currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleDollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((t: any) => t.holder_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return rows.map((t: any) => ({ ...t, holder: profMap.get(t.holder_id) ?? null }));
    },
    enabled: !!id,
  });

  // Is the current user allowed to manage this event? (host or collaborator)
  const { data: isManager } = useQuery({
    queryKey: ["event-can-manage", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("event_collaborators")
        .select("id")
        .eq("event_id", id!)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierQty, setTierQty] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  const eventCurrency = (ev as any)?.currency_code || "USD";

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
      const price = tierPrice ? Number(tierPrice) : 0;
      const { error } = await supabase.from("event_ticket_tiers").insert({
        event_id: id!,
        name: tierName.trim(),
        price_usd: price, // stored in event currency
        price_rhoze: price > 0 ? fiatToRhoze(price) : 0,
        currency_code: eventCurrency,
        quantity_total: tierQty ? Number(tierQty) : null,
        sort_order: (tiers?.length ?? 0) + 1,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tier added");
      setTierName("");
      setTierPrice("");
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

      // 3. Anchor proof-of-attendance via dedicated edge function (idempotent + retryable).
      // The function computes the SHA-256, creates the contribution_proofs row,
      // posts the Solana memo, and writes back signature + anchored_at.
      // Failures are recorded server-side; nightly sweep + holder retry will recover.
      let anchored = false;
      try {
        const { data: res, error: fnErr } = await supabase.functions.invoke(
          "anchor-event-ticket",
          { body: { ticket_id: ticketId } },
        );
        if (fnErr) throw fnErr;
        anchored = !!(res as { signature?: string })?.signature;
      } catch (anchorErr) {
        console.warn("Auto-anchor failed; will retry", anchorErr);
      }
      return { anchored };
    },
    onSuccess: ({ anchored }) => {
      toast.success("Checked in", {
        description: anchored
          ? "Proof-of-attendance anchored on Solana."
          : "Receipt is pending — we'll retry automatically.",
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

  // Manual lookup — host can paste a ticket id or qr_token to find and
  // check in an attendee without scanning (useful for typed entries, paper
  // backups, or accessibility).
  const handleManualLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setLookupBusy(true);
    try {
      // Try local cache first against both qr_token and id (incl. prefix match)
      let match: any = (tickets ?? []).find(
        (t: any) =>
          t.qr_token === q ||
          t.id === q ||
          t.qr_token.startsWith(q) ||
          t.id.startsWith(q),
      );

      if (!match) {
        const { data, error } = await supabase
          .from("event_tickets")
          .select("*")
          .eq("event_id", id!)
          .or(`qr_token.eq.${q},id.eq.${q}`)
          .maybeSingle();
        if (error || !data) {
          toast.error("Attendee not found", {
            description: "No ticket matches that id or QR token.",
          });
          return;
        }
        match = data;
      }

      if (match.status === "checked_in") {
        toast.info("Already checked in", {
          description: `Scanned at ${format(new Date(match.checked_in_at ?? match.issued_at), "h:mm a")}`,
        });
        setLookupQuery("");
        return;
      }

      checkIn.mutate(match.id);
      setLookupQuery("");
    } finally {
      setLookupBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!ev) return <Navigate to="/spaces?tab=events" replace />;
  const isHost = ev.host_id === user?.id;
  if (!isHost && !isManager) {
    return <Navigate to={`/spaces/events/${ev.id}`} replace />;
  }

  const issued = (tickets ?? []).length;
  const checkedIn = (tickets ?? []).filter((t: any) => t.status === "checked_in")
    .length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/spaces/events/${ev.id}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Manage Event
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {ev.title} · {format(new Date(ev.starts_at), "EEE, MMM d · h:mm a")}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
          <Link to={`/spaces/events/${ev.id}`}>
            <Settings className="h-3.5 w-3.5" /> View Event
          </Link>
        </Button>
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

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Details
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Media
          </TabsTrigger>
          {isHost && (
            <TabsTrigger value="team" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
          )}
          <TabsTrigger value="tickets" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Tickets
          </TabsTrigger>
          <TabsTrigger value="attendees" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" /> Attendees
          </TabsTrigger>
          {isHost && (
            <TabsTrigger value="earnings" className="gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5" /> Earnings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="surface-card p-6 space-y-3">
            <h2 className="font-display text-lg font-bold tracking-tight">Snapshot</h2>
            <p className="text-sm text-muted-foreground">
              Quick view of attendance, capacity, and event proof state.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="media" className="space-y-4 mt-4">
          <EventMediaManager
            eventId={ev.id}
            coverUrl={ev.cover_url}
            title={ev.title}
            onUpdate={() => {
              qc.invalidateQueries({ queryKey: ["event-manage", id] });
              qc.invalidateQueries({ queryKey: ["event", id] });
            }}
          />
        </TabsContent>

        {isHost && (
          <TabsContent value="team" className="space-y-4 mt-4">
            <EventCollaborators eventId={ev.id} hostId={ev.host_id} />
          </TabsContent>
        )}

        <TabsContent value="tickets" className="space-y-4 mt-4">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold tracking-tight">Ticket tiers</h2>
            <div className="space-y-2">
              {(tiers ?? []).map((t: any) => {
                const cur = t.currency_code || eventCurrency;
                const price = Number(t.price_usd) || 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {price > 0 ? formatMoney(price, cur) : "Free"}
                        {price > 0 && " · also payable in $RHOZE (tier discount)"}
                        {" · "}
                        {t.quantity_sold}
                        {t.quantity_total ? ` / ${t.quantity_total}` : ""} sold
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">Add a paid tier ({eventCurrency})</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1.5 col-span-2 sm:col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="GA / VIP" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price ({eventCurrency})</Label>
                  <Input type="number" min="0" step="0.01" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} />
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
                Buyers paying with $RHOZE get a tier-based discount (Bloom 5% · Glow 10% · Play 15%).
              </p>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="attendees" className="space-y-4 mt-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight">Attendees</h2>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-500">
                  <Radio className="h-3 w-3 animate-pulse" /> Live
                </span>
              </div>
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine className="h-4 w-4" /> Scan QR
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-border p-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleManualLookup();
                  }
                }}
                placeholder="Paste ticket id or QR token…"
                className="h-9 border-0 bg-transparent focus-visible:ring-0 px-1 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={lookupBusy || checkIn.isPending || !lookupQuery.trim()}
                onClick={handleManualLookup}
              >
                {lookupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check in"}
              </Button>
            </div>

            {(tickets ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              <div className="space-y-2">
                {(tickets ?? []).map((t: any) => {
                  const name =
                    t.holder?.display_name ||
                    t.holder?.username ||
                    `Guest ${t.qr_token.slice(3, 7)}`;
                  const initials =
                    (name as string)
                      .split(/\s+/)
                      .map((c: string) => c[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "·";
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl bg-card border border-border p-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={t.holder?.avatar_url ?? undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {t.status} · {format(new Date(t.issued_at), "MMM d, h:mm a")}
                          </p>
                        </div>
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
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        {isHost && (
          <TabsContent value="earnings" className="space-y-4 mt-4">
            <HostFiatPayoutPanel />
          </TabsContent>
        )}
      </Tabs>

      <QrCheckInScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScannedToken}
      />
    </div>
  );
};

export default EventManagePage;
