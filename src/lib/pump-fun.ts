/**
 * pump-fun.ts — shared deeplink builder for the pump.fun coin-create handoff.
 *
 * pump.fun reads `name`, `symbol`, `description`, and `image` from the URL
 * query string on its /create page when it's available. We pre-fill those
 * from release / project metadata so the artist's coin launch feels native
 * to Rhozeland — one click and they're on pump.fun with a half-finished form.
 *
 * If pump.fun ignores any param in the future, the fallback "Copy details"
 * affordance on the release page lets the artist paste the JSON manually.
 */
export interface PumpFunCreateInput {
  /** Display name of the release / project. */
  name?: string | null;
  /** Optional ticker override; otherwise derived from `name`. */
  symbol?: string | null;
  /** Short vision / description text. */
  description?: string | null;
  /** Public cover image URL (will be ignored if not absolute https). */
  imageUrl?: string | null;
}

export const PUMP_FUN_BASE = "https://pump.fun/create";

const sanitizeSymbol = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "RHOZE";

export const deriveTicker = (name?: string | null) => {
  if (!name) return "RHOZE";
  const cleaned = name.trim();
  if (!cleaned) return "RHOZE";
  // Acronym from words, else first 6 chars of compact name.
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const acronym = words.map((w) => w[0]).join("");
    if (acronym.length >= 2) return sanitizeSymbol(acronym);
  }
  return sanitizeSymbol(cleaned.replace(/\s+/g, ""));
};

export const pumpFunCreateUrl = (input: PumpFunCreateInput = {}) => {
  const params = new URLSearchParams();
  if (input.name) params.set("name", input.name.slice(0, 80));
  const ticker = input.symbol?.trim() ? sanitizeSymbol(input.symbol) : deriveTicker(input.name);
  params.set("symbol", ticker);
  if (input.description) {
    params.set("description", input.description.replace(/\s+/g, " ").trim().slice(0, 240));
  }
  if (input.imageUrl && /^https:\/\//i.test(input.imageUrl)) {
    params.set("image", input.imageUrl);
  }
  const qs = params.toString();
  return qs ? `${PUMP_FUN_BASE}?${qs}` : PUMP_FUN_BASE;
};

export const pumpFunDetailsJson = (input: PumpFunCreateInput = {}) =>
  JSON.stringify(
    {
      name: input.name ?? "",
      symbol: input.symbol?.trim() ? sanitizeSymbol(input.symbol) : deriveTicker(input.name),
      description: input.description ?? "",
      image: input.imageUrl ?? "",
    },
    null,
    2,
  );
