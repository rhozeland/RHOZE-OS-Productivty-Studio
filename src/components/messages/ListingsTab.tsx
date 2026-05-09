/**
 * ListingsTab — your marketplace listings + their inquiries grouped together.
 *
 * Previously the listings just showed metadata and inquiries lived in a
 * separate tab, which made the user flow feel disconnected. Now each listing
 * card expands to show the inquiries it generated, with inline accept/decline
 * and message actions. Declined inquiries collapse under a "Show declined"
 * toggle so the active queue stays clean.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Plus, Store, ArrowRight, Loader2, ChevronDown, ChevronUp,
  Inbox, CheckCircle, XCircle, Clock, MessageSquare, FolderKanban,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  accepted: { label: "Accepted", color: "bg-green-500/15 text-green-600", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-500", icon: XCircle },
};

const ListingsTab = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showDeclined, setShowDeclined] = useState<Record<string, boolean>>({});
  const [convertDialog, setConvertDialog] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState("");

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

  const listingIds = useMemo(() => (listings ?? []).map((l: any) => l.id), [listings]);

  // All inquiries received on the user's listings.
  const { data: inquiries } = useQuery({
    queryKey: ["listing-inquiries", userId, listingIds],
    enabled: listingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_inquiries")
        .select("*")
        .eq("receiver_id", userId)
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const senderIds = useMemo(
    () => [...new Set((inquiries ?? []).map((i: any) => i.sender_id))],
    [inquiries],
  );

  const { data: senderProfiles } = useQuery({
    queryKey: ["listing-inquiry-senders", senderIds],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_ids", { _ids: senderIds });
      if (error) throw error;
      return data ?? [];
    },
  });

  const senderMap = new Map(
    (senderProfiles ?? []).map((p: any) => [p.user_id, p.display_name]),
  );

  // Group inquiries by listing for fast lookup.
  const inquiriesByListing = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const inq of inquiries ?? []) {
      const list = map.get(inq.listing_id) ?? [];
      list.push(inq);
      map.set(inq.listing_id, list);
    }
    return map;
  }, [inquiries]);

  const declineMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const { error } = await supabase
        .from("listing_inquiries")
        .update({ status: "declined" })
        .eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing-inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
      toast.success("Inquiry declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ inquiryId, credits }: { inquiryId: string; credits: number }) => {
      const { data, error } = await supabase.rpc("convert_inquiry_to_project" as any, {
        _inquiry_id: inquiryId,
        _receiver_id: userId,
        _total_credits: credits,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["listing-inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["inquiries-all"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setConvertDialog(null);
      toast.success("Project created!");
      const projectId = typeof data === "object" ? data.project_id : null;
      if (projectId) navigate(`/projects/${projectId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderInquiryRow = (inq: any) => {
    const meta = STATUS_META[inq.status] ?? STATUS_META.pending;
    const StatusIcon = meta.icon;
    const senderName = senderMap.get(inq.sender_id) ?? "Someone";

    return (
      <div key={inq.id} className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${meta.color} border-0 gap-1 text-[10px]`}>
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="text-xs font-medium text-foreground">From: {senderName}</span>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(inq.created_at), "MMM d, yyyy")}
          </span>
        </div>

        {inq.message && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {inq.message}
          </p>
        )}

        {inq.status === "pending" && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button
              size="sm"
              className="h-7 px-2.5 rounded-full text-xs gap-1"
              onClick={() => {
                setConvertDialog({ ...inq, listingId: inq.listing_id });
                const listing = (listings ?? []).find((l: any) => l.id === inq.listing_id);
                setTotalCredits(listing?.credits_price?.toString() ?? "");
              }}
            >
              <FolderKanban className="h-3 w-3" /> Convert
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 rounded-full text-xs gap-1"
              onClick={() => navigate(`/messages?to=${inq.sender_id}`)}
            >
              <MessageSquare className="h-3 w-3" /> Message
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 rounded-full text-xs gap-1 text-muted-foreground"
              onClick={() => declineMutation.mutate(inq.id)}
              disabled={declineMutation.isPending}
            >
              <XCircle className="h-3 w-3" /> Decline
            </Button>
          </div>
        )}

        {inq.status === "accepted" && inq.project_id && (
          <Link to={`/projects/${inq.project_id}`}>
            <Button variant="outline" size="sm" className="h-7 px-2.5 rounded-full text-xs gap-1">
              <FolderKanban className="h-3 w-3" /> View project
            </Button>
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Your offerings + the inquiries they generate, all in one place.
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
        <EmptyState
          icon={Store}
          title="No listings yet"
          description="Post a service, an open call, or a fixed-price offering. Inquiries land in your inbox."
          cta={{ label: "Post your first listing", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {listings.map((l: any) => {
            const allInq = inquiriesByListing.get(l.id) ?? [];
            const pending = allInq.filter((i: any) => i.status === "pending");
            const accepted = allInq.filter((i: any) => i.status === "accepted");
            const declined = allInq.filter((i: any) => i.status === "declined");
            const isOpen = expanded[l.id] ?? pending.length > 0;
            const showDecl = showDeclined[l.id] ?? false;
            const visible = showDecl ? allInq : [...pending, ...accepted];

            return (
              <div key={l.id} className="surface-card overflow-hidden">
                {/* Listing summary row */}
                <div className="p-4 flex items-center justify-between gap-3">
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
                    {allInq.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => ({ ...s, [l.id]: !isOpen }))}
                        className={cn(
                          "inline-flex items-center gap-1 h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                          pending.length > 0
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        <Inbox className="h-3.5 w-3.5" />
                        {pending.length > 0 ? `${pending.length} new` : `${allInq.length}`}
                        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                    <Link to={`/marketplace/${l.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Open listing">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Inquiries inline */}
                {isOpen && allInq.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                    {visible.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No active inquiries.</p>
                    ) : (
                      visible.map(renderInquiryRow)
                    )}
                    {declined.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDeclined((s) => ({ ...s, [l.id]: !showDecl }))}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {showDecl ? "Hide" : "Show"} {declined.length} declined
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Convert to Project Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={(open) => !open && setConvertDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Convert to Project</DialogTitle>
          </DialogHeader>
          {convertDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Creates a project with the client as a collaborator and an
                initial milestone seeded with the contract amount.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Total $RHOZE for contract</label>
                <Input
                  type="number"
                  min="0"
                  value={totalCredits}
                  onChange={(e) => setTotalCredits(e.target.value)}
                  placeholder="e.g. 50"
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
                  <><FolderKanban className="h-4 w-4" />Create project<ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListingsTab;
