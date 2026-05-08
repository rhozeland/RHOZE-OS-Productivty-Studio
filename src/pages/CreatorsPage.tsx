import { useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, Flame, Activity, ArrowLeft, Heart, X, Sparkles, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Creator = {
  user_id: string;
  name: string;
  handle: string;
  role: string;
  city: string;
  signal: number;
  color: string;
  avatar_url?: string | null;
  banner_gradient?: string | null;
  events: number;
  drops: number;
  activeDays: number;
  mediums: string[];
  bio?: string;
};

const ACCENT_COLORS = ["#e84393", "#8b45d4", "#4a9eff", "#00d4aa", "#f5a623"];
const pickColor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_COLORS[h % ACCENT_COLORS.length];
};

const MEDIUM_FILTERS = ["All", "Music", "Design", "Photo", "Video", "Lifestyle", "3D"];
const SORT_OPTIONS = ["Trending", "Newest", "Signal"] as const;
type SortKey = typeof SORT_OPTIONS[number];

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const hashNum = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

/* ------------------------------------------------------------------ */
/* Compact, uniform creator card                                       */
/* ------------------------------------------------------------------ */
const CreatorCard = ({ creator }: { creator: Creator }) => {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const open = () => navigate(`/profiles/${creator.user_id}`);
  const fillPct = Math.min(100, Math.max(4, creator.signal));
  const banner =
    creator.banner_gradient ||
    `linear-gradient(135deg, ${creator.color}, ${creator.color}33 70%, hsl(var(--card)))`;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        borderColor: hover ? creator.color : undefined,
        boxShadow: hover ? `0 8px 24px -10px ${creator.color}55` : undefined,
      }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 flex flex-col"
    >
      {/* Cover strip — shorter */}
      <div className="h-14 w-full" style={{ background: banner }} />

      {/* Avatar overlapping cover */}
      <div className="px-4 -mt-7">
        <div
          className="h-14 w-14 rounded-full border-4 border-card overflow-hidden flex items-center justify-center"
          style={{
            background: creator.avatar_url
              ? "hsl(var(--muted))"
              : `linear-gradient(135deg, ${creator.color}, ${creator.color}88)`,
            boxShadow: `0 0 0 2px ${creator.color}`,
          }}
        >
          {creator.avatar_url ? (
            <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-base font-bold text-white drop-shadow-sm">
              {initials(creator.name)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 flex-1 flex flex-col">
        {/* Name + handle */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <h3 className="font-display font-semibold text-foreground text-sm leading-tight truncate">
            {creator.name}
          </h3>
          <span className="text-[11px] text-muted-foreground truncate">@{creator.handle}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {creator.role}
          {creator.city && <span className="opacity-60"> · {creator.city}</span>}
        </p>

        {/* Mediums — max 3 */}
        {creator.mediums.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {creator.mediums.slice(0, 3).map((m) => (
              <span
                key={m}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Signal bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">
              Signal
            </span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: creator.color }}>
              {creator.signal}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${fillPct}%`, background: creator.color }}
            />
          </div>
        </div>

        {/* Inline stats row */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2.5">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className="font-semibold text-foreground">{creator.events}</span>
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3" />
            <span className="font-semibold text-foreground">{creator.drops}</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            <span className="font-semibold text-foreground">{creator.activeDays}d</span>
          </span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Match Mode — minimal Tinder-style swipe overlay                     */
/* ------------------------------------------------------------------ */
const MatchMode = ({
  creators,
  onClose,
}: {
  creators: Creator[];
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);

  const current = creators[idx];
  const next = creators[idx + 1];

  const advance = (dir: "left" | "right") => {
    setDrag(0);
    if (dir === "right" && current) {
      navigate(`/messages?to=${current.handle}`);
      return;
    }
    setIdx((i) => i + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    setDrag(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (Math.abs(drag) > 110) advance(drag > 0 ? "right" : "left");
    else setDrag(0);
    startX.current = null;
  };

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🌹</div>
        <p className="font-display text-xl text-foreground mb-2">All caught up.</p>
        <p className="text-sm text-muted-foreground mb-6">You've seen everyone in this filter.</p>
        <Button onClick={onClose} className="rounded-full">Back to grid</Button>
      </div>
    );
  }

  const rotate = drag / 20;
  const opacity = 1 - Math.min(1, Math.abs(drag) / 300);
  const banner =
    current.banner_gradient ||
    `linear-gradient(135deg, ${current.color}, ${current.color}55 60%, hsl(var(--card)))`;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">Match Mode</span>
          <span className="text-[11px] text-muted-foreground">
            {idx + 1} / {creators.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">
          Close
        </Button>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="relative w-full max-w-sm h-[520px]">
          {/* Next card peek */}
          {next && (
            <div className="absolute inset-0 rounded-3xl border border-border bg-card scale-95 opacity-60" />
          )}
          {/* Active card */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform: `translateX(${drag}px) rotate(${rotate}deg)`,
              opacity,
              transition: startX.current ? "none" : "transform 250ms ease, opacity 250ms ease",
              touchAction: "none",
            }}
            className="absolute inset-0 rounded-3xl border border-border bg-card overflow-hidden shadow-xl select-none cursor-grab active:cursor-grabbing"
          >
            <div className="h-32 w-full" style={{ background: banner }} />
            <div className="px-6 -mt-12">
              <div
                className="h-24 w-24 rounded-full border-4 border-card overflow-hidden flex items-center justify-center mx-auto"
                style={{
                  background: current.avatar_url
                    ? "hsl(var(--muted))"
                    : `linear-gradient(135deg, ${current.color}, ${current.color}88)`,
                  boxShadow: `0 0 0 2px ${current.color}`,
                }}
              >
                {current.avatar_url ? (
                  <img src={current.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-2xl font-bold text-white drop-shadow">
                    {initials(current.name)}
                  </span>
                )}
              </div>
              <div className="text-center mt-3">
                <h3 className="font-display text-lg font-bold text-foreground">{current.name}</h3>
                <p className="text-xs text-muted-foreground">
                  @{current.handle}
                  {current.city && <> · {current.city}</>}
                </p>
                <p className="text-sm text-foreground/80 mt-1">{current.role}</p>
              </div>

              {current.mediums.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                  {current.mediums.slice(0, 5).map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  { Icon: Calendar, label: "Events", value: current.events },
                  { Icon: Flame, label: "Drops", value: current.drops },
                  { Icon: Activity, label: "Active", value: `${current.activeDays}d` },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-background/40 py-2">
                    <Icon className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm font-semibold">{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Swipe labels */}
            {drag < -40 && (
              <div className="absolute top-6 left-6 px-3 py-1 rounded-full border-2 border-muted-foreground text-muted-foreground font-display text-sm font-bold rotate-[-12deg]">
                PASS
              </div>
            )}
            {drag > 40 && (
              <div
                className="absolute top-6 right-6 px-3 py-1 rounded-full border-2 font-display text-sm font-bold rotate-[12deg]"
                style={{ borderColor: current.color, color: current.color }}
              >
                CONNECT
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 pb-8 pt-2">
        <button
          onClick={() => advance("left")}
          className="h-14 w-14 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
          aria-label="Pass"
        >
          <X className="h-6 w-6 text-muted-foreground" />
        </button>
        <button
          onClick={() => navigate(`/profiles/${current.user_id}`)}
          className="h-12 w-12 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
          aria-label="View profile"
        >
          <Sparkles className="h-5 w-5 text-foreground" />
        </button>
        <button
          onClick={() => advance("right")}
          className="h-14 w-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: current.color }}
          aria-label="Connect"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
const CreatorsPage = () => {
  const [search, setSearch] = useState("");
  const [medium, setMedium] = useState("All");
  const [sort, setSort] = useState<SortKey>("Trending");
  const [matchOpen, setMatchOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["creators-page-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const creators: Creator[] = useMemo(() => {
    return (profiles ?? [])
      .filter((p: any) => p.is_public !== false)
      .map((p: any) => {
        const name = p.display_name || p.username || "Creator";
        const handle = p.username || (p.user_id ? p.user_id.slice(0, 8) : "creator");
        const mediums: string[] = Array.isArray(p.mediums) ? p.mediums : [];
        const skills: string[] = Array.isArray(p.skills) ? p.skills : [];
        const roles: string[] = Array.isArray(p.creator_roles) ? p.creator_roles : [];
        const role =
          p.headline ||
          (mediums.length > 0 ? mediums.slice(0, 2).join(" / ") : "Creator");
        return {
          user_id: p.user_id,
          name,
          handle,
          role,
          city: p.location || "",
          signal: 20 + hashNum(p.user_id || name, 70),
          color: pickColor(p.user_id || name),
          avatar_url: p.avatar_url,
          banner_gradient: p.banner_gradient,
          events: hashNum((p.user_id || name) + "e", 8),
          drops: hashNum((p.user_id || name) + "d", 14),
          activeDays: hashNum((p.user_id || name) + "a", 50),
          mediums,
          bio: p.bio || "",
          _tags: [...mediums, ...skills, ...roles, p.headline || "", p.bio || ""]
            .join(" ")
            .toLowerCase(),
        } as Creator & { _tags: string };
      });
  }, [profiles]);

  const filtered = useMemo(() => {
    let list = creators.filter((c) => {
      if (medium !== "All" && !c.mediums.some((m) => m.toLowerCase() === medium.toLowerCase()))
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (sort === "Signal") list = [...list].sort((a, b) => b.signal - a.signal);
    if (sort === "Trending") list = [...list].sort((a, b) => b.activeDays - a.activeDays);
    return list;
  }, [creators, search, medium, sort]);

  const clearFilters = () => {
    setSearch("");
    setMedium("All");
    setSort("Trending");
  };

  return (
    <div className="space-y-6">
      <Link
        to="/discover"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Discover
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1.5">
            Creators
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Find your next collaborator.
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Verified artists across music, design, photo and more — sorted by signal.
          </p>
        </div>

        <Button
          onClick={() => setMatchOpen(true)}
          disabled={filtered.length === 0}
          className="rounded-full gap-2 shrink-0"
        >
          <Heart className="h-4 w-4" />
          Match Mode
        </Button>
      </div>

      <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search creators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>

          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              {MEDIUM_FILTERS.map((m) => {
                const active = medium === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMedium(m)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all whitespace-nowrap ${
                      active
                        ? "border-foreground/60 bg-foreground text-background shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shrink-0">
            {SORT_OPTIONS.map((s) => {
              const active = sort === s;
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-56 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🫥</div>
          <p className="text-foreground font-medium">No creators match that filter.</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={clearFilters}>
            Clear filters →
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((c) => (
            <CreatorCard key={c.user_id} creator={c} />
          ))}
        </div>
      )}

      {matchOpen && <MatchMode creators={filtered} onClose={() => setMatchOpen(false)} />}
    </div>
  );
};

export default CreatorsPage;
