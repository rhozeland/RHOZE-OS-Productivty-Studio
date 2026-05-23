/**
 * ListingsLane — v10.3 Discover lane for active marketplace listings.
 *
 * Horizontal scroll of the latest active listings (offerings, open calls,
 * collabs). Tapping a tile opens <ListingLightbox /> which funnels into
 * Projects via "Start a project from this listing".
 *
 * Returns null when there are <2 active listings so Discover never shows
 * a near-empty lane.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Search, Briefcase, Users, Sparkles } from "lucide-react";
import ListingLightbox from "@/components/listings/ListingLightbox";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: any; accent: string }> = {
  service: { label: "Offering", icon: Briefcase, accent: "hsl(var(--primary))" },
  digital_product: { label: "Offering", icon: Briefcase, accent: "hsl(var(--primary))" },
  physical_product: { label: "Offering", icon: Briefcase, accent: "hsl(var(--primary))" },
  project_request: { label: "Open call", icon: Search, accent: "hsl(38 92% 55%)" },
  collaboration: { label: "Collab", icon: Users, accent: "hsl(292 84% 61%)" },
};

const ListingsLane = () => {
  const [activeListing, setActiveListing] = useState<any | null>(null);

  const { data: listings = [] } = useQuery({
    queryKey: ["discover-listings-lane"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  if (listings.length < 2) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight">
            Open calls & listings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Brief, hire, or pitch in — every listing becomes a project in one click.
          </p>
        </div>
        <Link
          to="/market?view=calls"
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto scroll-smooth scrollbar-none">
        <div className="flex gap-3 pb-2 min-w-min">
          {listings.map((l: any) => {
            const meta = TYPE_META[l.listing_type] ?? { label: l.listing_type, icon: Sparkles, accent: "hsl(var(--primary))" };
            const Icon = meta.icon;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveListing(l)}
                className="group shrink-0 w-[260px] text-left rounded-2xl border border-border/70 bg-card/60 hover:bg-card hover:border-foreground/30 transition-all overflow-hidden"
              >
                {l.cover_url ? (
                  <div className="aspect-[16/9] bg-muted overflow-hidden">
                    <img
                      src={l.cover_url}
                      alt={l.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[16/9] flex items-end p-3"
                    style={{ background: `linear-gradient(135deg, ${meta.accent}22, transparent 75%)` }}
                  >
                    <Icon className="h-7 w-7" style={{ color: meta.accent, opacity: 0.5 }} />
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      )}
                      style={{ background: `${meta.accent}1f`, color: meta.accent }}
                    >
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    {l.contact_info && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">{l.contact_info}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{l.title}</p>
                  {l.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{l.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ListingLightbox
        open={!!activeListing}
        onOpenChange={(v) => !v && setActiveListing(null)}
        listing={activeListing}
      />
    </section>
  );
};

export default ListingsLane;
