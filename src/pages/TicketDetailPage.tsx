/**
 * TicketDetailPage — gym-card style ticket at /tickets/:id.
 *
 * Shows ticket QR + event summary, and lets the holder anchor their
 * proof-of-attendance on Solana (SHA-256 of ticket+event metadata).
 */
import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Globe2,
  Sparkles,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Hourglass,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { shortHash } from "@/lib/content-hash";

// Deterministic accent palette mapped from tier sort order / id.
const TIER_ACCENTS = [
  "from-rose-500/90 to-fuchsia-500/90",
  "from-amber-400/90 to-orange-500/90",
  "from-sky-400/90 to-indigo-500/90",
  "from-emerald-400/90 to-teal-500/90",
  "from-violet-500/90 to-purple-600/90",
];
function pickAccent(seed: string | number | null | undefined) {
  const s = String(seed ?? "0");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TIER_ACCENTS[h % TIER_ACCENTS.length];
}

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: ticket, isLoading, refetch } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*, event:events(*), tier:event_ticket_tiers(id,name,sort_order)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    // Poll every 4s while we're waiting on a Solana receipt.
    refetchInterval: (q) => {
      const t = q.state.data as { status?: string; solana_signature?: string | null } | undefined;
      return t && t.status === "checked_in" && !t.solana_signature ? 4000 : false;
    },
  });

  const { data: host } = useQuery({
    queryKey: ["ticket-host", ticket?.event?.host_id],
    enabled: !!ticket?.event?.host_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", ticket!.event!.host_id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!ticket || ticket.holder_id !== user?.id) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Ticket not available</h1>
        <Link to="/spaces?tab=events">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  const ev = ticket.event;
  const start = ev ? new Date(ev.starts_at) : null;
  const tier = (ticket as any).tier as { name?: string; sort_order?: number } | null;
  const accent = pickAccent(tier?.sort_order ?? tier?.name ?? ticket.tier_id);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    ticket.qr_token,
  )}`;
  const hostName = host?.display_name || host?.username || "Host";
  const hostInitials =
    hostName
      .split(/\s+/)
      .map((c) => c[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·";

  return (
    <div className="max-w-md mx-auto space-y-5">
      <Link
        to={`/spaces/events/${ticket.event_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to event
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl bg-gradient-to-br from-foreground to-foreground/85 text-background p-6 space-y-5 shadow-xl overflow-hidden"
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-70 mb-1">
              Rhozeland · Event ticket
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight truncate">
              {ev?.title}
            </h2>
            {tier?.name && (
              <span
                className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-gradient-to-r ${accent} text-background`}
              >
                {tier.name}
              </span>
            )}
          </div>
          {host && (
            <div className="flex items-center gap-2 shrink-0">
              <Avatar className="h-9 w-9 ring-2 ring-background/30">
                <AvatarImage src={host.avatar_url ?? undefined} />
                <AvatarFallback>{hostInitials}</AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider opacity-60">Host</p>
                <p className="text-xs font-medium truncate max-w-[100px]">{hostName}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1 text-sm opacity-90">
          {start && (
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(start, "EEE, MMM d · h:mm a")}
            </p>
          )}
          {ev?.is_online ? (
            <p className="flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5" /> Online
            </p>
          ) : (
            ev?.venue_name && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {ev.venue_name}
              </p>
            )
          )}
        </div>

        <div className="rounded-2xl bg-background p-4 flex items-center justify-center">
          <img src={qrSrc} alt="Ticket QR" className="h-56 w-56" />
        </div>

        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span className="font-mono">#{ticket.qr_token.slice(0, 8).toUpperCase()}</span>
          <span className="uppercase tracking-wider">{ticket.status.replace("_", " ")}</span>
        </div>
      </motion.div>

      {/* Proof of attendance — host-anchored, fees paid by Rhozeland */}
      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">Proof of attendance</p>
        </div>
        {ticket.solana_signature ? (
          <>
            <p className="text-xs text-muted-foreground">
              The host anchored your attendance on Solana — your receipt is verifiable forever.
            </p>
            {ticket.attendance_hash && (
              <p className="text-xs">
                <span className="text-muted-foreground">Hash: </span>
                <code className="font-mono">{shortHash(ticket.attendance_hash)}</code>
              </p>
            )}
            <a
              href={`https://solscan.io/tx/${ticket.solana_signature}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
          </>
        ) : ticket.status === "checked_in" ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Hourglass className="h-3.5 w-3.5" />
            Checked in — anchoring receipt to Solana…
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Show this QR to the host at the event. They'll scan you in and mint your proof-of-attendance on Solana — fees covered by Rhozeland.
            </p>
            <Button className="rounded-full gap-1.5 w-full" disabled variant="outline">
              <Sparkles className="h-4 w-4" /> Awaiting host check-in
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;
