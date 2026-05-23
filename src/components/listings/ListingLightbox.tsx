/**
 * ListingLightbox — quick-look dialog for marketplace listings on Discover.
 *
 * Surfaces the essentials (cover, title, creator, budget, description, tags)
 * with two CTAs:
 *   • Message creator → opens DM thread via /messages?with={user_id}
 *   • Start a project from this listing → ferries the listing into
 *     /messages?tab=projects&new=1 with prefill stashed in sessionStorage.
 *
 * Owner-management heavy-lifting still lives on /listings/:id; this dialog
 * is the friction-light entry point Discover now funnels through.
 */
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, MessageCircle, Plus, Clock, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: any | null;
}

const ListingLightbox = ({ open, onOpenChange, listing }: Props) => {
  const navigate = useNavigate();

  const { data: creator } = useQuery({
    queryKey: ["listing-lightbox-creator", listing?.user_id],
    enabled: !!listing?.user_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", listing.user_id)
        .maybeSingle();
      return data;
    },
  });

  if (!listing) return null;

  const handleStartProject = () => {
    try {
      sessionStorage.setItem(
        "newProjectPrefill",
        JSON.stringify({
          title: listing.title,
          listingId: listing.id,
          collaboratorId: listing.user_id,
          scope: listing.description ?? null,
        }),
      );
    } catch {
      /* ignore */
    }
    onOpenChange(false);
    navigate(`/messages?tab=projects&new=1`);
  };

  const handleMessage = () => {
    onOpenChange(false);
    navigate(`/messages?with=${listing.user_id}&listing=${listing.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Cover */}
        {listing.cover_url ? (
          <div className="relative aspect-[16/8] bg-muted shrink-0">
            <img src={listing.cover_url} alt={listing.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-3 bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 shrink-0" />
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Type + Category */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {listing.listing_type === "project_request" ? "Open call" : listing.listing_type === "collaboration" ? "Collab" : "Offering"}
            </Badge>
            {listing.category && (
              <Badge variant="outline" className="text-[10px] capitalize">{listing.category}</Badge>
            )}
            {listing.delivery_days && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {listing.delivery_days}d
              </span>
            )}
            {listing.contact_info && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <DollarSign className="h-3 w-3" /> {listing.contact_info}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl font-semibold tracking-tight leading-tight">{listing.title}</h2>

          {/* Creator */}
          {creator && (
            <Link
              to={`/profiles/${listing.user_id}`}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={creator.avatar_url || ""} />
                <AvatarFallback className="text-[10px]">{(creator.display_name || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <span>by <span className="font-medium text-foreground">{creator.display_name || creator.username}</span></span>
            </Link>
          )}

          {/* Description */}
          {listing.description && (
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          )}

          {/* Tags */}
          {listing.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.tags.map((t: string) => (
                <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="border-t border-border/60 p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 shrink-0">
          <Button onClick={handleStartProject} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Start a project from this
          </Button>
          <Button variant="outline" onClick={handleMessage} className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>
          <Button
            variant="ghost"
            asChild
            className="gap-1.5"
            onClick={() => onOpenChange(false)}
          >
            <Link to={`/listings/${listing.id}`}>
              Full page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListingLightbox;
