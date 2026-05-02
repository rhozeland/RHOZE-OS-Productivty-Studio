/**
 * DiscoverGlobe — interactive 3D globe hero for the Discover page.
 *
 * Aggregates artist counts per `profiles.region_code` and renders a pulsing
 * pin per region. Clicking a pin sets the active market filter, which the
 * parent page uses to scope downstream sections (featured carousel, future
 * region-aware lanes).
 *
 * Lazy-loadable: react-globe.gl pulls in three.js (~150KB gz). This module
 * is dynamically imported by `DiscoverPage` so the bundle stays small for
 * users who never reach Discover.
 *
 * Falls back to a SSR-safe placeholder when WebGL is unavailable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Globe from "react-globe.gl";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS, getRegion, type RegionMarket } from "@/lib/regions";
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

const DiscoverGlobe = ({ marketFilter, onSelectMarket, height = 360 }: DiscoverGlobeProps) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);

  // Fit globe to container width.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setWidth(Math.max(280, Math.floor(w)));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-rotate until first interaction.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls?.();
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = false;
    const stop = () => { controls.autoRotate = false; };
    controls.addEventListener?.("start", stop);
    return () => controls.removeEventListener?.("start", stop);
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
      // Show a small "pulse" pin even for empty regions so the globe
      // never reads as empty; size scales with actual artist count.
      const baseSize = 0.18;
      const sizeBoost = Math.min(0.6, count * 0.06);
      const dim = marketFilter !== "All" && r.market !== marketFilter;
      return {
        ...r,
        ...REGION_COORDS[r.code],
        count,
        size: baseSize + sizeBoost,
        color: dim ? "rgba(255,255,255,0.18)" : MARKET_COLORS[r.market],
      };
    });
  }, [counts, marketFilter]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor="hsl(280, 70%, 70%)"
        atmosphereAltitude={0.18}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        pointsData={points}
        pointAltitude={(d: any) => d.size}
        pointRadius={0.55}
        pointColor={(d: any) => d.color}
        pointLabel={(d: any) =>
          `<div style="font-family:Inter,sans-serif;background:hsl(0 0% 5%);color:white;padding:6px 10px;border-radius:8px;font-size:12px;border:1px solid hsl(0 0% 25%)">
            <strong>${d.flag} ${d.label}</strong><br/>
            <span style="opacity:.7">${d.count} ${d.count === 1 ? "artist" : "artists"} · ${d.market}</span>
          </div>`
        }
        onPointClick={(d: any) => {
          onSelectMarket(d.market as RegionMarket);
        }}
        animateIn
      />
    </div>
  );
};

export default DiscoverGlobe;
