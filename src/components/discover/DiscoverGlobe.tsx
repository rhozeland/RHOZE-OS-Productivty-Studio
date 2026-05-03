/**
 * DiscoverGlobe — editorial interactive world explorer for Discover.
 *
 * Uses a projected SVG sphere instead of CSS 3D transforms so drag-to-spin
 * feels stable, keeps the globe circular, and lets featured artist / event /
 * space spotlights orbit as part of the same surface.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Calendar, ImageIcon, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { MARKETS, REGIONS, type RegionMarket } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { MARKET_COLORS } from "./market-colors";
import type { FeaturedSlide } from "./useDiscoverFeatured";
import RegionChip from "@/components/profile/RegionChip";
import { avatarGradientFor } from "@/lib/avatar-gradient";
import ArtistSpotlightCard from "./ArtistSpotlightCard";
import EventSpotlightCard from "./EventSpotlightCard";
import SpaceSpotlightCard from "./SpaceSpotlightCard";

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
  US: { lat: 38.9, lng: -77.04 },
  CA: { lat: 45.42, lng: -75.7 },
  GB: { lat: 51.51, lng: -0.13 },
  DE: { lat: 52.52, lng: 13.4 },
  FR: { lat: 48.86, lng: 2.35 },
  ES: { lat: 40.42, lng: -3.7 },
  IT: { lat: 41.9, lng: 12.5 },
  NL: { lat: 52.37, lng: 4.9 },
  BR: { lat: -15.79, lng: -47.88 },
  MX: { lat: 19.43, lng: -99.13 },
  AR: { lat: -34.6, lng: -58.38 },
  CL: { lat: -33.45, lng: -70.66 },
  NG: { lat: 9.07, lng: 7.49 },
  ZA: { lat: -25.75, lng: 28.19 },
  KE: { lat: -1.29, lng: 36.82 },
  GH: { lat: 5.6, lng: -0.19 },
  AU: { lat: -35.28, lng: 149.13 },
  NZ: { lat: -41.29, lng: 174.78 },
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
const radius = 36;
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

  useEffect(() => {
    if (!featuredSlides.length) {
      setActiveSpotlightKey(null);
      return;
    }

    setActiveSpotlightKey((current) => current ?? `${featuredSlides[0].kind}-${featuredSlides[0].id}`);
  }, [featuredSlides]);

  useEffect(() => {
    if (isDragging || featuredSlides.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveSpotlightKey((current) => {
        const items = featuredSlides.map((slide) => `${slide.kind}-${slide.id}`);
        const currentIndex = current ? items.indexOf(current) : 0;
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
        return items[nextIndex];
      });
    }, 5200);

    return () => window.clearInterval(interval);
  }, [featuredSlides, isDragging]);

  // Idle auto-spin only — never snap back to the active spotlight, that
  // fights the user's drag and feels broken. Spin pauses while dragging.
  useEffect(() => {
    if (isDragging) return;

    const interval = window.setInterval(() => {
      setRotation((current) => normalizeRotation(current + 0.18));
    }, 40);

    return () => window.clearInterval(interval);
  }, [isDragging]);

  const { data: counts } = useQuery({
    queryKey: ["discover-region-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("region_code")
        .eq("is_public", true)
        .not("region_code", "is", null);

      const map = new Map<string, number>();
      (data ?? []).forEach((row: { region_code?: string | null }) => {
        const code = row.region_code?.toUpperCase() ?? "";
        if (!REGION_COORDS[code]) return;
        map.set(code, (map.get(code) ?? 0) + 1);
      });
      return map;
    },
    staleTime: 60_000,
  });

  const points = useMemo(() => {
    return REGIONS.filter((region) => REGION_COORDS[region.code])
      .map((region) => {
        const count = counts?.get(region.code) ?? 0;
        const projected = projectPoint(REGION_COORDS[region.code].lat, REGION_COORDS[region.code].lng, rotation);
        const dim = marketFilter !== "All" && region.market !== marketFilter;
        const selected = marketFilter !== "All" && region.market === marketFilter;
        const hovered = hoveredCode === region.code;
        const visibility = Math.max(0.16, ((projected.depth + 1) / 2) * (dim ? 0.36 : 1));
        const scale = 0.72 + Math.max(0, projected.depth) * 0.55;

        return {
          ...region,
          count,
          ...projected,
          dim,
          hovered,
          selected,
          scale,
          visibility,
          size: (3.4 + Math.min(10, count * 1.05)) * scale,
          ring: (10 + Math.min(18, count * 1.4)) * scale,
          color: dim ? "hsl(var(--foreground) / 0.18)" : MARKET_COLORS[region.market],
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [counts, hoveredCode, marketFilter, rotation]);

  const spotlightMarkers = useMemo<SpotlightMarker[]>(() => {
    return featuredSlides
      .map((slide) => {
        const code = slide.region_code?.toUpperCase();
        if (!code || !REGION_COORDS[code]) return null;

        const projected = projectPoint(REGION_COORDS[code].lat, REGION_COORDS[code].lng, rotation);
        return {
          ...slide,
          key: `${slide.kind}-${slide.id}`,
          region_code: code,
          lat: REGION_COORDS[code].lat,
          lng: REGION_COORDS[code].lng,
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
  const hoveredRegion = points.find((point) => point.code === hoveredCode) ?? null;

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

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/55"
      style={{ minHeight: height }}
      onMouseLeave={() => setHoveredCode(null)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,hsl(var(--accent)/0.16),transparent_28%),radial-gradient(circle_at_72%_22%,hsl(var(--primary)/0.22),transparent_26%),radial-gradient(circle_at_52%_82%,hsl(var(--foreground)/0.06),transparent_30%)]" />
      <motion.div
        className="absolute inset-0 opacity-80"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "linear-gradient(135deg, hsl(var(--background) / 0.96), hsl(var(--background) / 0.7), hsl(var(--card) / 0.9), hsl(var(--background) / 0.96))",
          backgroundSize: "180% 180%",
        }}
      />

      <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] lg:p-6">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-border/50 bg-background/45 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,hsl(var(--background)/0)_0%,hsl(var(--primary)/0.12)_32%,transparent_54%),radial-gradient(circle_at_50%_86%,hsl(var(--accent)/0.18),transparent_30%)]" />

          {/* spin hint pill removed — globe affords drag visually */}

          {hoveredRegion && (
            <div className="absolute right-4 top-4 z-20 max-w-[14rem] rounded-[1.3rem] border border-border/50 bg-background/80 px-3 py-2.5 shadow-lg backdrop-blur-md">
              <p className="text-sm font-medium text-foreground">
                {hoveredRegion.flag} {hoveredRegion.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hoveredRegion.count} {hoveredRegion.count === 1 ? "artist" : "artists"} · {hoveredRegion.market}
              </p>
            </div>
          )}

          <div className="relative flex min-h-[300px] items-center justify-center px-3 py-2 sm:px-4 lg:min-h-[380px]">
            <div
              className="relative aspect-square w-full max-w-[560px] touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="absolute inset-[7%] rounded-full border border-border/30 bg-background/15 shadow-[0_0_0_1px_hsl(var(--border)/0.12),0_28px_70px_hsl(var(--background)/0.55)] backdrop-blur-sm" />
              <div className="absolute inset-[2%] rounded-full border border-border/20" />
              <div className="absolute inset-[17%] rounded-full bg-[radial-gradient(circle_at_45%_30%,hsl(200_85%_60%/0.3),transparent_40%),radial-gradient(circle_at_60%_75%,hsl(220_70%_45%/0.25),transparent_40%)] blur-2xl" />

              <svg viewBox="0 0 100 100" className="absolute inset-[8%] h-[84%] w-[84%] overflow-visible">
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


                {points.map((point) => {
                  const front = point.depth > 0;
                  return (
                    <g key={point.code} opacity={point.visibility}>
                      <motion.circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(1.5, point.ring / 7.5)}
                        fill={point.color}
                        animate={{ scale: front ? [0.86, 1.22, 0.9] : [0.94, 1.08, 0.96], opacity: front ? [0.12, 0.3, 0.14] : [0.04, 0.1, 0.05] }}
                        transition={{ duration: 3 + point.count * 0.08, repeat: Infinity, ease: "easeInOut" }}
                        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(1.5, point.size / 4.8)}
                        fill={point.color}
                        stroke={point.selected || point.hovered ? "hsl(0 0% 100% / 0.95)" : "hsl(0 0% 100% / 0.7)"}
                        strokeWidth={point.selected || point.hovered ? 0.7 : 0.45}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseEnter={() => setHoveredCode(point.code)}
                        onFocus={() => setHoveredCode(point.code)}
                        onClick={() => onSelectMarket(point.market)}
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="absolute inset-[8%]">
                {spotlightMarkers.map((marker) => {
                  const active = marker.key === activeSpotlight?.key;
                  const front = marker.depth > -0.12;
                  const left = `${marker.x}%`;
                  const top = `${marker.y}%`;

                  return (
                    <button
                      key={marker.key}
                      type="button"
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left, top, opacity: front ? 1 : 0.4, zIndex: active ? 30 : marker.depth > 0 ? 20 : 10 }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setActiveSpotlightKey(marker.key)}
                    >
                      <motion.span
                        className="relative flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-lg backdrop-blur-xl"
                        animate={{ scale: active ? [1, 1.05, 1] : 1, y: active ? [0, -1.5, 0] : 0 }}
                        transition={{ duration: 2.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                        style={{
                          backgroundColor: active ? "hsl(var(--background) / 0.94)" : "hsl(var(--background) / 0.8)",
                          borderColor: active ? marker.color : "hsl(var(--border) / 0.65)",
                        }}
                      >
                        <span className="absolute inset-0 rounded-full blur-md opacity-50" style={{ backgroundColor: marker.color }} />
                        <span className="relative h-2.5 w-2.5 rounded-full" style={{ backgroundColor: marker.color }} />
                        <span className="relative max-w-[5.7rem] truncate text-[10px] font-medium text-foreground">
                          {marker.title}
                        </span>
                      </motion.span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap justify-center gap-2">
            {MARKETS.map((market) => {
              const active = marketFilter === market.id;
              return (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => onSelectMarket(market.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/45 bg-background/68 text-foreground hover:bg-background/84",
                  )}
                >
                  {market.label}
                </button>
              );
            })}
          </div>

          {isDragging && (
            <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/55 bg-background/82 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-md">
              Spin mode
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:gap-4">
          <div className="rounded-[1.7rem] border border-border/50 bg-background/58 p-4 backdrop-blur-xl sm:p-5">

            <AnimatePresence mode="wait">
              {activeSpotlight ? (
                <motion.div
                  key={activeSpotlight.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {activeSpotlight.kind === "artist" ? (
                    <ArtistSpotlightCard
                      id={activeSpotlight.id}
                      href={activeSpotlight.href}
                      title={activeSpotlight.title}
                      subtitle={activeSpotlight.subtitle}
                      avatar={activeSpotlight.avatar}
                      region_code={activeSpotlight.region_code}
                      creator_roles={activeSpotlight.creator_roles}
                      mediums={activeSpotlight.mediums}
                      verification_status={activeSpotlight.verification_status}
                      works_count={activeSpotlight.works_count}
                      followers_count={activeSpotlight.followers_count}
                    />
                  ) : activeSpotlight.kind === "event" ? (
                    <EventSpotlightCard
                      id={activeSpotlight.id}
                      href={activeSpotlight.href}
                      title={activeSpotlight.title}
                      subtitle={activeSpotlight.subtitle}
                      banner={activeSpotlight.banner}
                      starts_at={activeSpotlight.starts_at}
                      venue={activeSpotlight.venue}
                      is_online={activeSpotlight.is_online}
                      region_code={activeSpotlight.region_code}
                    />
                  ) : (
                    <SpaceSpotlightCard
                      id={activeSpotlight.id}
                      href={activeSpotlight.href}
                      title={activeSpotlight.title}
                      subtitle={activeSpotlight.subtitle}
                      banner={activeSpotlight.banner}
                      location={activeSpotlight.location}
                      region_code={activeSpotlight.region_code}
                      category={(activeSpotlight as any).category}
                      hourly_rate={(activeSpotlight as any).hourly_rate}
                      currency={(activeSpotlight as any).currency}
                      max_guests={(activeSpotlight as any).max_guests}
                      amenities={(activeSpotlight as any).amenities}
                      rating_avg={(activeSpotlight as any).rating_avg}
                      review_count={(activeSpotlight as any).review_count}
                      available_days={(activeSpotlight as any).available_days}
                    />
                  )}
                </motion.div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/50 bg-card/35 p-6 text-sm text-muted-foreground">
                  Featured orbit is warming up.
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-1 items-stretch">
            {allSpotlights.map((marker: any) => {
              const active = marker.key === activeSpotlight?.key;
              return (
                <button
                  key={marker.key}
                  type="button"
                  onClick={() => setActiveSpotlightKey(marker.key)}
                  className={cn(
                    // min-h keeps every card the exact same height regardless
                    // of subtitle length so the strip reads as a clean grid.
                    "group flex h-full min-h-[5.25rem] w-full items-center gap-3 rounded-[1.35rem] border p-2.5 text-left backdrop-blur-xl transition-all",
                    active
                      ? "border-foreground/20 bg-background/78 shadow-[0_12px_32px_hsl(var(--background)/0.16)]"
                      : "border-border/45 bg-background/56 hover:bg-background/72",
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] border border-border/45 bg-muted/70">
                    {marker.kind === "artist" ? (
                      <div className="flex h-full w-full items-center justify-center bg-card">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={marker.avatar ?? undefined} />
                          <AvatarFallback>{initials(marker.title)}</AvatarFallback>
                        </Avatar>
                      </div>
                    ) : marker.banner ? (
                      <img src={marker.banner} alt={marker.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[linear-gradient(135deg,hsl(var(--primary)/0.2),hsl(var(--accent)/0.16),hsl(var(--background)))]" />
                    )}
                    <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: marker.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{marker.title}</p>
                      <span className="shrink-0 rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        {marker.kind}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {marker.subtitle || "Open the orbit to see more."}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoverGlobe;
