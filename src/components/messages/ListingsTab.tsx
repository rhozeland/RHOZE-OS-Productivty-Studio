/**
 * ListingsTab — your own marketplace listings, lifted off Discover so the
 * mosaic can stay focused on content + IP + seasonal events. Conversations
 * is where work-related back-and-forth lives, so listings (which generate
 * inquiries that already land here) sit alongside DMs / Inquiries.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Store, ArrowRight, Loader2 } from "lucide-react";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";

const ListingsTab = ({ userId }: { userId: string }) => {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["my-listings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, category, price, credits_price, listing_type, is_active, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Your offerings and open calls. Inquiries land in the Inquiries tab.
        </p>
        <Button size="sm" className="rounded-full gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Post a listing
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="text-center py-16 surface-card">
          <Store className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mt-3">No listings yet</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Post your first listing
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((l: any) => (
            <div
              key={l.id}
              className="surface-card p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={l.is_active ? "default" : "secondary"} className="text-[10px]">
                    {l.is_active ? "Live" : "Hidden"}
                  </Badge>
                  {l.category && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {l.category}
                    </span>
                  )}
                  {l.listing_type === "project_request" && (
                    <Badge variant="outline" className="text-[10px]">Open Call</Badge>
                  )}
                </div>
                <Link
                  to={`/marketplace/${l.id}`}
                  className="font-semibold text-sm text-foreground hover:text-primary truncate block"
                >
                  {l.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {l.credits_price
                    ? `${l.credits_price} $RHOZE`
                    : l.price
                      ? `$${Number(l.price).toFixed(0)}`
                      : "Inquire"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link to={`/marketplace/${l.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Open">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default ListingsTab;
