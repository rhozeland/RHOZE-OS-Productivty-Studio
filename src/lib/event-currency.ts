/**
 * event-currency.ts — fiat currency helpers for event ticketing.
 *
 * - Country → currency mapping (auto-detected from venue location).
 * - Format helper using Intl.NumberFormat.
 * - $RHOZE conversion: 100 $RHOZE ≈ $1 USD (matches verify-rhoze-payment).
 * - Tier discount when paying with $RHOZE on events / Spaces:
 *     Spark 0% · Bloom 5% · Glow 10% · Play 15%
 */
import type { TierId } from "@/lib/tier-matrix";

export const RHOZE_PER_USD = 100;

export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD",
  EU: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
  JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", SG: "SGD", IN: "INR",
  MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  AE: "AED", SA: "SAR", ZA: "ZAR", NG: "NGN", KE: "KES", EG: "EGP",
  TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", MY: "MYR",
};

const KEYWORD_COUNTRY: Array<[RegExp, string]> = [
  [/\b(canada|toronto|vancouver|montreal|calgary|ottawa|edmonton|winnipeg|halifax|québec|quebec|ON|BC|AB|QC)\b/i, "CA"],
  [/\b(united kingdom|UK|england|london|manchester|liverpool|edinburgh|glasgow|birmingham|leeds)\b/i, "GB"],
  [/\b(australia|sydney|melbourne|brisbane|perth)\b/i, "AU"],
  [/\b(germany|berlin|munich|hamburg)\b/i, "DE"],
  [/\b(france|paris|lyon|marseille)\b/i, "FR"],
  [/\b(japan|tokyo|osaka|kyoto)\b/i, "JP"],
  [/\b(mexico|cdmx|guadalajara|monterrey)\b/i, "MX"],
  [/\b(brazil|brasil|são paulo|sao paulo|rio de janeiro)\b/i, "BR"],
  [/\b(spain|madrid|barcelona)\b/i, "ES"],
  [/\b(italy|rome|milan|florence)\b/i, "IT"],
  [/\b(netherlands|amsterdam|rotterdam)\b/i, "NL"],
  [/\b(singapore)\b/i, "SG"],
  [/\b(india|mumbai|delhi|bangalore|bengaluru)\b/i, "IN"],
  [/\b(usa|united states|new york|los angeles|chicago|miami|austin|seattle|boston|atlanta|denver|portland|san francisco|brooklyn|nyc|LA)\b/i, "US"],
];

/** Best-effort country detection from a free-form venue address string. */
export function detectCountryFromAddress(addr?: string | null): string | null {
  if (!addr) return null;
  const trimmed = addr.trim();
  if (!trimmed) return null;
  // Trailing 2-letter country code (e.g. ", CA")
  const tail = /(?:^|[,\s])([A-Z]{2})\s*$/.exec(trimmed);
  if (tail && COUNTRY_CURRENCY[tail[1]]) return tail[1];
  for (const [re, code] of KEYWORD_COUNTRY) {
    if (re.test(trimmed)) return code;
  }
  return null;
}

export function currencyFromCountry(country?: string | null): string {
  if (!country) return "USD";
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? "USD";
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** $RHOZE discount % when buying tickets/services with $RHOZE, by tier. */
export const RHOZE_DISCOUNT_BY_TIER: Record<TierId, number> = {
  spark: 0,
  bloom: 0.05,
  glow: 0.10,
  play: 0.15,
};

export function rhozeDiscount(tier: TierId): number {
  return RHOZE_DISCOUNT_BY_TIER[tier] ?? 0;
}

/** Fiat price → $RHOZE amount, optionally with tier discount applied. */
export function fiatToRhoze(fiat: number, tier: TierId = "spark"): number {
  const discounted = fiat * (1 - rhozeDiscount(tier));
  return Math.round(discounted * RHOZE_PER_USD);
}
