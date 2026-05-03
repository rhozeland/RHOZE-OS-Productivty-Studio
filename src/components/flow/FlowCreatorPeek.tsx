/**
 * FlowCreatorPeek
 *
 * Bottom sheet that swipes up from a Flow card to surface the uploader.
 * Triggered by an UP-swipe in Flow Mode (or the avatar tap on a card).
 *
 * Contains:
 *   • Avatar, display name, role/headline, verified badge
 *   • Bio snippet
 *   • CreatorReadinessCard (investor signal)
 *   • Embedded ProfileCoinTab (support / speculate)
 *   • "More works by …" mini grid (latest 6 flow_items by this creator)
 *   • CTA → open full profile
 *
 * Designed to feel like the card itself unfolded — the sheet uses a tall
 * mobile-style drawer with a drag handle so the next UP-swipe is a natural
 * gesture continuation.
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, X, ImageIcon, Music, FileText, Video, Palette } from "lucide-react";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import CreatorReadinessCard from "@/components/profile/CreatorReadinessCard";
import ProfileCoinTab from "@/components/profile/ProfileCoinTab";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string | null;
  /** Pre-known fields from the originating card so the sheet renders instantly. */
  initial?: {
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

const CAT_ICON: Record<string, any> = {
  music: Music,
  design: Palette,
  photo: ImageIcon,
  video: Video,
  writing: FileText,
};

const FlowCreatorPeek = ({ open, onOpenChange, creatorId, initial }: Props) => {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["flow-peek-profile", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, username, avatar_url, bio, headline, creator_roles, verification_status")
        .eq("user_id", creatorId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: works } = useQuery({
    queryKey: ["flow-peek-works", creatorId],
    enabled: open && !!creatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("flow_items")
        .select("id, title, category, content_type, file_url")
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const name = profile?.display_name || initial?.display_name || "Creator";
  const avatar = profile?.avatar_url || initial?.avatar_url || "";
  const isVerified = profile?.verification_status === "verified";
  const headline = profile?.headline || (Array.isArray(profile?.creator_roles) ? profile?.creator_roles?.slice(0, 2).join(" · ") : null);

  return (
    <AnimatePresence>
      {open && creatorId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          {/* Sheet — slides up like a continuation of the swipe */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
            }}
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[92vh] rounded-t-[28px] bg-card border-t border-border/40 shadow-2xl flex flex-col"
          >
            {/* Drag handle */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="h-1.5 w-10 rounded-full bg-border" />
            </div>

            {/* Close (top-right) */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="overflow-y-auto px-5 pb-8 pt-3">
              {/* Header — avatar + name + headline */}
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="h-14 w-14 border border-border/40">
                  <AvatarImage src={avatar} />
                  <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-xl font-bold text-foreground truncate">{name}</h2>
                    {isVerified && <VerifiedArtistBadge />}
                  </div>
                  {headline && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{headline}</p>
                  )}
                  {profile?.username && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">@{profile.username}</p>
                  )}
                </div>
              </div>

              {profile?.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
                  {profile.bio}
                </p>
              )}

              {/* Investor signal */}
              <div className="mb-5">
                <CreatorReadinessCard creatorId={creatorId} />
              </div>

              {/* Coin / Support CTA */}
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">
                  Support this artist
                </p>
                <ProfileCoinTab
                  creatorId={creatorId}
                  isOwnProfile={false}
                  defaultName={name}
                  defaultImage={avatar}
                  showReadiness={false}
                />
              </div>

              {/* More works */}
              {works && works.length > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">
                    More works
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {works.map((w: any) => {
                      const Icon = CAT_ICON[w.category] || Palette;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/flow?item=${w.id}`);
                          }}
                          className={cn(
                            "relative aspect-square rounded-xl overflow-hidden bg-muted/40 border border-border/30 group",
                          )}
                          title={w.title}
                        >
                          {w.file_url ? (
                            <img
                              src={w.file_url}
                              alt={w.title}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Icon className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Open full profile */}
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/profiles/${creatorId}`);
                }}
                className="w-full rounded-full gap-1.5"
                size="lg"
              >
                Open full profile <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FlowCreatorPeek;
