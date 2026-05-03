import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Sparkles,
  Clock,
  MessageCircle,
  Briefcase,
  Search,
  Users,
  Play,
  Star,
  DollarSign,
  Theater,
} from "lucide-react";
import { motion } from "framer-motion";
import AudioPreview from "./AudioPreview";
import StarRating from "./StarRating";


const CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  audio: { label: "Audio", icon: Music, color: "hsl(280, 60%, 55%)" },
  music: { label: "Music", icon: Music, color: "hsl(280, 60%, 55%)" },
  design: { label: "Design", icon: Palette, color: "hsl(160, 60%, 50%)" },
  photo: { label: "Photo", icon: Camera, color: "hsl(35, 90%, 55%)" },
  video: { label: "Video", icon: Video, color: "hsl(340, 70%, 55%)" },
  writing: { label: "Writing", icon: PenTool, color: "hsl(210, 60%, 55%)" },
  talent: { label: "Talent", icon: Theater, color: "hsl(50, 80%, 50%)" },
};

const TYPE_META: Record<string, { label: string; icon: any }> = {
  service: { label: "Offering", icon: Briefcase },
  project_request: { label: "Looking For", icon: Search },
  collaboration: { label: "Collab", icon: Users },
  digital_product: { label: "Offering", icon: Briefcase },
  physical_product: { label: "Offering", icon: Briefcase },
};

interface ListingCardProps {
  listing: any;
  media?: any[];
  reviewStats?: { avg: number; count: number } | null;
  index: number;
  isOwner: boolean;
  onInquire: () => void;
  onClick: () => void;
  onDelete?: () => void;
}

const ListingCard = ({
  listing,
  media,
  reviewStats,
  
  index,
  isOwner,
  onInquire,
  onClick,
  onDelete,
}: ListingCardProps) => {
  const catMeta = CATEGORIES[listing.category] || { label: listing.category, icon: Sparkles, color: "hsl(var(--primary))" };
  const CatIcon = catMeta.icon;
  const typeMeta = TYPE_META[listing.listing_type] || TYPE_META.service;
  const TypeIcon = typeMeta.icon;

  const isRequest = listing.listing_type === "project_request";

  const coverImage = listing.cover_url || media?.find((m: any) => m.file_type?.startsWith("image"))?.file_url;
  const audioFile = media?.find((m: any) => m.file_type?.startsWith("audio"));
  const videoFile = media?.find((m: any) => m.file_type?.startsWith("video"));
  // If there's an audio/video preview, skip the empty placeholder cover —
  // the inline player already gives the card a visual anchor and avoids
  // the wall of whitespace the editorial placeholder was creating.
  const hasInlinePreview = !!audioFile || !!videoFile;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-xl bg-card border border-border shadow-sm hover:shadow-lg transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Cover */}
      {coverImage ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {videoFile && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/10">
              <div className="h-12 w-12 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Play className="h-5 w-5 text-foreground ml-0.5" />
              </div>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge
              variant="secondary"
              className={`bg-card/80 backdrop-blur-sm text-xs gap-1 ${isRequest ? "border-amber-500/30" : ""}`}
            >
              <TypeIcon className="h-3 w-3" />
              {typeMeta.label}
            </Badge>
          </div>
        </div>
      ) : hasInlinePreview ? (
        // Compact header strip when audio/video preview will render below.
        // Keeps the type badge + category accent without the giant blank canvas.
        <div
          className="relative flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60"
          style={{
            background: `linear-gradient(90deg, ${catMeta.color}14 0%, transparent 70%)`,
          }}
        >
          <Badge
            variant="secondary"
            className={`bg-card/80 backdrop-blur-sm text-xs gap-1 ${isRequest ? "border-amber-500/30" : ""}`}
          >
            <TypeIcon className="h-3 w-3" />
            {typeMeta.label}
          </Badge>
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: catMeta.color }}
          >
            {catMeta.label}
          </span>
        </div>
      ) : (
        // Text-led editorial cover — shorter aspect to cut whitespace.
        <div
          className="relative aspect-[16/6] flex flex-col justify-between p-4 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${catMeta.color}1f 0%, ${catMeta.color}0a 60%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <Badge
              variant="secondary"
              className={`bg-card/80 backdrop-blur-sm text-xs gap-1 ${isRequest ? "border-amber-500/30" : ""}`}
            >
              <TypeIcon className="h-3 w-3" />
              {typeMeta.label}
            </Badge>
            <span
              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: catMeta.color }}
            >
              {catMeta.label}
            </span>
          </div>

          {/* Signature color band as visual anchor */}
          <div
            className="h-1 w-12 rounded-full"
            style={{ background: catMeta.color }}
          />

          <CatIcon
            aria-hidden
            strokeWidth={0.6}
            className="absolute -right-3 -bottom-3 h-16 w-16 pointer-events-none"
            style={{ color: catMeta.color, opacity: 0.08 }}
          />
        </div>
      )}

      {/* Audio preview */}
      {audioFile && (
        <div className="border-t border-border" onClick={(e) => e.stopPropagation()}>
          <AudioPreview src={audioFile.file_url} title={audioFile.file_name} compact />
        </div>
      )}

      <div className="p-4 space-y-2.5">
        {/* Category + Budget */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="outline" className="text-[10px] gap-1 rounded-full">
              <CatIcon className="h-3 w-3" style={{ color: catMeta.color }} />
              {catMeta.label}
            </Badge>
          </div>
          {listing.contact_info && (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
              <DollarSign className="h-3 w-3" />
              {listing.contact_info}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-foreground leading-snug line-clamp-2 text-sm">
          {listing.title}
        </h3>

        {/* Description */}
        {listing.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>
        )}

        {/* Tags */}
        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {listing.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {reviewStats && (
              <span className="flex items-center gap-1">
                <StarRating rating={reviewStats.avg} size="sm" />
                <span className="font-medium text-foreground">{reviewStats.avg}</span>
                <span>({reviewStats.count})</span>
              </span>
            )}
            {listing.delivery_days && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {listing.delivery_days}d
              </span>
            )}
          </div>
          {!isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 rounded-full"
              onClick={(e) => { e.stopPropagation(); onInquire(); }}
            >
              <MessageCircle className="h-3 w-3" />
              {isRequest ? "Apply" : "Inquire"}
            </Button>
          )}
        </div>
      </div>

      {/* Delete for owner */}
      {isOwner && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
        >
          <span className="text-xs">✕</span>
        </button>
      )}
    </motion.div>
  );
};

export default ListingCard;
