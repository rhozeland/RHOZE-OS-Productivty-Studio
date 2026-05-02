/**
 * DiscoverGlobe — build-safe interactive world explorer for Discover.
 *
 * Replaces the unstable WebGL dependency chain with a lightweight SVG globe
 * that still feels interactive: slow orbital motion, clickable region markers,
 * hover states, and live artist counts per region.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS, type RegionMarket } from "@/lib/regions";
import { MARKET_COLORS } from "./market-colors";

// Approximate lat/lng for each region (good enough for a stylized pin).
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  KR: { lat: 37.55, lng: 126.99 },
  JP: { lat: 35.68, lng: 139.69 },
  CN: { lat: 39.90, lng: 116.40 },
  TW: { lat: 25.03, lng: 121.56 },
  HK: { lat: 22.32, lng: 114.17 },
  PH: { lat: 14.59, lng: 120.98 },
  ID: { lat: -6.20, lng: 106.85 },
  TH: { lat: 13.75, lng: 100.50 },
  VN: { lat: 21.03, lng: 105.85 },
  SG: { lat: 1.35,  lng: 103.82 },
  MY: { lat: 3.14,  lng: 101.69 },
  US: { lat: 38.90, lng: -77.04 },
  CA: { lat: 45.42, lng: -75.70 },
  GB: { lat: 51.51, lng: -0.13 },
  DE: { lat: 52.52, lng: 13.40 },
  FR: { lat: 48.86, lng: 2.35 },
  ES: { lat: 40.42, lng: -3.70 },
  IT: { lat: 41.90, lng: 12.50 },
  NL: { lat: 52.37, lng: 4.90 },
  BR: { lat: -15.79, lng: -47.88 },
  MX: { lat: 19.43, lng: -99.13 },
  AR: { lat: -34.60, lng: -58.38 },
  CL: { lat: -33.45, lng: -70.66 },
  NG: { lat: 9.07,  lng: 7.49 },
  ZA: { lat: -25.75, lng: 28.19 },
  KE: { lat: -1.29, lng: 36.82 },
  GH: { lat: 5.60,  lng: -0.19 },
  AU: { lat: -35.28, lng: 149.13 },
  NZ: { lat: -41.29, lng: 174.78 },
};

interface DiscoverGlobeProps {
  marketFilter: RegionMarket | "All";
  onSelectMarket: (m: RegionMarket | "All") => void;
  height?: number;
}

const cx = 50;
const cy = 50;
const radius = 37;

const latLngToXY = (lat: number, lng: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = cx + radius * Math.sin(phi) * Math.cos(theta);
  const y = cy - radius * Math.cos(phi);
  return { x, y };
};

const DiscoverGlobe = ({ marketFilter, onSelectMarket, height = 360 }: DiscoverGlobeProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [width, setWidth] = useState(600);
  const rotate = useMotionValue(-14);
  const rotateSpring = useSpring(rotate, { stiffness: 40, damping: 18, mass: 1.2 });
  const glowX = useTransform(rotateSpring, [-30, 30], [36, 64]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setWidth(Math.max(280, Math.floor(w)));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let direction = 1;
    const interval = window.setInterval(() => {
      const next = rotate.get() + direction * 6;
      if (next >= 18 || next <= -18) direction *= -1;
      rotate.set(next);
    }, 2400);
    return () => window.clearInterval(interval);
  }, []);

  const { data: counts } = useQuery({
    queryKey: ["discover-region-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("region_code")
        .eq("is_public", true)
        .not("region_code", "is", null);
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const code = (r.region_code || "").toUpperCase();
        if (!REGION_COORDS[code]) return;
        map.set(code, (map.get(code) ?? 0) + 1);
      });
      return map;
    },
    staleTime: 60_000,
  });

  const points = useMemo(() => {
    return REGIONS.filter((r) => REGION_COORDS[r.code]).map((r) => {
      const count = counts?.get(r.code) ?? 0;
      const dim = marketFilter !== "All" && r.market !== marketFilter;
      const selected = marketFilter !== "All" && r.market === marketFilter;
      const hovered = hoveredCode === r.code;
      const coords = REGION_COORDS[r.code];
      const { x, y } = latLngToXY(coords.lat, coords.lng);
      return {
        ...r,
        count,
        x,
        y,
        size: 4 + Math.min(12, count * 1.15),
        ring: 12 + Math.min(22, count * 1.5),
        selected,
        hovered,
        dim,
        color: dim ? "hsl(0 0% 100% / 0.18)" : MARKET_COLORS[r.market],
      };
    });
  }, [counts, hoveredCode, marketFilter]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height }}
      onMouseLeave={() => setHoveredCode(null)}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, hsl(var(--primary) / 0.18), transparent 38%), radial-gradient(circle at 50% 70%, hsl(var(--accent) / 0.12), transparent 45%)",
        }}
        animate={{ opacity: [0.72, 1, 0.78] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-4 py-5">
        <motion.div
          className="relative aspect-square w-full max-w-[360px] sm:max-w-[420px]"
          style={{ rotateY: rotateSpring, transformStyle: "preserve-3d" }}
        >
          <div className="absolute inset-0 rounded-full border border-border/40 bg-background/10 backdrop-blur-sm shadow-[0_0_0_1px_hsl(var(--border)/0.18),0_30px_90px_hsl(var(--background)/0.6)]" />
          <motion.div
            className="absolute inset-[7%] rounded-full"
            style={{
              background: glowX.to((x) =>
                `radial-gradient(circle at ${x}% 36%, hsl(var(--primary) / 0.30), transparent 24%), radial-gradient(circle at 50% 70%, hsl(var(--accent) / 0.14), transparent 36%)`
              ),
            }}
          />
          <svg viewBox="0 0 100 100" className="absolute inset-[8%] h-[84%] w-[84%] overflow-visible">
            <defs>
              <radialGradient id="discover-globe-fill" cx="45%" cy="38%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--background))" stopOpacity="0.22" />
                <stop offset="45%" stopColor="hsl(var(--card))" stopOpacity="0.92" />
                <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="1" />
              </radialGradient>
            </defs>

            <circle cx={cx} cy={cy} r={radius} fill="url(#discover-globe-fill)" stroke="hsl(var(--border) / 0.5)" strokeWidth="0.5" />

            {[0.28, 0.5, 0.72].map((ratio) => (
              <ellipse
                key={`lat-${ratio}`}
                cx={cx}
                cy={cy}
                rx={radius}
                ry={Math.max(7, radius * Math.abs(0.5 - ratio) * 1.1)}
                fill="none"
                stroke="hsl(var(--foreground) / 0.10)"
                strokeWidth="0.3"
              />
            ))}

            {[0.26, 0.5, 0.74].map((ratio) => (
              <ellipse
                key={`lon-${ratio}`}
                cx={cx}
                cy={cy}
                rx={Math.max(8, radius * Math.abs(0.5 - ratio) * 1.05)}
                ry={radius}
                fill="none"
                stroke="hsl(var(--foreground) / 0.08)"
                strokeWidth="0.3"
              />
            ))}

            {points.map((point) => (
              <g key={point.code}>
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={point.ring / 10}
                  fill={point.color}
                  opacity={point.selected || point.hovered ? 0.22 : 0.12}
                  animate={{ scale: [0.85, 1.18, 0.92], opacity: [0.12, 0.26, 0.14] }}
                  transition={{ duration: 2.8 + point.count * 0.08, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                />
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(1.9, point.size / 4.8)}
                  fill={point.color}
                  stroke={point.selected || point.hovered ? "hsl(var(--foreground) / 0.9)" : "hsl(var(--background) / 0.8)"}
                  strokeWidth={point.selected || point.hovered ? 0.75 : 0.45}
                  animate={point.selected ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={{ duration: 1.6, repeat: point.selected ? Infinity : 0, ease: "easeInOut" }}
                  style={{ transformOrigin: `${point.x}px ${point.y}px`, cursor: "pointer" }}
                  onMouseEnter={() => setHoveredCode(point.code)}
                  onFocus={() => setHoveredCode(point.code)}
                  onClick={() => onSelectMarket(point.market)}
                />
              </g>
            ))}
          </svg>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/55 to-transparent" />

      <div className="absolute left-4 top-4 max-w-[14rem]">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Verified IP markets</p>
        <p className="mt-2 text-sm text-foreground/80">
          Tap a pulse to narrow the feed by region.
        </p>
      </div>

      {hoveredCode && (() => {
        const active = points.find((point) => point.code === hoveredCode);
        if (!active) return null;
        return (
          <div className="absolute right-4 top-4 max-w-[13rem] rounded-2xl border border-border/60 bg-background/85 px-3 py-2 backdrop-blur-md shadow-lg">
            <p className="text-sm font-medium text-foreground">{active.flag} {active.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {active.count} {active.count === 1 ? "artist" : "artists"} · {active.market}
            </p>
          </div>
        );
      })()}
    </div>
  );
};

export default DiscoverGlobe;
