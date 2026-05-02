/**
 * RewardsLiveSections — three live, account-scoped sections appended to
 * the Rewards page so it feels personal instead of catalog-only.
 *
 * 1. Verification status   — wallet binding + Verified IP anchored count.
 *                             Drives the "you can claim on-chain" gate.
 * 2. Pending rewards       — credits queued in the admin Reward Gate
 *                             that aren't credited yet (live count + total).
 * 3. Reward-relevant events — your upcoming tickets + upcoming events
 *                              hosted by Verified IP creators (showing up
 *                              earns provenance + reward signal).
 *
 * Pure read-only Supabase queries — RLS-safe.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  Shield,
  ShieldCheck,
  Wallet,
  Hourglass,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const RewardsLiveSections = () => {
  const { user } = useAuth();

  // ─── Verification status ────────────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["rewards-profile-verify", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_address, wallet_locked")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: anchoredWorks } = useQuery({
    queryKey: ["rewards-anchored-works", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .not("solana_signature", "is", null);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // ─── Pending rewards (admin queue) ─────────────────────────────────
  const { data: pending } = useQuery({
    queryKey: ["rewards-pending", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_rewards")
        .select("id, amount, action_type, description, created_at, status")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!user,
  });

  // ─── Upcoming events you can earn from ─────────────────────────────
  // Pulls (a) events you already hold tickets for, and (b) the next few
  // public events overall — showing up earns Flow proof + reward signal.
  const { data: ticketEvents } = useQuery({
    queryKey: ["rewards-ticket-events", user?.id],
    queryFn: async () => {
      const { data: tix } = await supabase
        .from("event_tickets")
        .select("event_id, status")
        .eq("holder_id", user!.id)
        .in("status", ["issued", "checked_in"]);
      const ids = [...new Set((tix ?? []).map((t) => t.event_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, host_id, category")
        .in("id", ids)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(4);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: discoveryEvents } = useQuery({
    queryKey: ["rewards-discovery-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, host_id, category")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(4);
      return data ?? [];
    },
  });

  const eventList = [
    ...(ticketEvents ?? []).map((e: any) => ({ ...e, hasTicket: true })),
    ...(discoveryEvents ?? [])
      .filter((e: any) => !(ticketEvents ?? []).some((t: any) => t.id === e.id))
      .map((e: any) => ({ ...e, hasTicket: false })),
  ].slice(0, 4);

  if (!user) return null;

  const walletConnected = !!profile?.wallet_address;
  const walletLocked = !!profile?.wallet_locked;
  const anchored = anchoredWorks ?? 0;
  const pendingTotal = (pending ?? []).reduce(
    (s, r: any) => s + Number(r.amount ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      {/* ─── Section: Verification status ──────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Your verification status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Wallet binding */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border ${
              walletConnected
                ? "border-primary/30 bg-primary/5"
                : "border-dashed border-border bg-card/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                  walletConnected ? "bg-primary/15" : "bg-muted"
                }`}
              >
                <Wallet
                  className={`h-4 w-4 ${
                    walletConnected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-body font-semibold text-foreground">
                  Wallet binding
                </p>
                {walletConnected ? (
                  <>
                    <p className="text-[11px] text-muted-foreground font-body break-all">
                      {profile?.wallet_address?.slice(0, 6)}…
                      {profile?.wallet_address?.slice(-4)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${
                        walletLocked ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {walletLocked ? "Locked 1:1" : "Bound, unlocked"}
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
                      Connect a Solana wallet to claim earned credits
                      on-chain as $RHOZE.
                    </p>
                    <Link
                      to="/settings"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1"
                    >
                      Connect wallet <ArrowRight className="h-3 w-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Verified IP count */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`p-4 rounded-xl border ${
              anchored > 0
                ? "border-primary/30 bg-primary/5"
                : "border-dashed border-border bg-card/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                  anchored > 0 ? "bg-primary/15" : "bg-muted"
                }`}
              >
                <Shield
                  className={`h-4 w-4 ${
                    anchored > 0 ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-body font-semibold text-foreground">
                  Verified IP
                </p>
                {anchored > 0 ? (
                  <>
                    <p className="text-2xl font-display text-foreground leading-none">
                      {anchored}
                      <span className="text-xs text-muted-foreground ml-1">
                        anchored
                      </span>
                    </p>
                    <Link
                      to="/settings#provenance"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      View vault <ArrowRight className="h-3 w-3" />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
                      Anchor a piece of work to mint provenance and unlock
                      coin launches + curator splits.
                    </p>
                    <Link
                      to="/flow"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1"
                    >
                      Share something <ArrowRight className="h-3 w-3" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Section: Pending rewards (admin queue) ─────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-amber-500" />
            In the reward queue
          </h3>
          {(pending?.length ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground font-body">
              +{pendingTotal} $RHOZE awaiting approval
            </span>
          )}
        </div>

        {(pending?.length ?? 0) === 0 ? (
          <div className="card-dashed p-5 text-center space-y-1">
            <p className="text-xs text-muted-foreground font-body">
              Nothing in the queue. Post to Flow, leave a review, or hit a
              project milestone — every action shows up here for admin
              approval.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 divide-y divide-border overflow-hidden">
            {pending!.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 text-sm font-body"
              >
                <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{r.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.action_type} ·{" "}
                    {formatDistanceToNow(new Date(r.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-500 shrink-0">
                  +{r.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Section: Upcoming reward-relevant events ───────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Show up & earn
          </h3>
          <Link
            to="/spaces?tab=events"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-body"
          >
            All events <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {eventList.length === 0 ? (
          <div className="card-dashed p-5 text-center">
            <p className="text-xs text-muted-foreground font-body">
              No upcoming events yet. Showing up to anchored events earns
              attendance proofs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {eventList.map((e: any) => (
              <Link
                key={e.id}
                to={`/spaces/events/${e.id}`}
                className="group p-3 rounded-xl border border-border bg-card/40 hover:bg-card hover:border-primary/40 transition-all flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {e.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-body">
                    {format(new Date(e.starts_at), "MMM d · h:mm a")}
                    {e.category ? ` · ${e.category}` : ""}
                  </p>
                </div>
                {e.hasTicket && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5 shrink-0">
                    Ticket
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RewardsLiveSections;
