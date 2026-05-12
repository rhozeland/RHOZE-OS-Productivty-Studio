/**
 * InquiryThreadBanner — context strip rendered above a DM thread when the
 * conversation was opened from a listing inquiry (`?inquiry=<id>`).
 *
 * Shows the listing title + inquiry status, plus quick links to the listing
 * detail page and (when the inquiry has been converted) the related project.
 * This is what makes each inquiry feel like its own dedicated thread:
 * the chat is anchored to the inquiry it grew out of.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Store, FolderKanban, ArrowUpRight, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const STATUS = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  accepted: { label: "Accepted", color: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-500", icon: XCircle },
} as const;

interface Props {
  inquiryId: string;
  onDismiss?: () => void;
}

const InquiryThreadBanner = ({ inquiryId, onDismiss }: Props) => {
  const { data } = useQuery({
    queryKey: ["inquiry-thread-context", inquiryId],
    queryFn: async () => {
      const { data: inq } = await supabase
        .from("listing_inquiries")
        .select("id, listing_id, status, project_id")
        .eq("id", inquiryId)
        .maybeSingle();
      if (!inq) return null;
      const { data: listing } = await supabase
        .from("creator_listings")
        .select("id, title")
        .eq("id", inq.listing_id)
        .maybeSingle();
      return { inq, listing };
    },
  });

  if (!data?.inq) return null;
  const { inq, listing } = data;
  const meta = STATUS[(inq.status as keyof typeof STATUS) ?? "pending"] ?? STATUS.pending;
  const StatusIcon = meta.icon;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 md:px-6 py-2.5">
      <Store className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Inquiry thread
      </span>
      {listing && (
        <Link
          to={`/creators/${listing.id}`}
          className="text-sm font-medium text-foreground hover:text-primary truncate max-w-[200px]"
          title={listing.title}
        >
          {listing.title}
        </Link>
      )}
      <Badge className={`${meta.color} border-0 gap-1 text-[10px]`}>
        <StatusIcon className="h-2.5 w-2.5" />
        {meta.label}
      </Badge>
      <div className="ml-auto flex items-center gap-2">
        {inq.project_id && (
          <Link
            to={`/projects/${inq.project_id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            View project
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default InquiryThreadBanner;
