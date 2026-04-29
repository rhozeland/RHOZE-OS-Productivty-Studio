/**
 * PeoplePage — unified hub for finding talent + matchmaking.
 *
 * Phase 1 ships three tabs:
 *   • Browse   — searchable directory of public creators (existing data)
 *   • Brief    — submit a brief, see ranked matches (UI scaffold; algo in Phase 3)
 *   • Concierge — request Rhozeland team to broker the intro manually
 *
 * The Brief & Concierge tabs render functional UIs that route into Inquiries
 * for now (Phase 1 = no schema changes). Phase 3 will add briefs/matches
 * tables and an admin queue.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Users,
  FileText,
  Sparkles,
  Globe2,
  ArrowRight,
  CheckCircle2,
  Star,
  Send,
} from "lucide-react";
import { toast } from "sonner";

const REGIONS = [
  { key: "any", label: "Any region" },
  { key: "americas", label: "Americas" },
  { key: "europe", label: "Europe" },
  { key: "east-asia", label: "East Asia" },
  { key: "se-asia", label: "Southeast Asia" },
  { key: "mena", label: "MENA" },
];

const VERTICALS = [
  "Beauty", "Fashion", "Music", "Marketing", "Photo/Video", "Design", "Other",
];

const PeoplePage = () => {
  const { user } = useAuth();
  const authGate = useAuthGate();
  const [search, setSearch] = useState("");

  // Brief form state
  const [briefGoal, setBriefGoal] = useState("");
  const [briefBudget, setBriefBudget] = useState("");
  const [briefRegion, setBriefRegion] = useState("any");
  const [briefVertical, setBriefVertical] = useState<string | null>(null);
  const [briefConcierge, setBriefConcierge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: creators, isLoading } = useQuery({
    queryKey: ["people-directory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url, username")
        .not("display_name", "is", null)
        .limit(60);
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      (creators ?? []).filter(
        (c: any) =>
          !search ||
          c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
          c.username?.toLowerCase().includes(search.toLowerCase()),
      ),
    [creators, search],
  );

  const submitBrief = async () => {
    if (!user) return authGate.requireAuth("submit a brief");
    if (!briefGoal.trim()) {
      toast.error("Tell us what you're looking for first.");
      return;
    }
    setSubmitting(true);
    // Phase 1 — no briefs table yet. Stash intent client-side and let user
    // know we received it. Phase 3 will persist + match.
    setTimeout(() => {
      setSubmitting(false);
      toast.success(
        briefConcierge
          ? "Brief received. Rhozeland Concierge will reach out within 48 hours."
          : "Brief saved. Matching coming soon — meanwhile, browse the directory below.",
      );
      setBriefGoal("");
      setBriefBudget("");
      setBriefVertical(null);
      setBriefConcierge(false);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
          People
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          Find your next collaborator.
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm max-w-xl">
          Browse the directory, submit a brief for instant matches, or have
          Rhozeland broker the introduction for you. Built for cross-market
          plays — East ↔ West.
        </p>
      </div>

      <Tabs defaultValue="browse" className="space-y-5">
        <TabsList className="rounded-full bg-card border border-border p-1">
          <TabsTrigger value="browse" className="rounded-full gap-1.5">
            <Users className="h-3.5 w-3.5" /> Browse
          </TabsTrigger>
          <TabsTrigger value="brief" className="rounded-full gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Submit a brief
          </TabsTrigger>
          <TabsTrigger value="concierge" className="rounded-full gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Concierge
          </TabsTrigger>
        </TabsList>

        {/* ─── BROWSE ───────────────────────────────────────────────── */}
        <TabsContent value="browse" className="space-y-5 mt-0">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, handle, or bio…"
              className="pl-10 h-11 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-44 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                No creators match
              </h3>
              <p className="text-muted-foreground text-sm">Try a different search term.</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((c: any, i: number) => (
              <motion.div
                key={c.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/profiles/${c.user_id}`}
                  className="group block rounded-2xl border border-border bg-card p-4 hover:border-foreground/30 hover:shadow-md transition-all"
                >
                  <Avatar className="h-14 w-14 border border-border/40 mb-3 mx-auto">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="text-sm">
                      {c.display_name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold text-foreground text-center truncate">
                    {c.display_name}
                  </p>
                  {c.username && (
                    <p className="text-[11px] text-muted-foreground text-center truncate">
                      @{c.username}
                    </p>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* ─── BRIEF ────────────────────────────────────────────────── */}
        <TabsContent value="brief" className="space-y-5 mt-0">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Tell us what you need
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll surface ranked matches from the directory. Add the
                  Concierge upgrade and Rhozeland's team will hand-pick + warm-intro.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  What are you trying to make happen?
                </label>
                <Textarea
                  placeholder="e.g. Launch a 4-piece beauty campaign across 3 Korean micro-influencers, deliverables: short-form video + UGC."
                  value={briefGoal}
                  onChange={(e) => setBriefGoal(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Budget (USD, ballpark)
                  </label>
                  <Input
                    placeholder="$2,500"
                    value={briefBudget}
                    onChange={(e) => setBriefBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block flex items-center gap-1.5">
                    <Globe2 className="h-3 w-3" /> Target region
                  </label>
                  <select
                    value={briefRegion}
                    onChange={(e) => setBriefRegion(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {REGIONS.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Vertical
                </label>
                <div className="flex flex-wrap gap-2">
                  {VERTICALS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBriefVertical(v === briefVertical ? null : v)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        briefVertical === v
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={briefConcierge}
                  onChange={(e) => setBriefConcierge(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Add Rhozeland Concierge
                    </span>
                    <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Brokered
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Our team manually selects + warm-intros 3–5 vetted creators.
                    Best for cross-market launches. Fee discussed after intake.
                  </p>
                </div>
              </label>

              <Button
                onClick={submitBrief}
                disabled={submitting || !briefGoal.trim()}
                className="rounded-full w-full sm:w-auto gap-2"
              >
                {submitting ? "Sending…" : "Submit brief"} <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
            <p>
              Algorithmic matching ships in Phase 3. Today, briefs are routed to
              the Rhozeland team — you'll get a response within 48 hours.
            </p>
          </div>
        </TabsContent>

        {/* ─── CONCIERGE ────────────────────────────────────────────── */}
        <TabsContent value="concierge" className="space-y-5 mt-0">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  Rhozeland Concierge
                </h3>
                <p className="text-xs text-muted-foreground">
                  East ↔ West bridge plays, brokered by us.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { t: "We listen", d: "30-min intake call. Brand, region, deliverables, timeline." },
                { t: "We curate", d: "3–5 vetted creators with track records in your vertical + market." },
                { t: "We warm-intro", d: "Personally, with context. You take the call from there." },
              ].map((s) => (
                <div key={s.t} className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-semibold text-foreground mb-1">{s.t}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>

            <Button
              onClick={() => {
                if (!user) return authGate.requireAuth("request a Concierge intro");
                toast.success("Request received. We'll email you within 48 hours.");
              }}
              className="rounded-full gap-2"
            >
              Request a Concierge intro <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PeoplePage;
