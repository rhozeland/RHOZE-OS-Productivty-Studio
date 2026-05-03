import { useState } from "react";
import { rewriteShortDescription } from "@/lib/studio-copy";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  Users,
  Clock,
  DollarSign,
  ArrowLeft,
  CheckCircle,
  Calendar,
  MessageSquare,
  Coins,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StudioBookingModal from "@/components/booking/StudioBookingModal";
import QuickMessageDialog from "@/components/messages/QuickMessageDialog";
import LaunchCoinDialog from "@/components/launchpad/LaunchCoinDialog";

const StudioDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const { data: studio, isLoading } = useQuery({
    queryKey: ["studio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studios")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["studio-owner-profile", studio?.owner_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", studio!.owner_id)
        .maybeSingle();
      return data;
    },
    enabled: !!studio?.owner_id,
  });

  // Studio-specific services
  const { data: studioServices } = useQuery({
    queryKey: ["studio-detail-services", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_services")
        .select("*")
        .eq("studio_id", id!)
        .eq("is_active", true)
        .order("sort_order");
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  const { data: availability } = useQuery({
    queryKey: ["studio-availability", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_availability")
        .select("*")
        .eq("studio_id", id!)
        .order("day_of_week");
      return data ?? [];
    },
    enabled: !!id,
  });

  // Coin drops attached to this space (any creator can drop a coin here in
  // future; today we surface all coins where space_id matches OR — for back-
  // compat with legacy data — the studio owner is the creator).
  const { data: spaceCoins, refetch: refetchSpaceCoins } = useQuery({
    queryKey: ["studio-detail-coins", id, studio?.owner_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, name, ticker, image_url, status, real_sol_reserves, graduation_sol_target, space_id")
        .or(`space_id.eq.${id},and(space_id.is.null,creator_id.eq.${studio!.owner_id})`)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data as any[]) ?? [];
    },
    enabled: !!studio?.owner_id && !!id,
  });

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-72 bg-muted animate-pulse rounded-2xl" />
        <div className="h-40 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!studio) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">Studio not found</h3>
        <Link to="/discover?kind=space" className="mt-4">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + Manage */}
      <div className="flex items-center justify-between">
        <Link to="/discover?kind=space" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Discover
        </Link>
        {user && studio.owner_id === user.id && (
          <Link to={`/studios/${studio.id}/manage`}>
            <Button variant="outline" size="sm" className="rounded-full gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Manage Studio
            </Button>
          </Link>
        )}
      </div>

      {/* Hero image */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="aspect-[2/1] rounded-2xl bg-muted overflow-hidden"
      >
        {studio.cover_image_url ? (
          <img src={studio.cover_image_url} alt={studio.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <Building2 className="h-16 w-16 text-muted-foreground/20" />
          </div>
        )}
      </motion.div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{studio.name}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {(studio.city || studio.country) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[studio.city, studio.state, studio.country].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="flex items-center gap-1 capitalize">
                <Building2 className="h-3.5 w-3.5" /> {studio.category} Studio
              </span>
              {studio.max_guests && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Up to {studio.max_guests} guests
                </span>
              )}
            </div>
          </div>

          {/* Hosted by — links to host profile */}
          {ownerProfile && (
            <Link
              to={`/profiles/${ownerProfile.user_id}`}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/40 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0">
                {ownerProfile.avatar_url ? (
                  <img src={ownerProfile.avatar_url} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  ownerProfile.display_name?.[0]?.toUpperCase() ?? "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  Hosted by {ownerProfile.display_name ?? ownerProfile.username ?? "Creator"}
                </p>
                <p className="text-xs text-muted-foreground">View profile →</p>
              </div>
            </Link>
          )}

          {/* Description */}
          {studio.description && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-2">About this space</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {rewriteShortDescription(studio.description, studio.city)}
              </p>
            </div>
          )}

          {/* Parking & Logistics removed — host shares logistics via Inbox after booking. */}

          {/* Amenities */}
          {studio.amenities && studio.amenities.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">Amenities</h2>
              <div className="grid grid-cols-2 gap-2">
                {studio.amenities.map((amenity: string) => (
                  <div key={amenity} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    {amenity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {studio.equipment && studio.equipment.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">Equipment</h2>
              <div className="flex flex-wrap gap-2">
                {studio.equipment.map((item: string) => (
                  <Badge key={item} variant="secondary" className="rounded-full">{item}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {studioServices && studioServices.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">Services Offered</h2>
              <div className="space-y-2">
                {studioServices.map((svc: any) => (
                  <div key={svc.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{svc.title}</p>
                      {svc.description && <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-foreground">${svc.price}</p>
                      <p className="text-xs text-muted-foreground">{svc.duration_hours}h</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artist coins — Coins/Launchpad surface tied to this Space (host's Verified IP). */}
          {spaceCoins && spaceCoins.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Artist coins
                  </p>
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    From this space.
                  </h2>
                </div>
                <Link
                  to="/launchpad"
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  Open Launchpad →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {spaceCoins.map((c: any) => {
                  const progress = Math.min(
                    100,
                    (Number(c.real_sol_reserves) / Number(c.graduation_sol_target)) * 100,
                  );
                  return (
                    <Link
                      key={c.id}
                      to={`/launchpad/${c.id}`}
                      className="group block rounded-2xl border border-border bg-card hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all p-4"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt={c.name}
                            className="h-11 w-11 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0">
                            <Coins className="h-5 w-5 text-emerald-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm">${c.ticker}</span>
                            {c.status === "graduated" && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                                Grad
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{c.name}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                        <span>{Number(c.real_sol_reserves).toFixed(2)} SOL</span>
                        <span>{c.graduation_sol_target} SOL goal</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gallery */}
          {(() => {
            const photos = (studio.gallery_urls || []).filter((u: string) => !u.startsWith("[VIDEO]"));
            const videoUrl = (studio.gallery_urls || []).find((u: string) => u.startsWith("[VIDEO]"))?.replace("[VIDEO]", "");
            if (photos.length === 0 && !videoUrl) return null;
            return (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground mb-3">Gallery</h2>
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {photos.map((url: string, i: number) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {videoUrl && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe src={videoUrl} className="w-full h-full" allowFullScreen title="Studio video" />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Studio Hours */}
          {availability && availability.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">Studio Hours</h2>
              <div className="grid grid-cols-1 gap-1.5">
                {availability.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/30">
                    <span className={`font-medium ${slot.is_available ? "text-foreground" : "text-muted-foreground"}`}>
                      {DAY_NAMES[slot.day_of_week]}
                    </span>
                    {slot.is_available ? (
                      <span className="text-muted-foreground">
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 italic">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          {studio.rules && (
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-2">Studio Rules</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{studio.rules}</p>
            </div>
          )}

          {/* Ratings hidden for now — surface as a metric later. */}
        </div>

        {/* Right — booking card */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl bg-card border border-border p-6 shadow-lg space-y-4">
            {(studio as any).show_price !== false && studio.hourly_rate > 0 ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-bold text-foreground">${studio.hourly_rate}</span>
                  <span className="text-muted-foreground text-sm">/ hour</span>
                </div>
                {studio.daily_rate && (
                  <p className="text-sm text-muted-foreground">
                    <DollarSign className="inline h-3.5 w-3.5" />{studio.daily_rate}/day rate available
                  </p>
                )}
              </>
            ) : (
              <div>
                <p className="font-display text-lg font-bold text-foreground">Inquire for Pricing</p>
                <p className="text-sm text-muted-foreground">Message the host for rates and availability</p>
              </div>
            )}

            {user ? (
              <div className="space-y-3">
                <Button className="w-full h-12 text-base rounded-full gap-2" onClick={() => setBookingOpen(true)}>
                  <Calendar className="h-4 w-4" /> Book This Studio
                </Button>
                <Button variant="outline" className="w-full rounded-full gap-2" onClick={() => setDmOpen(true)}>
                  <MessageSquare className="h-4 w-4" /> Message Host
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Link to="/auth">
                  <Button className="w-full h-12 text-base rounded-full gap-2">
                    Sign up to Book
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">
                  Create a free account to book studios and hire talent.
                </p>
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" /> Flexible hourly booking
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 shrink-0" /> Instant confirmation
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" /> Up to {studio.max_guests} guests
              </div>
            </div>
          </div>
        </div>
      </div>
      {studio && (
        <StudioBookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          studio={{
            id: studio.id,
            name: studio.name,
            hourly_rate: studio.hourly_rate,
            daily_rate: studio.daily_rate,
            max_guests: studio.max_guests,
            currency: studio.currency,
          }}
        />
      )}

      {studio && (
        <QuickMessageDialog
          open={dmOpen}
          onOpenChange={setDmOpen}
          recipientId={studio.owner_id}
          recipientName={studio.name}
        />
      )}
    </div>
  );
};

export default StudioDetailPage;
