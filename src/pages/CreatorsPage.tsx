import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Calendar, Flame, Activity } from "lucide-react";
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
  coin?: string;
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

const signalTier = (s: number) => (s <= 40 ? "Early Signal" : s <= 70 ? "Rising" : "Established");

const TiltCard = ({ creator, featured }: { creator: Creator; featured: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hover, setHover] = useState(false);
  const navigate = useNavigate();

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 6, ry: px * 6 });
  };
  const reset = () => {
    setTilt({ rx: 0, ry: 0 });
    setHover(false);
  };

  const fillPct = Math.min(100, Math.max(4, creator.signal));
  const tier = signalTier(creator.signal);
  const openProfile = () => navigate(`/profiles/${creator.user_id}`);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      onClick={openProfile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProfile();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${hover ? -2 : 0}px)`,
        transition: "transform 250ms ease, border-color 250ms ease, box-shadow 250ms ease",
        borderColor: hover ? creator.color : undefined,
        boxShadow: hover ? `0 12px 32px -12px ${creator.color}55` : undefined,
      }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {/* Cover strip */}
      <div
        className="h-20 w-full"
        style={{
          background:
            creator.banner_gradient ||
            `linear-gradient(135deg, ${creator.color}, ${creator.color}55 60%, hsl(var(--card)))`,
        }}
      />

      <div className="px-5 pb-5">
        {/* Avatar */}
        <div
          className="-mt-10 mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-muted shadow-sm overflow-hidden"
          style={{ boxShadow: `0 0 0 2px ${creator.color}` }}
        >
          {creator.avatar_url ? (
            <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-lg font-bold text-muted-foreground">
              {initials(creator.name)}
            </span>
          )}
        </div>

        {/* Name + handle + role */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-foreground text-base">{creator.name}</h3>
          <span className="text-xs text-muted-foreground">@{creator.handle}</span>
          {creator.coin && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
              style={{ color: creator.color, borderColor: `${creator.color}55` }}
            >
              {creator.coin}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {creator.role}
          {creator.city && (
            <>
              <span className="opacity-50">·</span>
              <MapPin className="h-3 w-3" />
              {creator.city}
            </>
          )}
        </p>

        {/* Mediums */}
        {creator.mediums.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {creator.mediums.map((m) => (
              <span
                key={m}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Featured bio */}
        {featured && creator.bio && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>
        )}

        {/* Signal bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Creator Signal
            </span>
            <span className="text-xs font-semibold" style={{ color: creator.color }}>
              {creator.signal}
              {featured && (
                <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{tier}</span>
              )}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${fillPct}%`, background: creator.color }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { Icon: Calendar, label: "Events", value: creator.events },
            { Icon: Flame, label: "Drops", value: creator.drops },
            { Icon: Activity, label: "Active Days", value: creator.activeDays },
          ].map(({ Icon, label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-background/40 px-2 py-2 text-center"
            >
              <Icon className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
              <div className="text-sm font-semibold text-foreground leading-none">{value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              openProfile();
            }}
          >
            View Profile
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/messages?to=${creator.handle}`);
            }}
          >
            Message →
          </Button>
        </div>
      </div>
    </div>
  );
};

const hashNum = (s: string, mod: number) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
};

const CreatorsPage = () => {
  const [search, setSearch] = useState("");
  const [medium, setMedium] = useState("All");
  const [sort, setSort] = useState<SortKey>("Trending");
  const navigate = useNavigate();

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
        } as Creator;
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
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 rounded-2xl border border-border bg-card animate-pulse" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {filtered.map((c, i) => {
            const featured = i === 0 || (i + 1) % 5 === 0;
            return (
              <div key={c.user_id} className={featured ? "md:col-span-2" : ""}>
                <TiltCard creator={c} featured={featured} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreatorsPage;
