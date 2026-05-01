/**
 * SpacesHubPage — tabbed shell for the physical-and-gathered network.
 *
 * Tabs:
 *   • Spaces       — existing studios marketplace (unchanged behavior)
 *   • Events       — hosting + RSVP/paid ticketing + IP anchoring (v1)
 *   • Residencies  — coming-soon stub
 *
 * URL contract:
 *   /spaces                     → defaults to ?tab=spaces
 *   /spaces?tab=events          → Events tab
 *   /spaces?tab=residencies     → Residencies stub
 */
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, CalendarDays, Sprout, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StudiosPage from "@/pages/StudiosPage";

type Tab = "spaces" | "events" | "residencies";

const isTab = (v: string | null): v is Tab =>
  v === "spaces" || v === "events" || v === "residencies";

const SpacesHubPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: Tab = isTab(raw) ? raw : "spaces";

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
            Spaces
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Where the work gathers.
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-lg">
            Book vetted studios, host events with on-chain provenance, and
            (soon) apply to long-form residencies.
          </p>
        </div>
        {user && active === "events" && (
          <Link to="/spaces/events/new">
            <Button className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> Host an Event
            </Button>
          </Link>
        )}
      </div>

      <Tabs value={active} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="rounded-full bg-card border border-border p-1 h-auto">
          <TabsTrigger
            value="spaces"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <Building2 className="h-3.5 w-3.5" /> Spaces
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Events
          </TabsTrigger>
          <TabsTrigger
            value="residencies"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <Sprout className="h-3.5 w-3.5" /> Residencies
          </TabsTrigger>
        </TabsList>

        {/* Spaces — reuse the existing studios marketplace as-is */}
        <TabsContent value="spaces" className="mt-6">
          <StudiosPage />
        </TabsContent>

        {/* Events — placeholder until the events list/detail/wizard land */}
        <TabsContent value="events" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-10 text-center"
          >
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-1.5">
              Events are coming next
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              RSVP and paid ticketing (USD + $RHOZE), with every event manifest,
              artifact, and ticket SHA-256 anchored on Solana. Hosting opens to
              all members.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Manifest hash on publish
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Artifact provenance
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Proof of attendance
              </span>
            </div>
          </motion.div>
        </TabsContent>

        {/* Residencies — coming-soon stub (no DB, no flows in v1) */}
        <TabsContent value="residencies" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"
          >
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Sprout className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-1.5">
              Residencies — coming soon
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Long-form stays at member Spaces with optional stipends and an
              application flow. Want to host one?{" "}
              <Link to="/messages" className="text-primary underline-offset-2 hover:underline">
                Reach out
              </Link>
              .
            </p>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SpacesHubPage;
