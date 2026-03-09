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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import AudioPreview from "@/components/marketplace/AudioPreview";

const CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  music: { label: "Music", icon: Music, color: "hsl(280, 60%, 55%)" },
  design: { label: "Design", icon: Palette, color: "hsl(160, 60%, 50%)" },
  photo: { label: "Photo", icon: Camera, color: "hsl(35, 90%, 55%)" },
  video: { label: "Video", icon: Video, color: "hsl(340, 70%, 55%)" },
  writing: { label: "Writing", icon: PenTool, color: "hsl(210, 60%, 55%)" },
};

const TYPE_META: Record<string, { label: string; icon: any }> = {
  service: { label: "Service", icon: Briefcase },
  digital_product: { label: "Digital Product", icon: FileText },
  physical_product: { label: "Physical Product", icon: Package },
  project_request: { label: "Project Request", icon: ShoppingBag },
};

const ListingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState("");

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
        </div>

        {/* Right: Info sidebar */}
        <div className="lg:col-span-2 space-y-4">
          <div className="surface-card p-5 space-y-4 sticky top-4">
            {/* Type + Category */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1 text-xs">
                <TypeIcon className="h-3 w-3" />
                {typeMeta.label}
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <CatIcon className="h-3 w-3" style={{ color: catMeta.color }} />
                {catMeta.label}
              </Badge>
            </div>

            {/* Title */}
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              {listing.title}
            </h1>

            {/* Price */}
            {listing.credits_price != null && (
              <div className="flex items-center gap-2 text-2xl font-display font-bold text-foreground">
                <Coins className="h-6 w-6 text-primary" />
                {listing.credits_price} credits
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 text-sm">
              {listing.delivery_days && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{listing.delivery_days} day delivery</span>
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

            {/* CTA */}
            {!isOwner && (
              <div className="space-y-2 pt-2">
                <Button className="w-full rounded-full" onClick={() => setInquiryOpen(true)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send Inquiry
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => navigate(`/messages?to=${listing.user_id}&listing=${encodeURIComponent(listing.title)}`)}
                >
                  Direct Message
                </Button>
              </div>
            )}

            {/* Seller info */}
            {sellerProfile && (
              <div className="border-t border-border pt-4">
                <Link
                  to={`/profiles/${sellerProfile.user_id}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {(sellerProfile.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {sellerProfile.display_name}
                    </p>
                    {sellerProfile.headline && (
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
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

      {/* Inquiry dialog */}
      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Inquiry</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); if (inquiryMsg.trim()) sendInquiry.mutate(); }}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground">
              Interested in <strong className="text-foreground">{listing.title}</strong>? Send a message to the seller.
            </p>
            <Textarea
              placeholder="Hi! I'm interested in..."
              value={inquiryMsg}
              onChange={(e) => setInquiryMsg(e.target.value)}
              rows={4}
              required
            />
            <Button type="submit" className="w-full rounded-full" disabled={!inquiryMsg.trim() || sendInquiry.isPending}>
              Send Inquiry
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListingDetailPage;
