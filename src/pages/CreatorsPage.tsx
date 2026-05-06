import { useMemo, useRef, useState, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Briefcase, Calendar, Sparkles, Activity, UserPlus, Users } from "lucide-react";

type Creator = {
  name: string;
  handle: string;
  role: string;
  location: string;
  signal: number;
  color: string;
  coin: string | null;
  events: number;
  drops: number;
  activeDays: number;
  mediums: string[];
  bio: string;
};

const CREATORS: Creator[] = [
  { name: "Indoléstic", handle: "indolestic", role: "Graphic / Lifestyle", location: "Toronto", signal: 12, color: "#e84393", coin: "$INDO", events: 1, drops: 3, activeDays: 14, mediums: ["Graphic", "Lifestyle"], bio: "Editorial collages, soft pop palettes, and zines from the east end. Building slow." },
  { name: "Vanshika K.", handle: "vanshika", role: "Photo / Fashion", location: "Toronto", signal: 41, color: "#8b45d4", coin: "$VK", events: 3, drops: 7, activeDays: 28, mediums: ["Photo", "Fashion"], bio: "Studio portraiture and runway docs. Currently shooting a SS26 lookbook." },
  { name: "NightOwl", handle: "nightowl", role: "Music / Audio", location: "NYC", signal: 67, color: "#4a9eff", coin: "$OWL", events: 5, drops: 12, activeDays: 45, mediums: ["Music", "Audio"], bio: "Late-night basslines and ambient interludes. Resident at three rooms in Brooklyn." },
  { name: "FrameHaus", handle: "framehaus", role: "Video / Design", location: "Berlin", signal: 55, color: "#00d4aa", coin: "$FRM", events: 4, drops: 8, activeDays: 33, mediums: ["Video", "Design"], bio: "Motion-first studio. Title sequences, brand films, the occasional music video." },
  { name: "SummerCo", handle: "summerco", role: "Design / Photo", location: "Miami", signal: 29, color: "#f5a623", coin: null, events: 2, drops: 5, activeDays: 19, mediums: ["Design", "Photo"], bio: "Sun-bleached identity work. Type, posters, and beachy brand systems." },
  { name: "Wavecraft", handle: "wavecraft", role: "Music / Audio", location: "Toronto", signal: 44, color: "#4a9eff", coin: null, events: 6, drops: 9, activeDays: 38, mediums: ["Music", "Audio"], bio: "House cuts, mixing services, and a monthly tape series." },
  { name: "DesignLab", handle: "designlab", role: "Design / 3D", location: "London", signal: 61, color: "#8b45d4", coin: "$DLB", events: 3, drops: 11, activeDays: 29, mediums: ["Design", "3D"], bio: "3D objects, generative type, and surreal product renders." },
  { name: "Lenscraft", handle: "lenscraft", role: "Photo / Fashion", location: "NYC", signal: 38, color: "#e84393", coin: null, events: 2, drops: 6, activeDays: 22, mediums: ["Photo", "Fashion"], bio: "Editorial photographer working between NYC and CDMX." },
];

const FILTERS = ["All", "Music", "Design", "Photo", "Video", "Lifestyle", "3D"];
const SORTS = ["Trending", "Newest", "Signal"] as const;

const tierFor = (s: number) =>
  s <= 40 ? { label: "Early Signal", color: "#f5c451" } :
  s <= 70 ? { label: "Rising", color: "#4a9eff" } :
           { label: "Established", color: "#34d399" };

