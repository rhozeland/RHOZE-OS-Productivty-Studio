/**
 * ProfileCatalogCard — v10.4
 *
 * Unifies Listings, Events, and Spaces into a single tabbed card on the
 * creator profile (was three stacked cards). Tabs only render if their
 * collection has rows; if nothing is present, the whole card is hidden.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ShoppingBag,
  Calendar as CalendarIcon,
  Building2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TabId = "listings" | "events" | "spaces";

interface Props {
  listings?: any[];
  events?: any[];
  spaces?: any[];
}

const ProfileCatalogCard = ({ listings = [], events = [], spaces = [] }: Props) => {
  const navigate = useNavigate();

  const tabs = useMemo(() => {
    const t: { id: TabId; label: string; count: number }[] = [];
    if (listings.length) t.push({ id: "listings", label: "Listings", count: listings.length });
    if (events.length) t.push({ id: "events", label: "Events", count: events.length });
    if (spaces.length) t.push({ id: "spaces", label: "Spaces", count: spaces.length });
    return t;
  }, [listings.length, events.length, spaces.length]);

  const [active, setActive] = useState<TabId | null>(tabs[0]?.id ?? null);
  const currentActive = active && tabs.some((t) => t.id === active) ? active : tabs[0]?.id ?? null;

  if (tabs.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-2 overflow-hidden">
      {/* Tab pill switcher */}
      <div className="flex p-1 bg-muted/40 rounded-xl gap-1 mb-1">
        {tabs.map((t) => {
          const isActive = currentActive === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex-1 py-2 px-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                "flex items-center justify-center gap-1 min-w-0",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "text-[9px] tabular-nums",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/60",
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Items */}
      <div className="p-1 space-y-1">
        {currentActive === "listings" &&
          listings.map((l: any) => {
            const priceLabel = l.credits_price
              ? `${l.credits_price} $RHOZE`
              : l.price
              ? `${l.currency || "$"}${l.price}`
              : null;
            const typeLabel =
              l.listing_type === "project_request"
                ? "Open call"
                : l.listing_type === "collaboration"
                ? "Collab"
                : "Offering";
            return (
              <button
                key={l.id}
                onClick={() => navigate(`/marketplace/${l.id}`)}
                className="group w-full text-left flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{l.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {typeLabel}
                    {priceLabel ? ` · ${priceLabel}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}

        {currentActive === "events" &&
          events.map((e: any) => {
            const isPast = new Date(e.starts_at) < new Date();
            return (
              <button
                key={e.id}
                onClick={() => navigate(`/events/${e.slug || e.id}`)}
                className="group w-full text-left flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors"
              >
                {e.cover_url ? (
                  <img
                    src={e.cover_url}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                    {isPast && (
                      <Badge variant="outline" className="text-[8px] shrink-0 px-1 py-0">
                        Past
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {format(new Date(e.starts_at), "MMM d · h:mm a")}
                    {e.is_online ? " · Online" : e.venue_name ? ` · ${e.venue_name}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}

        {currentActive === "spaces" &&
          spaces.map((s: any) => (
            <button
              key={s.id}
              onClick={() => navigate(`/studios/${s.id}`)}
              className="group w-full text-left flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors"
            >
              {s.cover_image_url ? (
                <img
                  src={s.cover_image_url}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[s.city, s.state].filter(Boolean).join(" · ") || "Space"}
                  {s.hourly_rate ? ` · ${s.currency || "$"}${s.hourly_rate}/hr` : ""}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
      </div>
    </div>
  );
};

export default ProfileCatalogCard;
