/**
 * AttachCoinLauncher — v12.1 lightbox coin attach.
 *
 * Compact centered Dialog (not fullscreen). Text-forward project tiles so
 * empty projects don't look like sad purple boxes. Filters Flow-fallback
 * rows out of the picker with a friendlier line explaining why.
 *
 * Flow: paste CA → live preview + target choice → picker → celebration.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
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

  const rows: any[] = target === "project" ? (projectsQ.data ?? []) : (worksQ.data ?? []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => (r.title ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const rowsLoading = target === "project" ? projectsQ.isLoading : worksQ.isLoading;

  const positive = (preview?.change24h ?? 0) >= 0;
  const changeStr =
    preview?.change24h == null ? "—" : `${positive ? "+" : ""}${preview.change24h.toFixed(1)}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="kinetic-theme p-0 gap-0 max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-hidden rounded-3xl border"
        style={{ background: "var(--kb-bg)", borderColor: "var(--kb-border)" }}
      >
        <DialogTitle className="sr-only">Attach Coin</DialogTitle>

        {/* Back (inline, not floating) */}
        {step !== "paste" && step !== "celebrate" && (
          <button
            type="button"
            onClick={() => setStep(step === "pick" ? "target" : "paste")}
            className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-black/5 transition-colors"
            style={{ color: "var(--kb-fg-dim)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--kb-fg-dim)" }} />
        </button>

        <div className="relative overflow-y-auto max-h-[85vh] px-6 md:px-8 py-8 md:py-10">

          {/* STEP 1 — Paste CA */}
          {step === "paste" && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--kb-accent)" }}>
                    Attach a coin
                  </span>
                </div>
                <h1 className="kb-display text-3xl md:text-4xl leading-tight">
                  Paste the <span style={{ color: "var(--kb-accent)" }}>contract</span>
                </h1>
                <p className="text-sm max-w-md mx-auto" style={{ color: "var(--kb-fg-dim)" }}>
                  Drop your pump.fun mint address — we'll pull the ticker, price, and market cap.
                </p>
              </div>

              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  value={ca}
                  onChange={(e) => setCa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !fetching && fetchPreview()}
                  placeholder="Contract address…"
                  className="kb-mono w-full rounded-xl px-4 py-4 pr-28 text-sm outline-none transition-all border placeholder:opacity-40"
                  style={{
                    background: "var(--kb-surface-2)",
                    borderColor: ca && !isValidMint(ca) ? "#ef4444" : "var(--kb-border)",
                    color: "var(--kb-fg)",
                  }}
                />
                <button
                  type="button"
                  onClick={fetchPreview}
                  disabled={fetching || !ca.trim()}
                  className="kb-display absolute right-2 top-1/2 -translate-y-1/2 px-5 h-10 rounded-lg text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--kb-accent)", color: "#fff" }}
                >
                  {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </button>
              </div>

              <p className="text-center text-[11px]" style={{ color: "var(--kb-fg-faint)" }}>
                Rhozeland never custodies or trades. The chip deep-links to pump.fun.
              </p>
            </div>
          )}

          {/* STEP 2 — Target choice + live preview */}
          {step === "target" && preview && (
            <div className="space-y-6 animate-fade-in pt-4">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--kb-accent)" }}>
                  Verified
                </span>
                <h2 className="kb-display text-2xl md:text-3xl mt-2">
                  What gets <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span>?
                </h2>
              </div>

              {/* Preview card */}
              <div className="rounded-2xl p-4 border" style={{ background: "var(--kb-surface-2)", borderColor: "var(--kb-border)" }}>
                <div className="flex items-center gap-3">
                  {preview.imageUri ? (
                    <img src={preview.imageUri} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center kb-display text-lg"
                      style={{ background: "var(--kb-accent)", color: "#fff" }}>
                      {preview.symbol.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="kb-display text-lg leading-none">${preview.symbol}</div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--kb-fg-dim)" }}>{preview.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="kb-display text-base" style={{ color: "var(--kb-accent)" }}>{fmtUsd(preview.priceUsd)}</div>
                    <div className="text-[10px] font-semibold inline-flex items-center gap-0.5"
                      style={{ color: positive ? "var(--kb-accent)" : "#ef4444" }}>
                      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {changeStr}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t text-[11px]" style={{ borderColor: "var(--kb-border)" }}>
                  <Stat label="MC" value={fmtUsd(preview.marketCapUsd)} />
                  <Stat label="Holders" value={preview.holderCount?.toLocaleString() ?? "—"} />
                  <Stat label="24h" value={changeStr} positive={positive} />
                </div>
              </div>

              {/* Target tiles — compact side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                <TargetTile
                  label="Release"
                  sublabel="A whole project"
                  icon={FolderOpen}
                  onClick={() => { setTarget("project"); setPickedId(null); setStep("pick"); }}
                />
                <TargetTile
                  label="Track"
                  sublabel="One post"
                  icon={Music}
                  onClick={() => { setTarget("work"); setPickedId(null); setStep("pick"); }}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — Picker */}
          {step === "pick" && preview && target && (
            <div className="space-y-4 animate-fade-in pt-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--kb-accent)" }}>
                  Pick target
                </span>
                <h2 className="kb-display text-2xl md:text-3xl mt-1">
                  {target === "project" ? "Which release" : "Which track"} gets <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span>?
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--kb-fg-faint)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${target === "project" ? "releases" : "tracks"}…`}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border outline-none text-sm"
                  style={{ background: "var(--kb-surface-2)", borderColor: "var(--kb-border)", color: "var(--kb-fg)" }}
                />
              </div>

              {rowsLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--kb-surface-2)" }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl p-8 text-center border" style={{ background: "var(--kb-surface-2)", borderColor: "var(--kb-border)" }}>
                  {target === "project" ? (
                    <>
                      <FolderOpen className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--kb-fg-faint)" }} />
                      <p className="text-sm" style={{ color: "var(--kb-fg-dim)" }}>No releases yet.</p>
                      <p className="text-xs mt-1" style={{ color: "var(--kb-fg-faint)" }}>Spin one up in your Releases workspace, then come back.</p>
                    </>
                  ) : (
                    <>
                      <Music className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--kb-fg-faint)" }} />
                      <p className="text-sm" style={{ color: "var(--kb-fg-dim)" }}>No tracks yet.</p>
                      <p className="text-xs mt-1" style={{ color: "var(--kb-fg-faint)" }}>
                        Flow posts show up here once you save them as Works from Settings › Verified IP.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-h-[36vh] overflow-y-auto pr-1 -mr-1 space-y-1.5">
                  {filtered.map((r: any) => (
                    <PickRow
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
                className="kb-display w-full py-4 rounded-2xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--kb-accent)", color: "#fff" }}
              >
                {attach.isPending ? "Attaching…" : `Attach $${preview.symbol}`}
              </button>
            </div>
          )}

          {/* STEP 4 — Celebrate */}
          {step === "celebrate" && preview && (
            <div className="text-center animate-fade-in space-y-4 py-4">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: "var(--kb-accent)" }} />
                <div className="relative h-20 w-20 rounded-full flex items-center justify-center"
                  style={{ background: "var(--kb-accent)" }}>
                  <PartyPopper className="h-9 w-9 text-white" />
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" style={{ color: "var(--kb-accent)" }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--kb-accent)" }}>
                  On-chain credibility
                </span>
              </div>

              <h2 className="kb-display text-3xl md:text-4xl">
                <span style={{ color: "var(--kb-accent)" }}>${preview.symbol}</span> attached
              </h2>
              <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--kb-fg-dim)" }}>
                {target === "project"
                  ? "Every post inside this release now carries the coin chip."
                  : "This track now carries the coin chip. Holders see it on-chain."}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const path = target === "project" ? `/projects/${pickedId}` : `/flow?item=${pickedId}`;
                    onOpenChange(false);
                    navigate(path);
                  }}
                  className="kb-display px-5 py-2.5 rounded-xl text-xs transition-all"
                  style={{ background: "var(--kb-accent)", color: "#fff" }}
                >
                  See it live
                </button>
                <a
                  href={`https://pump.fun/coin/${preview.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border text-xs font-semibold transition-colors"
                  style={{ borderColor: "var(--kb-border)", color: "var(--kb-fg)" }}
                >
                  pump.fun <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, positive }: { label: string; value: string; positive?: boolean }) => (
  <div>
    <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>{label}</div>
    <div className="kb-display text-xs mt-0.5" style={{ color: positive === false ? "#ef4444" : "var(--kb-fg)" }}>{value}</div>
  </div>
);

