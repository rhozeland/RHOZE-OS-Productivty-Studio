import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Inbox,
  Send,
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

  // Received inquiries (I'm the seller)
  const { data: received, isLoading: loadingReceived } = useQuery({
    queryKey: ["inquiries-received", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .eq("receiver_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Sent inquiries (I'm the buyer)
  const { data: sent, isLoading: loadingSent } = useQuery({
    queryKey: ["inquiries-sent", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .eq("sender_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get listing titles for all inquiries
  const allListingIds = [
    ...(received?.map((i) => i.listing_id) ?? []),
    ...(sent?.map((i) => i.listing_id) ?? []),
  ];
  const uniqueListingIds = [...new Set(allListingIds)];

  const { data: listings } = useQuery({
    queryKey: ["inquiry-listings", uniqueListingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, credits_price, listing_type, category")
        .in("id", uniqueListingIds);
      if (error) throw error;
      return data;
    },
    enabled: uniqueListingIds.length > 0,
  });

  // Get profile names for senders
  const senderIds = [...new Set(received?.map((i) => i.sender_id) ?? [])];
  const { data: senderProfiles } = useQuery({
    queryKey: ["inquiry-senders", senderIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", senderIds);
      if (error) throw error;
      return data;
    },
    enabled: senderIds.length > 0,
  });

  const listingsMap = new Map(listings?.map((l) => [l.id, l]) ?? []);
  const sendersMap = new Map(senderProfiles?.map((p) => [p.user_id, p.display_name]) ?? []);

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase
        .from("listing_inquiries")
        .update({ status: "declined" })
        .eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inquiries-received"] });
      toast.success("Inquiry declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Convert to project mutation
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
      queryClient.invalidateQueries({ queryKey: ["inquiries-received"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setConvertDialog(null);
      toast.success("Project created! Redirecting...");
      const projectId = typeof data === "object" ? data.project_id : null;
      if (projectId) {
        navigate(`/projects/${projectId}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderInquiry = (inquiry: any, type: "received" | "sent") => {
    const listing = listingsMap.get(inquiry.listing_id);
    const statusMeta = STATUS_META[inquiry.status] ?? STATUS_META.pending;
    const StatusIcon = statusMeta.icon;
    const senderName = type === "received" ? sendersMap.get(inquiry.sender_id) ?? "Someone" : "You";

    return (
      <div key={inquiry.id} className="surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${statusMeta.color} border-0 gap-1 text-xs`}>
                <StatusIcon className="h-3 w-3" />
                {statusMeta.label}
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
              {type === "received" ? `From: ${senderName}` : `Sent to seller`}
            </p>
          </div>

          {/* Project link if accepted */}
          {inquiry.status === "accepted" && inquiry.project_id && (
            <Link to={`/projects/${inquiry.project_id}`}>
              <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs">
                <FolderKanban className="h-3 w-3" />
                View Project
              </Button>
            </Link>
          )}
        </div>

        {/* Message */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">{inquiry.message}</p>
        </div>

        {/* Actions for received pending inquiries */}
        {type === "received" && inquiry.status === "pending" && (
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

  const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <div className="text-center py-16 space-y-3">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Inquiries</h1>
        <p className="text-muted-foreground">Manage marketplace inquiries and convert to projects</p>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Received
            {received && received.filter((i) => i.status === "pending").length > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {received.filter((i) => i.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3 mt-4">
          {loadingReceived ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !received?.length ? (
            <EmptyState icon={Inbox} text="No inquiries received yet" />
          ) : (
            received.map((i) => renderInquiry(i, "received"))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3 mt-4">
          {loadingSent ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !sent?.length ? (
            <EmptyState icon={Send} text="You haven't sent any inquiries yet" />
          ) : (
            sent.map((i) => renderInquiry(i, "sent"))
          )}
        </TabsContent>
      </Tabs>

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
