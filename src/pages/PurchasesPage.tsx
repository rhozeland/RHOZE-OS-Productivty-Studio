import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Download,
  ShoppingBag,
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

const CAT_ICONS: Record<string, any> = {
  music: Music,
  design: Palette,
  photo: Camera,
  video: Video,
  writing: PenTool,
};

const PurchasesPage = () => {
  const { user } = useAuth();

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["my-purchases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases" as any)
        .select("*")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch listing details for all purchases
  const listingIds = purchases?.map((p: any) => p.listing_id) ?? [];
  const { data: listings } = useQuery({
    queryKey: ["purchased-listings", listingIds],
    queryFn: async () => {
      // Need to query including inactive listings for purchase history
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .in("id", listingIds);
      if (error) throw error;
      return data;
    },
    enabled: listingIds.length > 0,
  });

  // Fetch media for digital product downloads
  const { data: allMedia } = useQuery({
    queryKey: ["purchased-media", listingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_media")
        .select("*")
        .in("listing_id", listingIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: listingIds.length > 0,
  });

  const listingsMap = new Map(listings?.map((l) => [l.id, l]) ?? []);
  const mediaMap = new Map<string, typeof allMedia>();
  allMedia?.forEach((m) => {
    if (!mediaMap.has(m.listing_id)) mediaMap.set(m.listing_id, []);
    mediaMap.get(m.listing_id)!.push(m);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Purchases</h1>
        <p className="text-muted-foreground">Your purchased items and download history</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !purchases?.length ? (
        <div className="text-center py-20 space-y-4">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">No purchases yet</p>
          <Link to="/marketplace">
            <Button variant="outline" className="rounded-full">Browse Marketplace</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase: any) => {
            const listing = listingsMap.get(purchase.listing_id);
            const media = mediaMap.get(purchase.listing_id) ?? [];
            const CatIcon = CAT_ICONS[listing?.category] ?? Sparkles;

            return (
              <div key={purchase.id} className="surface-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CatIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/marketplace/${purchase.listing_id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                      >
                        {listing?.title ?? "Listing"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(purchase.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1 flex-shrink-0">
                    <Coins className="h-3 w-3" />
                    {purchase.credits_paid}
                  </Badge>
                </div>

                {/* Download files */}
                {media.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {media.map((m: any) => (
                      <a
                        key={m.id}
                        href={m.file_url}
                        download={m.file_name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-primary hover:bg-muted/80 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        {m.file_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;