const TargetTile = ({ label, sublabel, icon: Icon, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left p-4 rounded-2xl border transition-all hover:-translate-y-0.5 group"
    style={{ background: "var(--kb-surface-2)", borderColor: "var(--kb-border)" }}
  >
    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--kb-accent)] group-hover:text-white"
      style={{ background: "color-mix(in srgb, var(--kb-accent) 15%, transparent)", color: "var(--kb-accent)" }}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="kb-display text-lg leading-none">{label}</div>
    <div className="text-xs mt-1" style={{ color: "var(--kb-fg-dim)" }}>{sublabel}</div>
  </button>
);

/**
 * PickRow — text-forward list row. No sad purple boxes for projects
 * without covers; the title carries the tile.
 */
const PickRow = ({ row, target, active, current, onClick }: any) => {
  const cover = row.thumbnail_url || row.cover_url || row.cover_image_url;
  const isVideo = target === "work" && row.kind === "video";
  const isAudio = target === "work" && (row.kind === "audio" || row.kind === "music");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left",
        active ? "" : "hover:bg-[var(--kb-surface-2)]",
      )}
      style={{
        background: active ? "color-mix(in srgb, var(--kb-accent) 10%, transparent)" : "transparent",
        borderColor: active ? "var(--kb-accent)" : "var(--kb-border)",
      }}
      title={row.title || "Untitled"}
    >
      {/* Thumb / initial */}
      <div className="relative h-12 w-12 rounded-lg overflow-hidden flex-shrink-0"
        style={{ background: cover ? "var(--kb-surface-2)" : (row.cover_color || "var(--kb-surface-2)") }}>
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center kb-display text-lg" style={{ color: "var(--kb-fg-dim)" }}>
            {(row.title || "·").slice(0, 1).toUpperCase()}
          </div>
        )}
        {(isVideo || isAudio) && (
          <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}>
            {isVideo ? <Play className="h-2 w-2 fill-white text-white" /> : <Music className="h-2 w-2 text-white" />}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "var(--kb-fg)" }}>
          {row.title || "Untitled"}
        </div>
        <div className="text-[11px] truncate" style={{ color: "var(--kb-fg-faint)" }}>
          {target === "project"
            ? (row.description || "No description")
            : (row.kind ? row.kind.toUpperCase() : "POST")}
        </div>
      </div>

      {/* Right side */}
      {current && !active && (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{ background: "color-mix(in srgb, var(--kb-accent) 15%, transparent)", color: "var(--kb-accent)" }}>
          Linked
        </span>
      )}
      {active && (
        <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--kb-accent)" }}>
          <Check className="h-3 w-3 text-white" strokeWidth={4} />
        </div>
      )}
    </button>
  );
};

export default AttachCoinLauncher;
