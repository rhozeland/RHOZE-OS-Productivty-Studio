import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Inbox,
  FolderKanban,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-500/15 text-green-600", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-500", icon: XCircle },
};

const InquiriesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [convertDialog, setConvertDialog] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState("");

  // All inquiries (merged view)
  const { data: inquiries, isLoading } = useQuery({
    queryKey: ["inquiries-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const allListingIds = [...new Set(inquiries?.map((i) => i.listing_id) ?? [])];
  const { data: listings } = useQuery({
    queryKey: ["inquiry-listings", allListingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, credits_price, listing_type, category")
        .in("id", allListingIds);
      if (error) throw error;
      return data;
    },
    enabled: allListingIds.length > 0,
  });

  const allUserIds = [...new Set([
    ...(inquiries?.map((i) => i.sender_id) ?? []),
    ...(inquiries?.map((i) => i.receiver_id) ?? []),
  ].filter(id => id !== user?.id))];

  const { data: userProfiles } = useQuery({
    queryKey: ["inquiry-profiles", allUserIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: allUserIds });
      if (error) throw error;
      return data;
    },
    enabled: allUserIds.length > 0,
  });

  const listingsMap = new Map(listings?.map((l) => [l.id, l]) ?? []);
  const profilesMap = new Map(userProfiles?.map((p: any) => [p.user_id, p.display_name]) ?? []);

  const declineMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase
        .from("listing_inquiries")
        .update({ status: "declined" })
        .eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
      toast.success("Inquiry declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ inquiryId, credits }: { inquiryId: string; credits: number }) => {
      const { data, error } = await supabase.rpc("convert_inquiry_to_project" as any, {
        _inquiry_id: inquiryId,
        _receiver_id: user!.id,
        _total_credits: credits,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setConvertDialog(null);
      toast.success("Project created! Redirecting...");
      const projectId = typeof data === "object" ? data.project_id : null;
      if (projectId) navigate(`/projects/${projectId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderInquiry = (inquiry: any) => {
    const listing = listingsMap.get(inquiry.listing_id);
    const statusMeta = STATUS_META[inquiry.status] ?? STATUS_META.pending;
    const StatusIcon = statusMeta.icon;
    const isSender = inquiry.sender_id === user?.id;
    const otherUserId = isSender ? inquiry.receiver_id : inquiry.sender_id;
    const otherName = profilesMap.get(otherUserId) ?? (isSender ? "Seller" : "Someone");

    return (
      <div key={inquiry.id} className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${statusMeta.color} border-0 gap-1 text-xs`}>
                <StatusIcon className="h-3 w-3" />
                {statusMeta.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {isSender ? "Sent" : "Received"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(inquiry.created_at), "MMM d, yyyy")}
              </span>
            </div>
            <Link
              to={`/marketplace/${inquiry.listing_id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors text-sm"
            >
              {listing?.title ?? "Listing"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSender ? `To: ${otherName}` : `From: ${otherName}`}
            </p>
          </div>

          {inquiry.status === "accepted" && inquiry.project_id && (
            <Link to={`/projects/${inquiry.project_id}`}>
              <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs">
                <FolderKanban className="h-3 w-3" />
                View Project
              </Button>
            </Link>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{inquiry.message}</p>
        </div>

        {!isSender && inquiry.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => {
                setConvertDialog(inquiry);
                setTotalCredits(listing?.credits_price?.toString() ?? "");
              }}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Convert to Project
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 rounded-full text-muted-foreground"
              onClick={() => declineMutation.mutate(inquiry.id)}
              disabled={declineMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5" />
              Decline
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full ml-auto"
              onClick={() => navigate(`/messages?to=${inquiry.sender_id}`)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Inquiries</h1>
        <p className="text-muted-foreground">Manage marketplace inquiries and convert to projects</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !inquiries?.length ? (
        <div className="text-center py-16 space-y-3">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No inquiries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((i) => renderInquiry(i))}
        </div>
      )}

      {/* Convert to Project Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={(open) => !open && setConvertDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Convert to Project</DialogTitle>
          </DialogHeader>
          {convertDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create a project with the client as a collaborator, plus a contract with an initial milestone.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Total Credits for Contract</label>
                <Input
                  type="number"
                  min="0"
                  value={totalCredits}
                  onChange={(e) => setTotalCredits(e.target.value)}
                  placeholder="e.g. 5"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The client will need to escrow this amount before work begins.
                </p>
              </div>
              <Button
                className="w-full rounded-full gap-2"
                onClick={() =>
                  convertMutation.mutate({
                    inquiryId: convertDialog.id,
                    credits: parseFloat(totalCredits) || 0,
                  })
                }
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                ) : (
                  <><FolderKanban className="h-4 w-4" />Create Project<ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InquiriesPage;
