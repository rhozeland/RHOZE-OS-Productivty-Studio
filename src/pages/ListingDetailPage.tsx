import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Coins,
  Clock,
  RefreshCw,
  MessageCircle,
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Sparkles,
  Briefcase,
  FileText,
  Package,
  ShoppingBag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Play,
  ShoppingCart,
  CheckCircle,
  Loader2,
  Download,
  Search,
  Users,
  Send,
  HandshakeIcon,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import AudioPreview from "@/components/marketplace/AudioPreview";
import StarRating from "@/components/marketplace/StarRating";
import QuickMessageDialog from "@/components/messages/QuickMessageDialog";
import RevenueSplitConfig from "@/components/revenue/RevenueSplitConfig";

const CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  music: { label: "Music", icon: Music, color: "hsl(280, 60%, 55%)" },
  design: { label: "Design", icon: Palette, color: "hsl(160, 60%, 50%)" },
  photo: { label: "Photo", icon: Camera, color: "hsl(35, 90%, 55%)" },
  video: { label: "Video", icon: Video, color: "hsl(340, 70%, 55%)" },
  writing: { label: "Writing", icon: PenTool, color: "hsl(210, 60%, 55%)" },
};

const TYPE_META: Record<
  string,
  {
    label: string;
    icon: any;
    accent: string;
    headline: string;
    subline: string;
    primaryCta: string;
    secondaryCta: string;
    inquiryTitle: string;
    inquiryHint: string;
    inquiryPlaceholder: string;
  }
> = {
  service: {
    label: "Service",
    icon: Briefcase,
    accent: "hsl(160, 70%, 45%)",
    headline: "Available for hire",
    subline: "This creator is offering this as a service. Book them, send a brief, or start a conversation.",
    primaryCta: "Hire This Creator",
    secondaryCta: "Direct Message",
    inquiryTitle: "Hire request",
    inquiryHint: "Tell the creator what you need, your budget, and your timeline.",
    inquiryPlaceholder: "Hi! I'd like to hire you for...\n\nScope:\nBudget:\nDeadline:",
  },
  digital_product: {
    label: "Digital Product",
    icon: FileText,
    accent: "hsl(280, 60%, 55%)",
    headline: "Instant download",
    subline: "Buy once and download immediately. Files unlock the moment your purchase clears.",
    primaryCta: "Buy Now",
    secondaryCta: "Ask a Question",
    inquiryTitle: "Question about this product",
    inquiryHint: "Need to know something before buying? Ask away.",
    inquiryPlaceholder: "Hi! Quick question about this product...",
  },
  physical_product: {
    label: "Physical Product",
    icon: Package,
    accent: "hsl(35, 90%, 55%)",
    headline: "Ships to you",
    subline: "A real, tangible item. Shipping details are arranged with the seller after purchase.",
    primaryCta: "Order Now",
    secondaryCta: "Ask a Question",
    inquiryTitle: "Question about this item",
    inquiryHint: "Ask about size, shipping, condition, or anything else.",
    inquiryPlaceholder: "Hi! I'd like to know more about...",
  },
  project_request: {
    label: "Looking for Help",
    icon: Search,
    accent: "hsl(210, 80%, 55%)",
    headline: "Open project — pitch yourself",
    subline: "Someone needs this work done. Pitch your skills, rate, and availability to win the gig.",
    primaryCta: "Submit a Pitch",
    secondaryCta: "Direct Message",
    inquiryTitle: "Pitch for this project",
    inquiryHint: "Sell yourself. Share relevant work, your rate, and how soon you can start.",
    inquiryPlaceholder: "Hi! I'd love to take this on. Here's why I'm a fit...\n\nRate:\nAvailability:\nPortfolio:",
  },
  collaboration: {
    label: "Seeking Collaborators",
    icon: HandshakeIcon,
    accent: "hsl(340, 70%, 55%)",
    headline: "Open to collaborate",
    subline: "Not a paid gig — a creative partnership. Share what you bring to the table.",
    primaryCta: "Join the Project",
    secondaryCta: "Direct Message",
    inquiryTitle: "Collaboration request",
    inquiryHint: "Introduce yourself and share what you'd contribute to the collab.",
    inquiryPlaceholder: "Hey! I'd love to collaborate. Here's what I bring...\n\nMy role:\nWhat I'm into:\nLinks:",
  },
};

const ListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [dmOpen, setDmOpen] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: media } = useQuery({
    queryKey: ["listing-media", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_media")
        .select("*")
        .eq("listing_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-profile", listing?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", listing!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!listing,
  });

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: existingPurchase } = useQuery({
    queryKey: ["purchase-check", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases" as any)
        .select("id")
        .eq("buyer_id", user!.id)
        .eq("listing_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!user || !listing) throw new Error("Missing data");
      const { data, error } = await supabase.rpc("purchase_listing" as any, {
        _listing_id: listing.id,
        _buyer_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-check", id] });
      toast.success("Purchase complete! 🎉");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reviews
  const { data: reviews } = useQuery({
    queryKey: ["listing-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews" as any)
        .select("*")
        .eq("listing_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Reviewer profiles
  const reviewerIds = reviews?.map((r: any) => r.reviewer_id) ?? [];
  const { data: reviewerProfiles } = useQuery({
    queryKey: ["reviewer-profiles", reviewerIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", reviewerIds);
      if (error) throw error;
      return data;
    },
    enabled: reviewerIds.length > 0,
  });

  const reviewersMap = new Map(reviewerProfiles?.map((p) => [p.user_id, p]) ?? []);
  const avgRating = reviews?.length
    ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;
  const myReview = reviews?.find((r: any) => r.reviewer_id === user?.id);

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user || !listing) throw new Error("Missing data");
      const { error } = await supabase.from("reviews" as any).insert({
        listing_id: listing.id,
        reviewer_id: user.id,
        seller_id: listing.user_id,
        rating: reviewRating,
        comment: reviewComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing-reviews", id] });
      setReviewComment("");
      setReviewRating(5);
      toast.success("Review submitted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendInquiry = useMutation({
    mutationFn: async () => {
      if (!user || !listing) throw new Error("Missing data");
      const { error } = await supabase.from("listing_inquiries").insert({
        listing_id: listing.id,
        sender_id: user.id,
        receiver_id: listing.user_id,
        message: inquiryMsg,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInquiryOpen(false);
      setInquiryMsg("");
      toast.success("Inquiry sent! The seller will be in touch.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!listing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const catMeta = CATEGORIES[listing.category] || { label: listing.category, icon: Sparkles, color: "hsl(var(--primary))" };
  const typeMeta = TYPE_META[listing.listing_type] || TYPE_META.service;
  const TypeIcon = typeMeta.icon;
  const CatIcon = catMeta.icon;
  const isOwner = listing.user_id === user?.id;
  const alreadyPurchased = !!(existingPurchase as any)?.id;
  const canBuyInstantly = listing.listing_type === "digital_product" && listing.credits_price != null && listing.credits_price > 0;
  const hasEnoughCredits = (userCredits?.balance ?? 0) >= (listing.credits_price ?? 0);

  const images = media?.filter((m) => m.file_type?.startsWith("image")) ?? [];
  const audioFiles = media?.filter((m) => m.file_type?.startsWith("audio")) ?? [];
  const videoFiles = media?.filter((m) => m.file_type?.startsWith("video")) ?? [];
  const pdfFiles = media?.filter((m) => m.file_type === "application/pdf") ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/marketplace">
        <Button variant="ghost" size="sm" className="gap-1 rounded-full">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Button>
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Media */}
        <div className="lg:col-span-3 space-y-4">
          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="relative rounded-2xl overflow-hidden bg-muted aspect-[16/10]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={galleryIdx}
                  src={images[galleryIdx]?.file_url}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryIdx((i) => Math.max(0, i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-card"
                    disabled={galleryIdx === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setGalleryIdx((i) => Math.min(images.length - 1, i + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-card"
                    disabled={galleryIdx === images.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === galleryIdx ? "w-6 bg-primary" : "w-1.5 bg-card/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : listing.cover_url ? (
            <div className="rounded-2xl overflow-hidden bg-muted aspect-[16/10]">
              <img src={listing.cover_url} alt={listing.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="rounded-2xl aspect-[16/10] flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${catMeta.color}22, ${catMeta.color}11)` }}
            >
              <CatIcon className="h-16 w-16" style={{ color: catMeta.color, opacity: 0.3 }} />
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setGalleryIdx(i)}
                  className={`flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all ${
                    i === galleryIdx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={img.file_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Audio previews */}
          {audioFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Audio Previews</h3>
              {audioFiles.map((a) => (
                <AudioPreview key={a.id} src={a.file_url} title={a.file_name} />
              ))}
            </div>
          )}

          {/* Video previews */}
          {videoFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Video</h3>
              {videoFiles.map((v) => (
                <video key={v.id} src={v.file_url} controls className="w-full rounded-xl" preload="metadata" />
              ))}
            </div>
          )}

          {/* PDF links */}
          {pdfFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Documents</h3>
              {pdfFiles.map((p) => (
                <a
                  key={p.id}
                  href={p.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {p.file_name}
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              ))}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {listing.description}
              </p>
            </div>
          )}

          {/* Reviews Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Reviews {reviews?.length ? `(${reviews.length})` : ""}
              </h3>
              {avgRating && (
                <div className="flex items-center gap-2">
                  <StarRating rating={avgRating} />
                  <span className="text-sm font-bold text-foreground">{avgRating}</span>
                </div>
              )}
            </div>

            {/* Write review (only if purchased and not already reviewed and not owner) */}
            {!isOwner && !!(existingPurchase as any)?.id && !myReview && (
              <form
                onSubmit={(e) => { e.preventDefault(); submitReview.mutate(); }}
                className="bg-muted/50 rounded-xl p-4 space-y-3"
              >
                <p className="text-xs font-medium text-foreground">Leave a review</p>
                <StarRating rating={reviewRating} interactive onRate={setReviewRating} size="md" />
                <Textarea
                  placeholder="How was your experience? (optional)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <Button type="submit" size="sm" className="rounded-full" disabled={submitReview.isPending}>
                  {submitReview.isPending ? "Submitting..." : "Submit Review"}
                </Button>
              </form>
            )}

            {/* Review list */}
            {reviews && reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((review: any) => {
                  const reviewer = reviewersMap.get(review.reviewer_id);
                  return (
                    <div key={review.id} className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                            {(reviewer?.display_name || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-foreground">
                            {reviewer?.display_name || "Anonymous"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} />
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(review.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No reviews yet</p>
            )}
          </div>
        </div>

        {/* Right: Info sidebar */}
        <div className="lg:col-span-2 space-y-4">
          <div className="surface-card overflow-hidden sticky top-4">
            {/* Type hero band — sets clear context for what this listing IS */}
            <div
              className="px-5 pt-5 pb-4 border-b border-border/60"
              style={{
                background: `linear-gradient(135deg, ${typeMeta.accent}1f 0%, ${typeMeta.accent}08 100%)`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: `${typeMeta.accent}26`, color: typeMeta.accent }}
                >
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: typeMeta.accent }}
                  >
                    {typeMeta.label}
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {typeMeta.headline}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1 text-[10px] shrink-0">
                  <CatIcon className="h-3 w-3" style={{ color: catMeta.color }} />
                  {catMeta.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {typeMeta.subline}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <h1 className="font-display text-xl font-bold text-foreground leading-tight">
                {listing.title}
              </h1>

              {/* Rating summary */}
              {avgRating && (
                <div className="flex items-center gap-2">
                  <StarRating rating={avgRating} />
                  <span className="text-sm font-bold text-foreground">{avgRating}</span>
                  <span className="text-xs text-muted-foreground">({reviews?.length} review{reviews?.length !== 1 ? "s" : ""})</span>
                </div>
              )}

              {/* Price / Budget — context-aware label */}
              {(listing.credits_price != null || listing.price != null) && (
                <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {listing.listing_type === "project_request"
                      ? "Budget"
                      : listing.listing_type === "collaboration"
                        ? "Contribution"
                        : "Price"}
                  </p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {listing.credits_price != null && (
                      <div className="flex items-center gap-1.5 text-2xl font-display font-bold text-foreground">
                        <Coins className="h-5 w-5 text-primary" />
                        {listing.credits_price}
                        <span className="text-xs font-medium text-muted-foreground">$RHOZE</span>
                      </div>
                    )}
                    {listing.price != null && (
                      <span className="text-sm text-muted-foreground">
                        {listing.credits_price != null ? "or " : ""}${listing.price} {listing.currency || "USD"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Details */}
              {(listing.delivery_days || listing.revisions != null || listing.shipping_info) && (
                <div className="space-y-2 text-sm">
                  {listing.delivery_days && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{listing.delivery_days} day {listing.listing_type === "project_request" ? "deadline" : "delivery"}</span>
                    </div>
                  )}
                  {listing.revisions != null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4" />
                      <span>{listing.revisions} revision{listing.revisions !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {listing.shipping_info && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{listing.shipping_info}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {listing.tags && listing.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {listing.tags.map((tag: string) => (
                    <span key={tag} className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA — type-specific */}
              {!isOwner && (
                <div className="space-y-2 pt-2">
                  {/* Instant buy for digital products */}
                  {canBuyInstantly && !alreadyPurchased && (
                    <Button
                      className="w-full rounded-full h-11"
                      onClick={() => purchaseMutation.mutate()}
                      disabled={purchaseMutation.isPending || !hasEnoughCredits}
                    >
                      {purchaseMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                      ) : !hasEnoughCredits ? (
                        <><Coins className="mr-2 h-4 w-4" />Not enough $RHOZE</>
                      ) : (
                        <><ShoppingCart className="mr-2 h-4 w-4" />{typeMeta.primaryCta} — {listing.credits_price} $RHOZE</>
                      )}
                    </Button>
                  )}

                  {/* Already purchased */}
                  {canBuyInstantly && alreadyPurchased && (
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full rounded-full pointer-events-none h-11" disabled>
                        <CheckCircle className="mr-2 h-4 w-4 text-primary" />
                        Purchased — files unlocked
                      </Button>
                      {/* Download links for purchased media */}
                      {media && media.length > 0 && (
                        <div className="space-y-1.5">
                          {media.map((m) => (
                            <a
                              key={m.id}
                              href={m.file_url}
                              download={m.file_name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm text-primary hover:bg-muted transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {m.file_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Credit balance hint */}
                  {canBuyInstantly && !alreadyPurchased && !hasEnoughCredits && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => navigate("/credits")}
                    >
                      You have {userCredits?.balance ?? 0} $RHOZE — Get more →
                    </Button>
                  )}

                  {/* Primary type-specific CTA (for non-instant-buy listings) */}
                  {!canBuyInstantly && (
                    <Button
                      className="w-full rounded-full h-11"
                      onClick={() => setInquiryOpen(true)}
                      style={{
                        background: typeMeta.accent,
                        color: "white",
                      }}
                    >
                      {listing.listing_type === "project_request" ? (
                        <Send className="mr-2 h-4 w-4" />
                      ) : listing.listing_type === "collaboration" ? (
                        <HandshakeIcon className="mr-2 h-4 w-4" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      {typeMeta.primaryCta}
                    </Button>
                  )}

                  {/* Secondary inquiry button for digital products */}
                  {canBuyInstantly && (
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => setInquiryOpen(true)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Ask a Question
                    </Button>
                  )}

                  {/* Direct message — always available */}
                  <Button
                    variant="ghost"
                    className="w-full rounded-full"
                    onClick={() => setDmOpen(true)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {typeMeta.secondaryCta}
                  </Button>
                </div>
              )}

              {/* Owner view */}
              {isOwner && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/40 border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                    This is your listing. <Link to="/seller" className="text-primary hover:underline">Manage in Seller Dashboard</Link>
                  </div>
                  <RevenueSplitConfig listingId={listing.id} />
                </div>
              )}

              {/* Seller info */}
              {sellerProfile && (
                <div className="border-t border-border pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {listing.listing_type === "project_request" ? "Posted by" : "Creator"}
                  </p>
                  <Link
                    to={`/profiles/${sellerProfile.user_id}`}
                    className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    {sellerProfile.avatar_url ? (
                      <img
                        src={sellerProfile.avatar_url}
                        alt={sellerProfile.display_name || ""}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {(sellerProfile.display_name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {sellerProfile.display_name}
                      </p>
                      {sellerProfile.headline && (
                        <p className="text-xs text-muted-foreground truncate">
                          {sellerProfile.headline}
                        </p>
                      )}
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry dialog — type-specific framing */}
      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: `${typeMeta.accent}26`, color: typeMeta.accent }}
              >
                <TypeIcon className="h-3.5 w-3.5" />
              </div>
              {typeMeta.inquiryTitle}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); if (inquiryMsg.trim()) sendInquiry.mutate(); }}
            className="space-y-4"
          >
            <div className="rounded-lg bg-muted/40 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Re: {typeMeta.label}
              </p>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {listing.title}
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {typeMeta.inquiryHint}
            </p>
            <Textarea
              placeholder={typeMeta.inquiryPlaceholder}
              value={inquiryMsg}
              onChange={(e) => setInquiryMsg(e.target.value)}
              rows={6}
              required
              className="text-sm resize-none"
            />
            <Button
              type="submit"
              className="w-full rounded-full h-11"
              disabled={!inquiryMsg.trim() || sendInquiry.isPending}
              style={{ background: typeMeta.accent, color: "white" }}
            >
              {sendInquiry.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />{typeMeta.primaryCta}</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {listing && (
        <QuickMessageDialog
          open={dmOpen}
          onOpenChange={setDmOpen}
          recipientId={listing.user_id}
          recipientName={sellerProfile?.display_name || "Creator"}
          recipientAvatar={sellerProfile?.avatar_url}
          prefillMessage={`Hi! I'm interested in your listing "${listing.title}". Could we discuss the details?`}
        />
      )}
    </div>
  );
};

export default ListingDetailPage;
