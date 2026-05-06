import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, MapPin, Calendar, Flame, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Creator = {
  name: string;
  handle: string;
  role: string;
  city: string;
  signal: number;
  color: string;
  coin?: string;
  events: number;
  drops: number;
  activeDays: number;
  mediums: string[];
  bio?: string;
};

const CREATORS: Creator[] = [
  { name: "Indoléstic", handle: "indolestic", role: "Graphic / Lifestyle", city: "Toronto", signal: 12, color: "#e84393", coin: "$INDO", events: 1, drops: 3, activeDays: 14, mediums: ["Design", "Lifestyle"], bio: "Quiet design studio shipping daily moodboards and small-run prints." },
  { name: "Vanshika K.", handle: "vanshika", role: "Photo / Fashion", city: "Toronto", signal: 41, color: "#8b45d4", coin: "$VK", events: 3, drops: 7, activeDays: 28, mediums: ["Photo", "Lifestyle"], bio: "Fashion editorial + behind-the-scenes drops from Toronto sets." },
  { name: "NightOwl", handle: "nightowl", role: "Music / Audio", city: "NYC", signal: 67, color: "#4a9eff", coin: "$OWL", events: 5, drops: 12, activeDays: 45, mediums: ["Music"], bio: "Late-night beat tapes and live loops streamed from a Brooklyn loft." },
  { name: "FrameHaus", handle: "framehaus", role: "Video / Design", city: "Berlin", signal: 55, color: "#00d4aa", coin: "$FRM", events: 4, drops: 8, activeDays: 33, mediums: ["Video", "Design"], bio: "Motion studio building title sequences and short-form film loops." },
  { name: "SummerCo", handle: "summerco", role: "Design / Photo", city: "Miami", signal: 29, color: "#f5a623", events: 2, drops: 5, activeDays: 19, mediums: ["Design", "Photo"], bio: "Sun-soaked brand work for hospitality and lifestyle clients." },
  { name: "Wavecraft", handle: "wavecraft", role: "Music / Audio", city: "Toronto", signal: 44, color: "#4a9eff", events: 6, drops: 9, activeDays: 38, mediums: ["Music"], bio: "Sound design + ambient releases tied to live listening sessions." },
  { name: "DesignLab", handle: "designlab", role: "Design / 3D", city: "London", signal: 61, color: "#8b45d4", coin: "$DLB", events: 3, drops: 11, activeDays: 29, mediums: ["Design", "3D"], bio: "3D playground exploring product render fictions and type studies." },
  { name: "Lenscraft", handle: "lenscraft", role: "Photo / Fashion", city: "NYC", signal: 38, color: "#e84393", events: 2, drops: 6, activeDays: 22, mediums: ["Photo", "Lifestyle"], bio: "Portrait + street fashion photography across NYC boroughs." },
];

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

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${hover ? -2 : 0}px)`,
        transition: "transform 250ms ease, border-color 250ms ease, box-shadow 250ms ease",
        borderColor: hover ? creator.color : undefined,
        boxShadow: hover ? `0 12px 32px -12px ${creator.color}55` : undefined,
      }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* Cover strip */}
      <div
        className="h-20 w-full"
        style={{
          background: `linear-gradient(135deg, ${creator.color}, ${creator.color}55 60%, hsl(var(--card)))`,
        }}
      />

      <div className="px-5 pb-5">
        {/* Avatar */}
        <div
          className="-mt-10 mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-muted shadow-sm overflow-hidden"
          style={{ boxShadow: `0 0 0 2px ${creator.color}` }}
        >
          <span className="font-display text-lg font-bold text-muted-foreground">
            {initials(creator.name)}
          </span>
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
          <span className="opacity-50">·</span>
          <MapPin className="h-3 w-3" />
          {creator.city}
        </p>

        {/* Mediums */}
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
              {featured && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{tier}</span>}
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
          <Button variant="outline" size="sm" className="flex-1 rounded-full">
            Follow
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-full"
            onClick={() => navigate(`/messages?to=${creator.handle}`)}
          >
            Message →
          </Button>
        </div>
      </div>
    </div>
  );
};

const CreatorsPage = () => {
  const [search, setSearch] = useState("");
  const [medium, setMedium] = useState("All");
  const [sort, setSort] = useState<SortKey>("Trending");

  const filtered = useMemo(() => {
    let list = CREATORS.filter((c) => {
      if (medium !== "All" && !c.mediums.includes(medium)) return false;
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
    if (sort === "Newest") list = [...list].reverse();
    if (sort === "Trending") list = [...list].sort((a, b) => b.activeDays - a.activeDays);
    return list;
  }, [search, medium, sort]);

  const clearFilters = () => {
    setSearch("");
    setMedium("All");
    setSort("Trending");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Sticky filter bar */}
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

      {/* Grid */}
      {filtered.length === 0 ? (
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
              <div
                key={c.handle}
                className={featured ? "md:col-span-2" : ""}
              >
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
