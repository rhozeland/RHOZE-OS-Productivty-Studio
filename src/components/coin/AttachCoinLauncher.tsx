/**
 * AttachCoinLauncher — v12 immersive fullscreen coin attach.
 *
 * Replaces AttachCoinFlowSheet's right-side sheet with a Dialog that
 * takes over the entire viewport. Kinetic Bento styling: midnight
 * background, mint accent, Archivo Black display type.
 *
 * Flow: paste CA → live preview + target choice → thumbnail picker →
 * celebration. The picker prefetches `works` AND `projects` as soon
 * as the launcher opens (previous version only queried on step change,
 * which stranded users on a "No posts yet" empty state even when they
 * had works). Falls back to `flow_items` for legacy Flow-only posts.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Coins,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  PartyPopper,
  Play,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Music,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "paste" | "target" | "pick" | "celebrate";
type Target = "project" | "work";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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

const AttachCoinLauncher = ({ open, onOpenChange, scope }: Props) => {
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

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("paste");
        setCa("");
        setPreview(null);
        setTarget(null);
        setPickedId(null);
        setSearch("");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Data: prefetch as soon as the launcher opens (fixes empty picker) ──
  const projectsQ = useQuery({
    queryKey: ["launcher-projects", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("id, title, description, cover_image_url, cover_color, linked_token_mint, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const worksQ = useQuery({
    queryKey: ["launcher-works", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("id, title, kind, cover_url, thumbnail_url, file_url, linked_token_mint, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fallback: legacy Flow items (some users only have flow_items rows).
  const flowQ = useQuery({
    queryKey: ["launcher-flow", user?.id],
    enabled: open && !!user?.id && (worksQ.data?.length ?? 0) === 0 && !worksQ.isLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_items")
        .select("id, title, category, file_url, link_url, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        kind: r.category ?? "post",
        cover_url: r.file_url,
        thumbnail_url: r.file_url,
        file_url: r.file_url,
        linked_token_mint: null,
        created_at: r.created_at,
        _isFlowFallback: true,
      }));
    },
  });

  const workRows = (worksQ.data?.length ?? 0) > 0 ? worksQ.data : (flowQ.data ?? []);

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
        setStep("pick");
      } else {
        setStep("target");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not fetch coin data");
    } finally {
      setFetching(false);
    }
  };

  const attach = useMutation({
    mutationFn: async () => {
      if (!preview || !target || !pickedId) throw new Error("Missing selection");
      // Flow-fallback rows can't be attached (no linked_token_* columns on flow_items).
      const isFlowFallback = target === "work" && (workRows.find((r: any) => r.id === pickedId) as any)?._isFlowFallback;
      if (isFlowFallback) {
        throw new Error("Post this as a Work first to attach a coin");
      }
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
      qc.invalidateQueries({ queryKey: ["launcher-projects"] });
      qc.invalidateQueries({ queryKey: ["launcher-works"] });
      setStep("celebrate");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not attach coin"),
  });

  const rows: any[] = target === "project" ? (projectsQ.data ?? []) : workRows;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => (r.title ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const rowsLoading = target === "project" ? projectsQ.isLoading : (worksQ.isLoading || flowQ.isLoading);

  const positive = (preview?.change24h ?? 0) >= 0;
  const changeStr =
    preview?.change24h == null ? "—" : `${positive ? "+" : ""}${preview.change24h.toFixed(1)}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="kinetic-theme p-0 gap-0 border-0 max-w-none w-screen h-screen sm:rounded-none bg-[var(--kb-bg)] overflow-hidden"
        style={{ background: "var(--kb-bg)" }}
      >
        <DialogTitle className="sr-only">Attach Coin</DialogTitle>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-25 blur-[140px]"
          style={{ background: "radial-gradient(circle, var(--kb-accent) 0%, transparent 60%)" }} />

        {/* Close */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center border transition-colors"
          style={{ borderColor: "var(--kb-border)", background: "rgba(255,255,255,0.03)" }}
          aria-label="Close"
        >
          <X className="h-5 w-5" style={{ color: "var(--kb-fg-dim)" }} />
        </button>

        {/* Back */}
        {step !== "paste" && step !== "celebrate" && (
          <button
            type="button"
            onClick={() => setStep(step === "pick" ? "target" : "paste")}
            className="absolute top-6 left-6 z-50 inline-flex items-center gap-2 px-4 h-11 rounded-full border text-xs uppercase tracking-widest font-semibold transition-colors"
            style={{ borderColor: "var(--kb-border)", color: "var(--kb-fg-dim)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}

        <div className="relative z-10 w-full h-full overflow-y-auto flex items-start md:items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-5xl">

            {/* STEP 1 — Paste CA */}
            {step === "paste" && (
              <div className="space-y-10 animate-fade-in">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--kb-accent)" }}>
                      Coin Attach Protocol
                    </span>
                  </div>
                  <h1 className="kb-display text-5xl md:text-8xl leading-[0.85]">
                    Attach <span style={{ color: "var(--kb-accent)" }}>Coin</span>
                  </h1>
                  <p className="text-lg max-w-lg mx-auto" style={{ color: "var(--kb-fg-dim)" }}>
                    Paste your pump.fun contract address to link a token to your work.
                  </p>
                </div>

                <div className="relative group">
                  <input
                    autoFocus
                    type="text"
                    value={ca}
                    onChange={(e) => setCa(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !fetching && fetchPreview()}
                    placeholder="Contract address (mint)…"
                    className="kb-mono w-full rounded-2xl p-6 md:p-8 text-lg md:text-2xl outline-none transition-all border-2 placeholder:opacity-30"
                    style={{
                      background: "var(--kb-surface)",
                      borderColor: ca && !isValidMint(ca) ? "#ef4444" : "var(--kb-border)",
                      color: "var(--kb-fg)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={fetchPreview}
                    disabled={fetching || !ca.trim()}
                    className="kb-display absolute right-3 top-1/2 -translate-y-1/2 px-6 md:px-8 h-14 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
                    style={{ background: "var(--kb-accent)", color: "var(--kb-bg)" }}
                  >
                    {fetching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
                  </button>
                </div>

                <p className="text-center text-xs" style={{ color: "var(--kb-fg-faint)" }}>
                  Rhozeland never custodies or trades your token. Attaching a coin adds a chip to your work that deeplinks to pump.fun.
                </p>
              </div>
            )}

            {/* STEP 2 — Target choice + live preview */}
            {step === "target" && preview && (
              <div className="space-y-8 animate-fade-in pt-14 md:pt-0">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--kb-accent)" }}>
                    Token Verified
                  </span>
                  <h2 className="kb-display text-4xl md:text-6xl mt-3">
                    What gets <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span>?
                  </h2>
                </div>

                {/* Live preview */}
                <div className="rounded-3xl p-6 md:p-7 border" style={{ background: "var(--kb-surface)", borderColor: "rgba(45,212,168,0.3)" }}>
                  <div className="flex items-center gap-4 md:gap-6">
                    {preview.imageUri ? (
                      <img src={preview.imageUri} alt="" className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover" />
                    ) : (
                      <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl flex items-center justify-center kb-display text-2xl"
                        style={{ background: "linear-gradient(135deg, var(--kb-accent), var(--kb-surface-2))", color: "var(--kb-bg)" }}>
                        ${preview.symbol.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="kb-display text-2xl md:text-3xl">${preview.symbol}</div>
                      <div className="text-sm truncate" style={{ color: "var(--kb-fg-dim)" }}>{preview.name}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="kb-display text-2xl" style={{ color: "var(--kb-accent)" }}>{fmtUsd(preview.priceUsd)}</div>
                      <div className="text-xs font-semibold inline-flex items-center gap-1"
                        style={{ color: positive ? "var(--kb-accent)" : "#ef4444" }}>
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {changeStr}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: "var(--kb-border)" }}>
                    <Stat label="Market Cap" value={fmtUsd(preview.marketCapUsd)} />
                    <Stat label="Holders" value={preview.holderCount?.toLocaleString() ?? "—"} />
                    <Stat label="24h" value={changeStr} positive={positive} />
                  </div>
                </div>

                {/* Target tiles */}
                <div className="grid md:grid-cols-2 gap-4">
                  <TargetTile
                    label="Release"
                    sublabel="Every post inside inherits the coin"
                    icon={FolderOpen}
                    onClick={() => { setTarget("project"); setPickedId(null); setStep("pick"); }}
                  />
                  <TargetTile
                    label="Track / Post"
                    sublabel="Attach to a single Flow drop"
                    icon={Music}
                    onClick={() => { setTarget("work"); setPickedId(null); setStep("pick"); }}
                  />
                </div>
              </div>
            )}

            {/* STEP 3 — Thumbnail picker */}
            {step === "pick" && preview && target && (
              <div className="space-y-6 animate-fade-in pt-14 md:pt-0">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--kb-accent)" }}>
                    Select target
                  </span>
                  <h2 className="kb-display text-3xl md:text-5xl mt-2">
                    {target === "project" ? "Which release" : "Which track"} gets <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span>?
                  </h2>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--kb-fg-faint)" }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border outline-none"
                    style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)", color: "var(--kb-fg)" }}
                  />
                </div>

                {rowsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background: "var(--kb-surface)" }} />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-3xl p-10 text-center border" style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
                    <ImageIcon className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--kb-fg-faint)" }} />
                    <p style={{ color: "var(--kb-fg-dim)" }}>
                      {target === "project"
                        ? "No releases yet — start one on your Releases workspace."
                        : "No posts yet — drop a work in Flow first."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[52vh] overflow-y-auto pr-2">
                    {filtered.map((r: any) => (
                      <PickTile
                        key={r.id}
                        row={r}
                        target={target}
                        active={pickedId === r.id}
                        current={r.linked_token_mint === preview.mint}
                        onClick={() => setPickedId(r.id)}
                      />
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => attach.mutate()}
                  disabled={!pickedId || attach.isPending}
                  className="kb-display w-full py-6 md:py-7 rounded-3xl text-xl md:text-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] shadow-[0_20px_60px_-15px_rgba(45,212,168,0.5)]"
                  style={{ background: "var(--kb-accent)", color: "var(--kb-bg)" }}
                >
                  {attach.isPending ? "Attaching…" : `Attach $${preview.symbol}`}
                </button>
              </div>
            )}

            {/* STEP 4 — Celebrate */}
            {step === "celebrate" && preview && (
              <div className="text-center animate-fade-in space-y-6 py-8">
                <div className="relative mx-auto h-32 w-32">
                  <div className="absolute inset-0 rounded-full blur-2xl opacity-60" style={{ background: "var(--kb-accent)" }} />
                  <div className="relative h-32 w-32 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, var(--kb-accent), var(--kb-surface))" }}>
                    <PartyPopper className="h-14 w-14" style={{ color: "var(--kb-bg)" }} />
                  </div>
                </div>

                <div className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--kb-accent)" }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--kb-accent)" }}>
                    On-chain credibility unlocked
                  </span>
                </div>

                <h2 className="kb-display text-5xl md:text-7xl">
                  <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span> attached
                </h2>
                <p className="max-w-lg mx-auto" style={{ color: "var(--kb-fg-dim)" }}>
                  {target === "project"
                    ? "Every post inside this release now carries the coin chip."
                    : "This post now carries the coin chip. Holders see it on chain."}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const path = target === "project" ? `/projects/${pickedId}` : `/flow?item=${pickedId}`;
                      onOpenChange(false);
                      navigate(path);
                    }}
                    className="kb-display px-8 py-4 rounded-2xl text-lg transition-all hover:scale-[1.02]"
                    style={{ background: "var(--kb-accent)", color: "var(--kb-bg)" }}
                  >
                    See it live
                  </button>
                  <a
                    href={`https://pump.fun/coin/${preview.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border text-sm font-semibold transition-colors"
                    style={{ borderColor: "var(--kb-border)", color: "var(--kb-fg)" }}
                  >
                    Open on pump.fun <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, positive }: { label: string; value: string; positive?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--kb-fg-faint)" }}>{label}</div>
    <div className="kb-display text-lg" style={{ color: positive === false ? "#ef4444" : "var(--kb-fg)" }}>{value}</div>
  </div>
);

const TargetTile = ({ label, sublabel, icon: Icon, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left p-6 md:p-8 rounded-3xl border transition-all hover:-translate-y-1 group"
    style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}
  >
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors group-hover:bg-[var(--kb-accent)] group-hover:text-[var(--kb-bg)]"
      style={{ background: "rgba(45,212,168,0.15)", color: "var(--kb-accent)" }}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="kb-display text-2xl md:text-3xl">{label}</div>
    <div className="text-sm mt-2" style={{ color: "var(--kb-fg-dim)" }}>{sublabel}</div>
  </button>
);

const PickTile = ({ row, target, active, current, onClick }: any) => {
  const cover = row.thumbnail_url || row.cover_url || row.cover_image_url;
  const bg = !cover && row.cover_color ? row.cover_color : undefined;
  const isVideo = target === "work" && row.kind === "video";
  const isAudio = target === "work" && (row.kind === "audio" || row.kind === "music");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-2xl overflow-hidden border-2 group text-left transition-all",
        active ? "scale-[1.03]" : "hover:scale-[1.02]",
      )}
      style={{
        borderColor: active ? "var(--kb-accent)" : "var(--kb-border)",
        background: cover ? "var(--kb-surface-2)" : bg ?? "var(--kb-surface)",
        boxShadow: active ? "0 0 0 4px rgba(45,212,168,0.15), 0 20px 40px -20px rgba(45,212,168,0.5)" : undefined,
      }}
      title={row.title || "Untitled"}
    >
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--kb-fg-faint)" }}>
          {target === "project" ? <FolderOpen className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      {/* Media badge */}
      {(isVideo || isAudio) && (
        <div className="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          {isVideo ? <Play className="h-3 w-3 fill-white text-white" /> : <Music className="h-3 w-3 text-white" />}
        </div>
      )}

      {/* Current mint chip */}
      {current && !active && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{ background: "var(--kb-accent)", color: "var(--kb-bg)" }}>
          Linked
        </div>
      )}

      {/* Active check */}
      {active && (
        <div className="absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center animate-scale-in"
          style={{ background: "var(--kb-accent)" }}>
          <Check className="h-3.5 w-3.5" style={{ color: "var(--kb-bg)" }} strokeWidth={4} />
        </div>
      )}

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="text-xs font-semibold text-white line-clamp-1">{row.title || "Untitled"}</div>
      </div>
    </button>
  );
};

export default AttachCoinLauncher;
