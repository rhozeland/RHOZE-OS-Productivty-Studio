/**
 * AttachCoinFlowSheet — new v11 attach-a-coin UX.
 *
 * Simple 4-step flow:
 *   1. Paste the pump.fun contract address → preview card (price, MC, 24h)
 *   2. Choose target — Project or Content (a Flow post / work)
 *   3. Pick the specific project or work from a list
 *   4. Celebration screen with next-step CTAs
 *
 * Writes denormalized token metadata directly onto
 * `projects.linked_token_*` or `works.linked_token_*` so any
 * pump.fun mint can be attached without going through the
 * admin-approved profile token slot.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  PartyPopper,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Music,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "paste" | "pick-target" | "pick-project" | "pick-work" | "celebrate";
type Target = "project" | "work";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional: pre-scope to a specific project or work id */
  scope?: { kind: Target; id: string } | null;
}

interface TokenPreview {
  mint: string;
  symbol: string;
  name: string;
  imageUri: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
  holderCount: number | null;
}

const fmtUsd = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
};

const isValidMint = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(v.trim());

const AttachCoinFlowSheet = ({ open, onOpenChange, scope }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("paste");
  const [ca, setCa] = useState("");
  const [preview, setPreview] = useState<TokenPreview | null>(null);
  const [fetching, setFetching] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("paste");
        setCa("");
        setPreview(null);
        setTarget(null);
        setPickedId(null);
        setSearch("");
      }, 200);
    }
  }, [open]);

  const fetchPreview = async () => {
    const mint = ca.trim();
    if (!isValidMint(mint)) {
      toast.error("That doesn't look like a Solana mint address");
      return;
    }
    setFetching(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/creator-token-metrics?mint=${mint}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) throw new Error("Could not fetch coin data");
      const j = await res.json();
      const p: TokenPreview = {
        mint,
        symbol: j.symbol ?? "TOKEN",
        name: j.name ?? "Unknown coin",
        imageUri: j.imageUri ?? null,
        priceUsd: j.priceUsd ?? null,
        marketCapUsd: j.marketCapUsd ?? null,
        change24h: j.change24h ?? null,
        holderCount: j.holderCount ?? null,
      };
      setPreview(p);
      if (scope) {
        setTarget(scope.kind);
        setPickedId(scope.id);
        // skip picker, go straight to attach after target auto-set
        setStep("pick-target");
      } else {
        setStep("pick-target");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not fetch coin data");
    } finally {
      setFetching(false);
    }
  };

  // Load projects owned by current user
  const projectsQ = useQuery({
    queryKey: ["attach-coin-projects", user?.id],
    enabled: open && step === "pick-project" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, cover_url, linked_token_mint, updated_at")
        .eq("owner_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load recent works by current user
  const worksQ = useQuery({
    queryKey: ["attach-coin-works", user?.id],
    enabled: open && step === "pick-work" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id, title, kind, cover_url, thumbnail_url, linked_token_mint, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!preview || !target || !pickedId) throw new Error("Missing selection");
      const payload = {
        linked_token_mint: preview.mint,
        linked_token_ticker: preview.symbol,
        linked_token_name: preview.name,
        linked_token_image_url: preview.imageUri,
      };
      const table = target === "project" ? "projects" : "works";
      const { error } = await (supabase as any)
        .from(table)
        .update(payload)
        .eq("id", pickedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["works"] });
      qc.invalidateQueries({ queryKey: ["release"] });
      qc.invalidateQueries({ queryKey: ["attach-coin-projects"] });
      qc.invalidateQueries({ queryKey: ["attach-coin-works"] });
      setStep("celebrate");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not attach coin"),
  });

  const filteredProjects = useMemo(() => {
    const rows = projectsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => (r.title ?? "").toLowerCase().includes(q));
  }, [projectsQ.data, search]);

  const filteredWorks = useMemo(() => {
    const rows = worksQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => (r.title ?? "").toLowerCase().includes(q));
  }, [worksQ.data, search]);

  const goPickList = (t: Target) => {
    setTarget(t);
    setPickedId(null);
    setSearch("");
    setStep(t === "project" ? "pick-project" : "pick-work");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <div className="p-6 pb-24">
          {step !== "paste" && step !== "celebrate" && (
            <button
              onClick={() =>
                setStep(
                  step === "pick-target"
                    ? "paste"
                    : "pick-target",
                )
              }
              className="mb-4 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}

          {/* STEP 1: paste */}
          {step === "paste" && (
            <>
              <SheetHeader className="text-left mb-6">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-purple-500 mb-3">
                  <Coins className="h-3 w-3" /> Attach a coin
                </div>
                <SheetTitle className="text-2xl font-display">
                  Paste the contract address
                </SheetTitle>
                <SheetDescription>
                  Drop any pump.fun (or SPL) contract address. We'll pull the
                  live coin info and let you attach it to a project or a track.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3">
                <Input
                  autoFocus
                  value={ca}
                  onChange={(e) => setCa(e.target.value)}
                  placeholder="e.g. 7GCihg...pump"
                  className="font-mono text-sm h-12"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidMint(ca)) fetchPreview();
                  }}
                />
                <Button
                  onClick={fetchPreview}
                  disabled={!isValidMint(ca) || fetching}
                  className="w-full h-11"
                >
                  {fetching ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {fetching ? "Fetching…" : "Preview coin"}
                </Button>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1">
                  Data via pump.fun + Birdeye. Rhozeland never custodies the
                  token — attaching just tags your work with the coin.
                </p>
              </div>
            </>
          )}

          {/* STEP 2: pick target */}
          {step === "pick-target" && preview && (
            <>
              <SheetHeader className="text-left mb-6">
                <SheetTitle className="text-2xl font-display">
                  Where should ${preview.symbol} live?
                </SheetTitle>
                <SheetDescription>
                  A project ties the coin to every future post inside it. A
                  single track tags one piece of content.
                </SheetDescription>
              </SheetHeader>

              <CoinPreviewCard preview={preview} />

              <div className="mt-6 grid grid-cols-1 gap-3">
                <TargetTile
                  icon={<FolderOpen className="h-5 w-5" />}
                  label="Attach to a project"
                  hint="Groups all posts under one release. Every future post inherits the coin."
                  onClick={() => goPickList("project")}
                />
                <TargetTile
                  icon={<Music className="h-5 w-5" />}
                  label="Attach to a track / post"
                  hint="Tag one piece of content — perfect for standalone Flow drops."
                  onClick={() => goPickList("work")}
                />
              </div>
            </>
          )}

          {/* STEP 3a: pick project */}
          {step === "pick-project" && preview && (
            <PickList
              title={`Which release gets $${preview.symbol}?`}
              subtitle="Every post inside this project will inherit the coin."
              rows={filteredProjects}
              search={search}
              onSearch={setSearch}
              loading={projectsQ.isLoading}
              renderRow={(row: any) => (
                <PickRow
                  key={row.id}
                  active={pickedId === row.id}
                  onClick={() => setPickedId(row.id)}
                  icon={
                    row.cover_url ? (
                      <img
                        src={row.cover_url}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )
                  }
                  title={row.title || "Untitled release"}
                  subtitle={row.description?.slice(0, 60) || undefined}
                  currentMint={row.linked_token_mint}
                  previewMint={preview.mint}
                />
              )}
              emptyLabel="No projects yet"
              onConfirm={() => attach.mutate()}
              confirmDisabled={!pickedId || attach.isPending}
              confirmLabel={
                attach.isPending ? "Attaching…" : `Attach $${preview.symbol}`
              }
            />
          )}

          {/* STEP 3b: pick work */}
          {step === "pick-work" && preview && (
            <PickList
              title={`Which track gets $${preview.symbol}?`}
              subtitle="Attaches the coin chip to that single Flow post."
              rows={filteredWorks}
              search={search}
              onSearch={setSearch}
              loading={worksQ.isLoading}
              renderRow={(row: any) => (
                <PickRow
                  key={row.id}
                  active={pickedId === row.id}
                  onClick={() => setPickedId(row.id)}
                  icon={
                    (row.thumbnail_url || row.cover_url) ? (
                      <img
                        src={row.thumbnail_url || row.cover_url}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )
                  }
                  title={row.title || "Untitled"}
                  subtitle={row.kind || undefined}
                  currentMint={row.linked_token_mint}
                  previewMint={preview.mint}
                />
              )}
              emptyLabel="No posts yet — drop something in Flow first"
              onConfirm={() => attach.mutate()}
              confirmDisabled={!pickedId || attach.isPending}
              confirmLabel={
                attach.isPending ? "Attaching…" : `Attach $${preview.symbol}`
              }
            />
          )}

          {/* STEP 4: celebrate */}
          {step === "celebrate" && preview && (
            <div className="text-center py-6">
              <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500/20 via-purple-500/20 to-amber-500/20 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-emerald-500/10 to-purple-500/10" />
                <PartyPopper className="h-9 w-9 text-emerald-500 relative" />
              </div>

              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-emerald-500 mb-3">
                <Sparkles className="h-3 w-3" /> On-chain credibility unlocked
              </div>
              <h2 className="text-2xl font-display font-medium mb-2">
                ${preview.symbol} is now attached
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                {target === "project"
                  ? "Every post inside this release now carries the coin chip. Holders see it on chain."
                  : "This post now carries the coin chip. Holders see it on chain."}
              </p>

              <div className="rounded-xl border border-border bg-card p-4 mb-6 text-left flex items-center gap-3">
                {preview.imageUri ? (
                  <img
                    src={preview.imageUri}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Coins className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    ${preview.symbol} · {preview.name}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    {preview.mint}
                  </div>
                </div>
                <a
                  href={`https://pump.fun/coin/${preview.mint}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    if (target === "project" && pickedId) {
                      navigate(`/projects/${pickedId}`);
                    }
                  }}
                  className="w-full"
                >
                  {target === "project" ? "Open release" : "Nice"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep("paste");
                    setCa("");
                    setPreview(null);
                    setTarget(null);
                    setPickedId(null);
                  }}
                  className="w-full"
                >
                  Attach another coin
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ----- inner components ----- */

const CoinPreviewCard = ({ preview }: { preview: TokenPreview }) => {
  const up = (preview.change24h ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {preview.imageUri ? (
          <img
            src={preview.imageUri}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Coins className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">${preview.symbol}</div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              pump.fun
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {preview.name}
          </div>
        </div>
        <a
          href={`https://pump.fun/coin/${preview.mint}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <Stat label="Price" value={fmtUsd(preview.priceUsd)} />
        <Stat label="Mkt cap" value={fmtUsd(preview.marketCapUsd)} />
        <Stat
          label="24h"
          value={
            preview.change24h == null
              ? "—"
              : `${up ? "+" : ""}${preview.change24h.toFixed(1)}%`
          }
          accent={
            preview.change24h == null
              ? undefined
              : up
                ? "text-emerald-500"
                : "text-rose-500"
          }
          icon={
            preview.change24h == null ? undefined : up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )
          }
        />
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div
      className={cn(
        "text-sm font-medium mt-0.5 inline-flex items-center gap-1",
        accent,
      )}
    >
      {icon}
      {value}
    </div>
  </div>
);

const TargetTile = ({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/40 hover:bg-muted/40 transition-all group"
  >
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground group-hover:text-background transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {hint}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
    </div>
  </button>
);

const PickList = ({
  title,
  subtitle,
  rows,
  search,
  onSearch,
  loading,
  renderRow,
  emptyLabel,
  onConfirm,
  confirmDisabled,
  confirmLabel,
}: {
  title: string;
  subtitle: string;
  rows: any[];
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
  renderRow: (row: any) => React.ReactNode;
  emptyLabel: string;
  onConfirm: () => void;
  confirmDisabled: boolean;
  confirmLabel: string;
}) => (
  <>
    <SheetHeader className="text-left mb-4">
      <SheetTitle className="text-2xl font-display">{title}</SheetTitle>
      <SheetDescription>{subtitle}</SheetDescription>
    </SheetHeader>

    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search…"
        className="pl-8 h-9"
      />
    </div>

    <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {emptyLabel}
        </div>
      ) : (
        rows.map(renderRow)
      )}
    </div>

    <div className="fixed bottom-0 inset-x-0 sm:absolute sm:inset-x-0 bg-background border-t border-border p-4">
      <Button
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="w-full h-11"
      >
        {confirmLabel}
      </Button>
    </div>
  </>
);

const PickRow = ({
  active,
  onClick,
  icon,
  title,
  subtitle,
  currentMint,
  previewMint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  currentMint?: string | null;
  previewMint: string;
}) => {
  const alreadyThis = currentMint && currentMint === previewMint;
  const hasOther = currentMint && currentMint !== previewMint;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-all",
        active
          ? "border-foreground bg-muted/60"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground truncate">
            {subtitle}
          </div>
        )}
        {hasOther && (
          <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 mt-0.5">
            Currently linked to another coin — will be replaced
          </div>
        )}
        {alreadyThis && (
          <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            Already linked to this coin
          </div>
        )}
      </div>
      {active && (
        <div className="h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
};

export default AttachCoinFlowSheet;
