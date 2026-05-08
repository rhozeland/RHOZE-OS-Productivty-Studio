/**
 * useEventsCta — context-aware CTA labels for event cards.
 *
 * Given a list of event ids, returns a Map<eventId, EventCta> with
 *   • label  — "RSVP Free" | "Get Ticket · $XX" | "Registered ✓" | "Sold out"
 *   • kind   — "free" | "paid" | "registered" | "sold_out" | "unknown"
 *   • minPriceUsd / minPriceRhoze
 *   • registered (bool)
 *
 * Batched: one query for tiers across all eventIds, one for the current
 * user's tickets across the same set. Cards can call this once with the
 * grid's full id list — no per-card N+1.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EventCtaKind =
  | "free"
  | "paid"
  | "registered"
  | "sold_out"
  | "unknown";

export interface EventCta {
  label: string;
  kind: EventCtaKind;
  registered: boolean;
  minPriceUsd: number | null;
  minPriceRhoze: number | null;
  currency: string;
}

const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);

export function buildEventCta(opts: {
  tiers: Array<{
    price_usd: number | null;
    price_rhoze: number | null;
    currency_code?: string | null;
    quantity_total: number | null;
    quantity_sold: number | null;
    is_active: boolean;
  }>;
  registered: boolean;
}): EventCta {
  const activeTiers = opts.tiers.filter((t) => t.is_active);
  if (opts.registered) {
    return {
      label: "Registered ✓",
      kind: "registered",
      registered: true,
      minPriceUsd: null,
      minPriceRhoze: null,
      currency: "USD",
    };
  }
  if (activeTiers.length === 0) {
    return {
      label: "RSVP Free",
      kind: "free",
      registered: false,
      minPriceUsd: 0,
      minPriceRhoze: 0,
      currency: "USD",
    };
  }
  const available = activeTiers.filter(
    (t) =>
      t.quantity_total == null ||
      (t.quantity_sold ?? 0) < (t.quantity_total ?? Infinity),
  );
  if (available.length === 0) {
    return {
      label: "Sold out",
      kind: "sold_out",
      registered: false,
      minPriceUsd: null,
      minPriceRhoze: null,
      currency: "USD",
    };
  }
  // Cheapest tier wins. A free tier short-circuits to "RSVP Free".
  const sortedByPrice = [...available].sort(
    (a, b) => (Number(a.price_usd) || 0) - (Number(b.price_usd) || 0),
  );
  const cheapest = sortedByPrice[0];
  const usd = Number(cheapest.price_usd) || 0;
  const rhoze = Number(cheapest.price_rhoze) || 0;
  const currency = cheapest.currency_code || "USD";

  if (usd === 0 && rhoze === 0) {
    return {
      label: "RSVP Free",
      kind: "free",
      registered: false,
      minPriceUsd: 0,
      minPriceRhoze: 0,
      currency,
    };
  }
  return {
    label: `Get Ticket · ${formatPrice(usd, currency)}`,
    kind: "paid",
    registered: false,
    minPriceUsd: usd,
    minPriceRhoze: rhoze,
    currency,
  };
}

export const useEventsCta = (eventIds: string[]) => {
  const { user } = useAuth();
  const ids = Array.from(new Set(eventIds.filter(Boolean))).sort();
  const idKey = ids.join(",");

  return useQuery({
    queryKey: ["events-cta", idKey, user?.id ?? "guest"],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, EventCta>> => {
      const map = new Map<string, EventCta>();
      if (ids.length === 0) return map;

      const [tiersRes, ticketsRes] = await Promise.all([
        supabase
          .from("event_ticket_tiers")
          .select(
            "event_id, price_usd, price_rhoze, currency_code, quantity_total, quantity_sold, is_active",
          )
          .in("event_id", ids),
        user
          ? supabase
              .from("event_tickets")
              .select("event_id, status")
              .eq("holder_id", user.id)
              .in("event_id", ids)
              .in("status", ["issued", "checked_in", "pending_approval"])
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const tiersByEvent = new Map<string, any[]>();
      for (const t of (tiersRes.data ?? []) as any[]) {
        const arr = tiersByEvent.get(t.event_id) ?? [];
        arr.push(t);
        tiersByEvent.set(t.event_id, arr);
      }
      const registeredSet = new Set(
        ((ticketsRes.data ?? []) as any[]).map((r) => r.event_id),
      );

      for (const id of ids) {
        map.set(
          id,
          buildEventCta({
            tiers: tiersByEvent.get(id) ?? [],
            registered: registeredSet.has(id),
          }),
        );
      }
      return map;
    },
  });
};
