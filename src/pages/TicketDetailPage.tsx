/**
 * TicketDetailPage — gym-card style ticket at /tickets/:id.
 *
 * Shows ticket QR + event summary, and lets the holder anchor their
 * proof-of-attendance on Solana (SHA-256 of ticket+event metadata).
 */
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { shortHash } from "@/lib/content-hash";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*, event:events(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const anchorMutation = useMutation({
    mutationFn: async () => {
      if (!user || !ticket) throw new Error("Not allowed");
      const payload = {
        protocol: "rhozeland",
        type: "attendance",
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        holder_id: user.id,
        qr_token: ticket.qr_token,
        event_manifest_hash: ticket.event?.manifest_hash,
        ts: new Date().toISOString(),
      };
      const attendance_hash = await sha256Hex(JSON.stringify(payload));

      // Persist hash on the ticket
      await supabase
        .from("event_tickets")
        .update({ attendance_hash })
        .eq("id", ticket.id);

      // Write a contribution_proof and anchor it
      const { data: proof, error: proofErr } = await supabase
        .from("contribution_proofs")
        .insert({
          user_id: user.id,
          action_type: "event_attendance",
          reference_id: ticket.id,
          metadata: { ...payload, attendance_hash },
        })
        .select()
        .single();
      if (proofErr) throw proofErr;

      const { data: res, error: anchorErr } = await supabase.functions.invoke(
        "anchor-contribution",
        { body: { proof_id: proof.id } },
      );
      if (anchorErr) throw anchorErr;
      const signature = (res as { signature?: string })?.signature ?? null;
      if (signature) {
        await supabase
          .from("event_tickets")
          .update({
            solana_signature: signature,
            anchored_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);
      }
      return signature;
    },
    onSuccess: () => {
      toast.success("Attendance anchored", {
        description: "Your proof-of-attendance is on Solana.",
      });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (err: unknown) => {
      toast.error("Could not anchor attendance", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
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
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    ticket.qr_token,
  )}`;

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
        className="rounded-3xl bg-gradient-to-br from-foreground to-foreground/85 text-background p-6 space-y-5 shadow-xl"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] opacity-70 mb-1">
            Rhozeland · Event ticket
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight">
            {ev?.title}
          </h2>
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
          <span>Status</span>
          <span className="uppercase tracking-wider">{ticket.status}</span>
        </div>
      </motion.div>

      {/* Anchor card */}
      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="font-medium text-sm">Proof of attendance</p>
        </div>
        {ticket.solana_signature ? (
          <>
            <p className="text-xs text-muted-foreground">
              Anchored on Solana — your attendance hash is verifiable forever.
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
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Anchor a SHA-256 of your ticket + the event manifest on Solana.
              You'll have a permanent receipt that you were here.
            </p>
            <Button
              className="rounded-full gap-1.5 w-full"
              disabled={anchorMutation.isPending}
              onClick={() => anchorMutation.mutate()}
            >
              {anchorMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Anchor my attendance
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;
