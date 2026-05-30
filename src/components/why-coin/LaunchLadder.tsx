/**
 * LaunchLadder — three-tier "Help me launch" funnel surfaced at the bottom
 * of /why-coin. Replaces the flat "Ready when you are" footer with a clear
 * self-sort ladder:
 *
 *   Tier 1  · DIY            → pump.fun deeplink
 *   Tier 2  · Curated match  → A&R lite intake (tier='curated')
 *   Tier 3  · Full Roster    → A&R intake (tier='roster')
 */
import { useState } from "react";
import { ArrowUpRight, Coins, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";

const PUMP_FUN_CREATE_URL = "https://pump.fun/create";

const LaunchLadder = () => {
  const [tier, setTier] = useState<"curated" | "roster" | null>(null);

  return (
    <section className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          Pick your path
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold">
          Three ways to launch
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          From "I'll do it myself" to "build my whole campaign" — pick the
          level of help that matches where you are.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1 — DIY */}
        <div className="rounded-2xl border border-border bg-card/50 p-6 flex flex-col">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            <Coins className="h-3 w-3" /> Tier 1 · DIY
          </div>
          <h3 className="font-display text-lg font-semibold">Do it yourself</h3>
          <p className="text-xs text-muted-foreground mt-1.5 flex-1">
            You know your audience and you're ready to ship. Launch on pump.fun
            in 30 seconds. Link it here when you're done — admin approves
            same-day.
          </p>
          <Button asChild variant="outline" className="w-full mt-4 gap-2 rounded-full">
            <a href={PUMP_FUN_CREATE_URL} target="_blank" rel="noopener noreferrer">
              Launch on pump.fun
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            ~$2 SOL deploy fee · Rhozeland charges nothing
          </p>
        </div>

        {/* Tier 2 — Curated match */}
        <div className="rounded-2xl border-2 border-foreground/40 bg-card p-6 flex flex-col shadow-sm relative">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
            <span className="text-[9px] uppercase tracking-widest bg-foreground text-background px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            <Sparkles className="h-3 w-3" /> Tier 2 · A&R lite
          </div>
          <h3 className="font-display text-lg font-semibold">Curated match</h3>
          <p className="text-xs text-muted-foreground mt-1.5 flex-1">
            We pair you with a Rhozeland curator who helps you scope the
            release, time the launch, and connect you with the right
            collaborators. You still own everything.
          </p>
          <Button onClick={() => setTier("curated")} className="w-full mt-4 gap-2 rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            Request a match
          </Button>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            Free intake · 25% platform fee only on the funded project
          </p>
        </div>

        {/* Tier 3 — Full Roster */}
        <div className="rounded-2xl border border-border bg-card/50 p-6 flex flex-col">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            <Crown className="h-3 w-3" /> Tier 3 · Roster
          </div>
          <h3 className="font-display text-lg font-semibold">Full Rhozeland Roster</h3>
          <p className="text-xs text-muted-foreground mt-1.5 flex-1">
            We co-pilot the whole launch: A&R, scope, milestones, payouts, and
            the coin. Becomes a Rhozeland-managed project with the "Backed by
            Rhozeland" badge on your release page.
          </p>
          <Button onClick={() => setTier("roster")} variant="outline" className="w-full mt-4 gap-2 rounded-full">
            <Crown className="h-3.5 w-3.5" />
            Apply to roster
          </Button>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            Selective · A&R splitter wallet required (
            <a href="/ar-splitter" className="underline">read setup</a>)
          </p>
        </div>
      </div>

      <ConciergeIntakeSheet
        open={tier !== null}
        onOpenChange={(o) => !o && setTier(null)}
        initialTier={tier ?? undefined}
      />
    </section>
  );
};

export default LaunchLadder;
