/**
 * Regions catalog — used for cross-market artist tagging.
 *
 * Artists self-tag with a 2-letter ISO-style region code so fans can
 * discover talent across the East ↔ West axis. Keep this list short and
 * curated: every region we surface needs a flag emoji, a label, and a
 * "market" so we can group them in the Discover region strip.
 */
export type RegionMarket = "East" | "West" | "Latam" | "Africa" | "Oceania";

export interface Region {
  code: string; // ISO-style 2-letter
  label: string;
  flag: string;
  market: RegionMarket;
}

export const REGIONS: Region[] = [
  // East Asia
  { code: "KR", label: "South Korea", flag: "🇰🇷", market: "East" },
  { code: "JP", label: "Japan",       flag: "🇯🇵", market: "East" },
  { code: "CN", label: "China",       flag: "🇨🇳", market: "East" },
  { code: "TW", label: "Taiwan",      flag: "🇹🇼", market: "East" },
  { code: "HK", label: "Hong Kong",   flag: "🇭🇰", market: "East" },
  // Southeast Asia
  { code: "PH", label: "Philippines", flag: "🇵🇭", market: "East" },
  { code: "ID", label: "Indonesia",   flag: "🇮🇩", market: "East" },
  { code: "TH", label: "Thailand",    flag: "🇹🇭", market: "East" },
  { code: "VN", label: "Vietnam",     flag: "🇻🇳", market: "East" },
  { code: "SG", label: "Singapore",   flag: "🇸🇬", market: "East" },
  { code: "MY", label: "Malaysia",    flag: "🇲🇾", market: "East" },
  // West
  { code: "US", label: "United States", flag: "🇺🇸", market: "West" },
  { code: "CA", label: "Canada",        flag: "🇨🇦", market: "West" },
  { code: "GB", label: "United Kingdom",flag: "🇬🇧", market: "West" },
  { code: "DE", label: "Germany",       flag: "🇩🇪", market: "West" },
  { code: "FR", label: "France",        flag: "🇫🇷", market: "West" },
  { code: "ES", label: "Spain",         flag: "🇪🇸", market: "West" },
  { code: "IT", label: "Italy",         flag: "🇮🇹", market: "West" },
  { code: "NL", label: "Netherlands",   flag: "🇳🇱", market: "West" },
  // Latam
  { code: "BR", label: "Brazil",   flag: "🇧🇷", market: "Latam" },
  { code: "MX", label: "Mexico",   flag: "🇲🇽", market: "Latam" },
  { code: "AR", label: "Argentina",flag: "🇦🇷", market: "Latam" },
  { code: "CL", label: "Chile",    flag: "🇨🇱", market: "Latam" },
  // Africa
  { code: "NG", label: "Nigeria",      flag: "🇳🇬", market: "Africa" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦", market: "Africa" },
  { code: "KE", label: "Kenya",        flag: "🇰🇪", market: "Africa" },
  { code: "GH", label: "Ghana",        flag: "🇬🇭", market: "Africa" },
  // Oceania
  { code: "AU", label: "Australia",   flag: "🇦🇺", market: "Oceania" },
  { code: "NZ", label: "New Zealand", flag: "🇳🇿", market: "Oceania" },
];

export const REGION_MAP = new Map(REGIONS.map((r) => [r.code, r]));

export const getRegion = (code?: string | null): Region | null =>
  code ? REGION_MAP.get(code.toUpperCase()) ?? null : null;

/** Top-level market filters surfaced in Discover. */
export const MARKETS: { id: RegionMarket | "All"; label: string }[] = [
  { id: "All",     label: "All regions" },
  { id: "East",    label: "East" },
  { id: "West",    label: "West" },
  { id: "Latam",   label: "Latam" },
  { id: "Africa",  label: "Africa" },
  { id: "Oceania", label: "Oceania" },
];
