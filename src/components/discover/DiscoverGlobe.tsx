/**
 * DiscoverGlobe — editorial interactive world explorer for Discover.
 *
 * Uses a projected SVG sphere instead of CSS 3D transforms so drag-to-spin
 * feels stable, keeps the globe circular, and lets featured artist / event /
 * space spotlights orbit as part of the same surface.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { REGIONS, type RegionMarket } from "@/lib/regions";
import { cn } from "@/lib/utils";
import type { FeaturedSlide } from "./useDiscoverFeatured";
import { todayGradient } from "@/lib/rhoze-gradients";
import ArtistSpotlightCard from "./ArtistSpotlightCard";

// City-level coordinates so pins land on real cities, not country centroids.
// Defaults bias toward Toronto for early adopters — most Rhozeland creators
// are based there for now. Unknown regions fall through to TORONTO below.
const TORONTO = { lat: 43.6532, lng: -79.3832 };
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  KR: { lat: 37.55, lng: 126.99 },
  JP: { lat: 35.68, lng: 139.69 },
  CN: { lat: 39.9, lng: 116.4 },
  TW: { lat: 25.03, lng: 121.56 },
  HK: { lat: 22.32, lng: 114.17 },
  PH: { lat: 14.59, lng: 120.98 },
  ID: { lat: -6.2, lng: 106.85 },
  TH: { lat: 13.75, lng: 100.5 },
  VN: { lat: 21.03, lng: 105.85 },
  SG: { lat: 1.35, lng: 103.82 },
  MY: { lat: 3.14, lng: 101.69 },
  US: { lat: 40.71, lng: -74.0 },   // NYC
  CA: TORONTO,                       // Toronto (was Ottawa) — most creators here
  GB: { lat: 51.51, lng: -0.13 },
  DE: { lat: 52.52, lng: 13.4 },
  FR: { lat: 48.86, lng: 2.35 },
  ES: { lat: 40.42, lng: -3.7 },
  IT: { lat: 41.9, lng: 12.5 },
  NL: { lat: 52.37, lng: 4.9 },
  BR: { lat: -23.55, lng: -46.63 }, // São Paulo
  MX: { lat: 19.43, lng: -99.13 },
  AR: { lat: -34.6, lng: -58.38 },
  CL: { lat: -33.45, lng: -70.66 },
  NG: { lat: 6.45, lng: 3.4 },      // Lagos
  ZA: { lat: -26.2, lng: 28.04 },   // Johannesburg
  KE: { lat: -1.29, lng: 36.82 },
  GH: { lat: 5.6, lng: -0.19 },
  AU: { lat: -33.87, lng: 151.21 }, // Sydney
  NZ: { lat: -36.85, lng: 174.76 }, // Auckland
};

// Default any unmapped / missing region to Toronto so every featured creator
// lands somewhere real on the globe instead of vanishing off-map.
const coordsFor = (code?: string | null) => {
  const upper = code?.toUpperCase();
  if (upper && REGION_COORDS[upper]) return REGION_COORDS[upper];
  return TORONTO;
};

// Low-poly continent outlines (lat, lng pairs). Hand-tuned to evoke real
// landmasses without shipping a full topojson. Painter ordering only —
// back-facing polygons hide via depth check during projection.
const CONTINENTS: { name: string; points: [number, number][] }[] = [
  {
    name: "North America",
    points: [
      [70, -168], [72, -140], [74, -110], [70, -82], [62, -64], [50, -56],
      [44, -64], [42, -72], [32, -80], [25, -80], [18, -92], [15, -98],
      [22, -106], [30, -116], [40, -124], [49, -125], [55, -132], [60, -148],
      [66, -162],
    ],
  },
  {
    name: "South America",
    points: [
      [12, -72], [10, -62], [5, -52], [-2, -48], [-12, -38], [-22, -40],
      [-32, -52], [-42, -64], [-52, -70], [-54, -72], [-46, -74], [-36, -72],
      [-22, -70], [-10, -78], [0, -80], [8, -78],
    ],
  },
  {
    name: "Europe",
    points: [
      [70, -8], [70, 24], [68, 40], [60, 50], [54, 38], [44, 40], [38, 28],
      [36, 14], [38, -2], [44, -10], [50, -4], [58, -6], [64, -10],
    ],
  },
  {
    name: "Africa",
    points: [
      [36, -8], [36, 12], [32, 24], [30, 34], [16, 42], [10, 50], [-4, 42],
      [-18, 38], [-30, 32], [-34, 22], [-32, 18], [-26, 14], [-20, 12],
      [-12, 12], [-2, 8], [4, -2], [10, -14], [16, -16], [22, -16], [28, -10],
    ],
  },
  {
    name: "Asia",
    points: [
      [78, 60], [80, 100], [76, 140], [70, 170], [60, 168], [54, 156],
      [50, 142], [42, 132], [34, 134], [22, 120], [10, 108], [4, 100],
      [10, 92], [22, 88], [22, 72], [30, 60], [38, 50], [44, 46], [54, 44],
      [60, 50], [70, 56],
    ],
  },
  {
    name: "Oceania",
    points: [
      [-12, 130], [-10, 140], [-12, 152], [-22, 154], [-32, 152], [-38, 146],
      [-36, 138], [-32, 128], [-26, 120], [-18, 122],
    ],
  },
  {
    name: "Antarctica",
    points: [
      [-70, -160], [-68, -120], [-66, -80], [-68, -40], [-70, 0], [-66, 40],
      [-64, 80], [-66, 120], [-70, 160], [-78, 160], [-82, 100], [-84, 0],
      [-82, -80], [-78, -160],
    ],
  },
  {
    name: "Greenland",
    points: [
      [82, -32], [80, -18], [70, -22], [62, -42], [70, -52], [78, -50],
    ],
  },
];

interface DiscoverGlobeProps {
  marketFilter: RegionMarket | "All";
  onSelectMarket: (m: RegionMarket | "All") => void;
  featuredSlides?: FeaturedSlide[];
  height?: number;
}

type SpotlightMarker = FeaturedSlide & {
  key: string;
  region_code: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  depth: number;
  market: RegionMarket | null;
  color: string;
};

const cx = 50;
const cy = 50;
const radius = 44; // zoomed-in feel — pins read at city scale
const marketByCode = new Map(REGIONS.map((region) => [region.code, region.market]));
const typeColorMap = {
  artist: "hsl(330 81% 60%)",
  event: "hsl(38 92% 55%)",
  space: "hsl(200 85% 60%)",
} as const;

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((chunk) => chunk[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const normalizeRotation = (angle: number) => {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
};

const shortestAngle = (from: number, to: number) => {
  let delta = normalizeRotation(to - from);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
};

const projectPoint = (lat: number, lng: number, rotation: number) => {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + rotation) * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const x3 = cosLat * Math.sin(lngRad);
  const y3 = Math.sin(latRad);
  const z3 = cosLat * Math.cos(lngRad);

  return {
    x: cx + radius * x3,
    y: cy - radius * y3,
    depth: z3,
  };
};

const buildLatitudePath = (latitude: number, rotation: number) => {
  let path = "";
  let drawing = false;

  for (let lng = -180; lng <= 180; lng += 5) {
    const point = projectPoint(latitude, lng, rotation);
    if (point.depth > 0.02) {
      path += `${drawing ? " L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      drawing = true;
    } else {
      drawing = false;
    }
  }

  return path;
};

const buildLongitudePath = (longitude: number, rotation: number) => {
  let path = "";
  let drawing = false;

  for (let lat = -88; lat <= 88; lat += 4) {
    const point = projectPoint(lat, longitude, rotation);
    if (point.depth > 0.02) {
      path += `${drawing ? " L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      drawing = true;
    } else {
      drawing = false;
    }
  }

  return path;
};

// Build a closed polygon for a continent. Skips polygons that are
// fully on the back hemisphere; partially-visible polygons clip points
// crossing the horizon so shapes hug the sphere.
const buildContinentPath = (points: [number, number][], rotation: number) => {
  const projected = points.map(([lat, lng]) => projectPoint(lat, lng, rotation));
  if (!projected.some((p) => p.depth > 0)) return "";
  let path = "";
  let drawing = false;
  for (const p of projected) {
    if (p.depth > -0.05) {
      path += `${drawing ? " L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      drawing = true;
    } else {
      drawing = false;
    }
  }
  if (drawing) path += " Z";
  return path;
};

const DiscoverGlobe = ({ marketFilter, onSelectMarket, featuredSlides = [], height = 520 }: DiscoverGlobeProps) => {
  const dragState = useRef<{ pointerId: number; startX: number; startRotation: number } | null>(null);
  const [rotation, setRotation] = useState(-22);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [activeSpotlightKey, setActiveSpotlightKey] = useState<string | null>(featuredSlides[0] ? `${featuredSlides[0].kind}-${featuredSlides[0].id}` : null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  useEffect(() => {
    if (!featuredSlides.length) {
      setActiveSpotlightKey(null);
      return;
    }

    setActiveSpotlightKey((current) => current ?? `${featuredSlides[0].kind}-${featuredSlides[0].id}`);
  }, [featuredSlides]);

  // Slower auto-cycle (9s) + pauses while user is dragging the globe or
  // hovering the spotlight card, so the rotation never feels abrupt.
  useEffect(() => {
    if (isDragging || isHoveringCard || featuredSlides.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveSpotlightKey((current) => {
        const items = featuredSlides.map((slide) => `${slide.kind}-${slide.id}`);
        const currentIndex = current ? items.indexOf(current) : 0;
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
        return items[nextIndex];
      });
    }, 9000);

    return () => window.clearInterval(interval);
  }, [featuredSlides, isDragging, isHoveringCard]);

  // Auto-spin to the active spotlight artist's longitude, so the globe
  // visually "lands on" whoever is being featured right now. Drag pauses
  // the lerp; releasing it resumes following the active marker.
  useEffect(() => {
    if (isDragging) return;
    const active = featuredSlides
      .map((s) => {
        const coords = coordsFor(s.region_code);
        return { key: `${s.kind}-${s.id}`, lng: coords.lng };
      })
      .find((m) => m.key === activeSpotlightKey);
    const targetLng = active?.lng;
    const interval = window.setInterval(() => {
      setRotation((current) => {
        if (typeof targetLng !== "number") {
          return normalizeRotation(current + 0.18);
        }
        const target = -targetLng;
        const delta = shortestAngle(current, target);
        if (Math.abs(delta) < 0.25) return current;
        return normalizeRotation(current + delta * 0.06);
      });
    }, 40);

    return () => window.clearInterval(interval);
  }, [isDragging, activeSpotlightKey, featuredSlides]);

  const spotlightMarkers = useMemo<SpotlightMarker[]>(() => {
    return featuredSlides
      .map((slide) => {
        const coords = coordsFor(slide.region_code);
        const code = (slide.region_code?.toUpperCase() ?? "CA");
        const projected = projectPoint(coords.lat, coords.lng, rotation);
        return {
          ...slide,
          key: `${slide.kind}-${slide.id}`,
          region_code: code,
          lat: coords.lat,
          lng: coords.lng,
          ...projected,
          market: marketByCode.get(code) ?? null,
          color: typeColorMap[slide.kind],
        } satisfies SpotlightMarker;
      })
      .filter(Boolean)
      .sort((a, b) => a.depth - b.depth) as SpotlightMarker[];
  }, [featuredSlides, rotation]);

  const spotlightMarkersRef = useRef<SpotlightMarker[]>([]);
  spotlightMarkersRef.current = spotlightMarkers;

  const allSpotlights = useMemo(() => {
    return featuredSlides.map((slide) => {
      const code = slide.region_code?.toUpperCase() ?? null;
      return {
        ...slide,
        key: `${slide.kind}-${slide.id}`,
        region_code: code,
        color: typeColorMap[slide.kind],
      };
    });
  }, [featuredSlides]);

  const activeSpotlight =
    spotlightMarkers.find((marker) => marker.key === activeSpotlightKey) ??
    (allSpotlights.find((s) => s.key === activeSpotlightKey) as any) ??
    spotlightMarkers[0] ??
    (allSpotlights[0] as any) ??
    null;
  

  const latitudePaths = useMemo(
    () => [-52, -24, 0, 24, 52].map((latitude) => buildLatitudePath(latitude, rotation)).filter(Boolean),
    [rotation],
  );
  const longitudePaths = useMemo(
    () => [-90, -45, 0, 45, 90].map((longitude) => buildLongitudePath(longitude, rotation)).filter(Boolean),
    [rotation],
  );
  const continentPaths = useMemo(
    () => CONTINENTS.map((c) => ({ name: c.name, d: buildContinentPath(c.points, rotation) })).filter((c) => c.d),
    [rotation],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - dragState.current.startX;
    setRotation(normalizeRotation(dragState.current.startRotation + delta * 0.38));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== event.pointerId) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
  };

  const grad = todayGradient();

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/55"
      onMouseLeave={() => setHoveredCode(null)}
      data-rhoze-gradient={grad.id}
    >
      {/* Rhozeland gradient wash — rotates daily */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: grad.surface }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-60 mix-blend-soft-light"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage: grad.text,
          backgroundSize: "220% 220%",
        }}
      />

      <div className="relative p-3 sm:p-4">
        {/* ── Globe (full-bleed) ────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-border/50 bg-background/30 backdrop-blur-xl">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{ background: grad.surface }}
          />

          <div className="relative flex min-h-[420px] items-center justify-center px-2 py-2 sm:px-3 lg:min-h-[560px]">
            <div
              className="relative aspect-square w-full max-w-[640px] touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="absolute inset-[4%] rounded-full border border-border/30 bg-background/15 shadow-[0_0_0_1px_hsl(var(--border)/0.12),0_28px_70px_hsl(var(--background)/0.55)] backdrop-blur-sm" />
              <div className="absolute inset-[0%] rounded-full border border-border/20" />
              <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_45%_30%,hsl(200_85%_60%/0.3),transparent_40%),radial-gradient(circle_at_60%_75%,hsl(220_70%_45%/0.25),transparent_40%)] blur-2xl" />

              <svg viewBox="0 0 100 100" className="absolute inset-[4%] h-[92%] w-[92%] overflow-visible">
                <defs>
                  <radialGradient id="discover-globe-ocean" cx="38%" cy="30%" r="78%">
                    <stop offset="0%"  stopColor="hsl(200 85% 72%)" />
                    <stop offset="40%" stopColor="hsl(210 75% 52%)" />
                    <stop offset="78%" stopColor="hsl(220 70% 32%)" />
                    <stop offset="100%" stopColor="hsl(225 65% 18%)" />
                  </radialGradient>
                  <radialGradient id="discover-globe-land" cx="42%" cy="32%" r="80%">
                    <stop offset="0%"  stopColor="hsl(85 55% 62%)" />
                    <stop offset="55%" stopColor="hsl(120 40% 42%)" />
                    <stop offset="100%" stopColor="hsl(150 45% 22%)" />
                  </radialGradient>
                  <radialGradient id="discover-globe-highlight" cx="38%" cy="28%" r="55%">
                    <stop offset="0%"  stopColor="hsl(0 0% 100%)" stopOpacity="0.35" />
                    <stop offset="60%" stopColor="hsl(0 0% 100%)" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="hsl(0 0% 100%)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="discover-globe-shadow" cx="70%" cy="78%" r="60%">
                    <stop offset="0%"  stopColor="hsl(225 70% 8%)" stopOpacity="0" />
                    <stop offset="100%" stopColor="hsl(225 70% 8%)" stopOpacity="0.55" />
                  </radialGradient>
                  <clipPath id="discover-globe-clip">
                    <circle cx={cx} cy={cy} r={radius} />
                  </clipPath>
                </defs>

                <ellipse cx={cx} cy={cy + 38} rx={24} ry={5} fill="hsl(225 60% 12% / 0.35)" />
                <circle cx={cx} cy={cy} r={radius + 1.2} fill="hsl(200 85% 70% / 0.18)" />
                <circle cx={cx} cy={cy} r={radius} fill="url(#discover-globe-ocean)" stroke="hsl(225 65% 22%)" strokeWidth="0.5" />

                <g clipPath="url(#discover-globe-clip)">
                  {continentPaths.map((c) => (
                    <path key={c.name} d={c.d} fill="url(#discover-globe-land)" stroke="hsl(150 50% 18% / 0.6)" strokeWidth="0.25" strokeLinejoin="round" />
                  ))}
                  {latitudePaths.map((path, index) => (
                    <path key={`lat-${index}`} d={path} fill="none" stroke="hsl(0 0% 100% / 0.12)" strokeWidth="0.28" />
                  ))}
                  {longitudePaths.map((path, index) => (
                    <path key={`lng-${index}`} d={path} fill="none" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="0.26" />
                  ))}
                  <circle cx={cx} cy={cy} r={radius} fill="url(#discover-globe-shadow)" />
                  <circle cx={cx} cy={cy} r={radius} fill="url(#discover-globe-highlight)" />
                </g>
              </svg>

              {/* Active pin + anchored spotlight card hovering over the location */}
              <div className="absolute inset-[4%] pointer-events-none">
              {/* Active pin + compact spotlight chip — single AnimatePresence
                  so the pin, connector line and chip all crossfade together
                  whenever the featured creator rotates. */}
              <div className="absolute inset-[4%]">
                <AnimatePresence mode="wait">
                  {spotlightMarkers
                    .filter((m) => m.key === activeSpotlight?.key)
                    .map((marker) => {
                      const front = marker.depth > -0.12;
                      const cardOnLeft = marker.x > 50;
                      const role = marker.creator_roles?.[0] ?? marker.mediums?.[0] ?? null;
                      return (
                        <motion.div
                          key={marker.key}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute inset-0 pointer-events-none"
                        >
                          {/* Connector line from pin to chip */}
                          <svg
                            aria-hidden
                            className="absolute inset-0 h-full w-full"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={{ zIndex: 25, opacity: front ? 0.7 : 0.15 }}
                          >
                            <line
                              x1={marker.x}
                              y1={marker.y}
                              x2={cardOnLeft ? Math.max(marker.x - 12, 6) : Math.min(marker.x + 12, 94)}
                              y2={Math.max(marker.y - 9, 4)}
                              stroke={marker.color}
                              strokeWidth="0.3"
                              strokeDasharray="0.8 0.8"
                            />
                          </svg>

                          {/* Pin (geo-anchored) */}
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${marker.x}%`, top: `${marker.y}%`, opacity: front ? 1 : 0.35, zIndex: 30 }}
                          >
                            <motion.span
                              className="relative block h-2.5 w-2.5 rounded-full"
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                              style={{ backgroundColor: marker.color, boxShadow: `0 0 12px ${marker.color}` }}
                            />
                          </div>

                          {/* Compact chip: avatar + name + role + arrow */}
                          <Link
                            to={activeSpotlight.href}
                            onMouseEnter={() => setIsHoveringCard(true)}
                            onMouseLeave={() => setIsHoveringCard(false)}
                            className="group absolute pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/95 py-1 pl-1 pr-3 shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.35)] backdrop-blur-xl transition-colors hover:border-foreground/40"
                            style={{
                              left: `${Math.min(Math.max(cardOnLeft ? marker.x - 22 : marker.x + 2, 1), 70)}%`,
                              top: `${Math.max(marker.y - 14, 1)}%`,
                              zIndex: 40,
                              maxWidth: "44%",
                            }}
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-foreground"
                              style={{
                                background: marker.avatar
                                  ? undefined
                                  : `linear-gradient(135deg, ${marker.color}, hsl(var(--background)))`,
                              }}
                            >
                              {marker.avatar ? (
                                <img src={marker.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                initials(marker.title)
                              )}
                            </span>
                            <span className="flex min-w-0 flex-col leading-tight">
                              <span className="truncate text-[12px] font-semibold text-foreground">{marker.title}</span>
                              {role && (
                                <span className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                  {role}
                                </span>
                              )}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                          </Link>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {isDragging && (
            <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/55 bg-background/82 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-md">
              Spin
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverGlobe;