const CreatorCard = ({ c, featured }: { c: Creator; featured: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const tier = tierFor(c.signal);

  const onMove = (e: MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 6, y: px * 6 });
  };
  const onLeave = () => { setHover(false); setTilt({ x: 0, y: 0 }); };

  const coverHeight = featured ? "h-[45%]" : "h-[35%]";

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      className={`relative rounded-2xl border overflow-hidden flex flex-col ${featured ? "min-h-[420px]" : "min-h-[380px]"}`}
      style={{
        background: "#0e0e18",
        borderColor: hover ? `${c.color}99` : "#1e1e30",
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hover ? "translateY(-6px) scale(1.01)" : ""}`,
        transformStyle: "preserve-3d",
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), border-color 0.3s, box-shadow 0.3s",
        boxShadow: hover ? `0 20px 60px ${c.color}22` : "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Cover */}
      <div className={`relative ${coverHeight} overflow-hidden`}>
        <div
          className={hover ? "creator-cover-fast" : "creator-cover"}
          style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(135deg, ${c.color}, ${c.color}55, #1a1a2e, ${c.color}88)`,
            backgroundSize: "300% 300%",
          }}
        />
        {/* noise */}
        <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay" style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        }} />
        {featured && (
          <>
            <span className="absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide"
              style={{ background: "rgba(0,0,0,0.55)", color: tier.color, border: `1px solid ${tier.color}66` }}>
              {tier.label}
            </span>
            {/* particles */}
            {[0,1,2,3,4,5].map(i => (
              <span key={i} className="creator-particle" style={{
                left: `${10 + i * 14}%`,
                animationDelay: `${i * 0.7}s`,
                background: "rgba(255,255,255,0.55)",
              }} />
            ))}
          </>
        )}
        {c.coin && (
          <span className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-mono"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}>
            {c.coin}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 px-5 pb-5 pt-0">
        {/* Avatar */}
        <div className="flex items-end gap-3 -mt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${c.color}, ${c.color}99)`,
              border: `3px solid ${c.color}`,
              boxShadow: `0 0 20px ${c.color}55`,
            }}>
            {c.name[0]}
          </div>
          <div className="pb-1 min-w-0">
            <div className="text-[17px] font-bold text-white truncate">{c.name}</div>
            <div className="text-[13px] text-[#8080a0] truncate">@{c.handle}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-[#9090b0]">
          <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{c.role}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.mediums.map(m => (
            <span key={m} className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}33` }}>
              {m}
            </span>
          ))}
        </div>

        {featured && (
          <p className="mt-3 text-xs text-[#a0a0c0] line-clamp-2">{c.bio}</p>
        )}

        <div className="my-3 h-px bg-[#1e1e30]" />

        {/* Signal */}
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#8080a0]">
            <span>Signal</span>
            <span className="text-base font-bold text-white normal-case tracking-normal">{c.signal}</span>
          </div>
          <div className={`mt-1.5 h-2 rounded-full overflow-hidden ${featured ? "h-2.5" : ""}`} style={{ background: "#181828" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${c.signal}%`,
                background: `linear-gradient(90deg, ${c.color}, ${c.color}cc)`,
                boxShadow: `0 0 12px ${c.color}aa`,
              }} />
          </div>
        </div>

        {/* Micro stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[#9090b0]">
          <div className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{c.events} events</div>
          <div className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />{c.drops} drops</div>
          <div className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{c.activeDays}d</div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: `${c.color}88`, color: c.color, background: "transparent" }}>
            Follow
          </button>
          <button className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: c.color }}>
            Message →
          </button>
        </div>
      </div>
    </div>
  );
};

const CreatorsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<typeof SORTS[number]>("Trending");

  const filtered = useMemo(() => {
    let list = CREATORS.filter(c => {
      if (filter !== "All" && !c.role.toLowerCase().includes(filter.toLowerCase()) &&
          !c.mediums.some(m => m.toLowerCase() === filter.toLowerCase())) return false;
      if (search && !`${c.name} ${c.handle} ${c.role} ${c.location}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sort === "Signal") list = [...list].sort((a, b) => b.signal - a.signal);
    if (sort === "Newest") list = [...list].reverse();
    return list;
  }, [search, filter, sort]);

  const clear = () => { setSearch(""); setFilter("All"); };

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0a14" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl border-b" style={{ background: "rgba(10,10,20,0.85)", borderColor: "#1e1e30" }}>
        <div className="px-6 py-4">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Creators</h1>
              <p className="text-xs text-[#8080a0]">A directory of artists building in the open.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8080a0]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find a creator..."
                className="w-full rounded-full border pl-9 pr-4 py-2 text-sm placeholder:text-[#8080a0] focus:outline-none focus:border-[#e84393]/60"
                style={{ background: "#13131e", borderColor: "#22223a", color: "#fff" }}
              />
            </div>

            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {FILTERS.map(f => {
                  const active = filter === f;
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background: active ? "#e84393" : "#13131e",
                        color: active ? "#fff" : "#8080a0",
                        border: `1px solid ${active ? "#e84393" : "#22223a"}`,
                      }}>
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-full p-0.5" style={{ background: "#13131e", border: "1px solid #22223a" }}>
                {SORTS.map(s => (
                  <button key={s} onClick={() => setSort(s)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: sort === s ? "#22223a" : "transparent",
                      color: sort === s ? "#fff" : "#8080a0",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #e84393, #8b45d4)" }}>
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 py-6" style={{ perspective: 1000 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="h-14 w-14 text-[#3a3a55] mb-4" />
            <p className="text-base text-white">No creators match that filter.</p>
            <button onClick={clear} className="mt-3 text-sm text-[#8080a0] hover:text-white transition-colors">
              Clear filters →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {filtered.map((c, i) => {
              const featured = i === 0 || (i + 1) % 5 === 0;
              return (
                <div key={c.handle} className={featured ? "md:col-span-2" : ""}>
                  <CreatorCard c={c} featured={featured} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorsPage;
