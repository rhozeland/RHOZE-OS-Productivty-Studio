import type { RegionMarket } from "@/lib/regions";

/** Editorial palette for region markets — used by both the globe and chips. */
export const MARKET_COLORS: Record<RegionMarket, string> = {
  East:    "hsl(330, 81%, 60%)",  // pink
  West:    "hsl(38, 92%, 55%)",   // amber
  Latam:   "hsl(160, 70%, 50%)",  // mint
  Africa:  "hsl(280, 75%, 65%)",  // violet
  Oceania: "hsl(200, 85%, 60%)",  // sky
};
