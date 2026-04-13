import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2, AlertTriangle, Search, Loader2, ExternalLink, Image, ShoppingBag, Send,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AdminContentModeration = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "flow" | "listing"; id: string; title: string } | null>(null);
  const [warningTarget, setWarningTarget] = useState<{ userId: string; displayName: string; reason: string } | null>(null);
  const [warningMessage, setWarningMessage] = useState("");

  // Flow items
  const { data: flowItems, isLoading: flowLoading } = useQuery({
    queryKey: ["admin-flow-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_items")
        .select("id, title, description, category, content_type, user_id, created_at, file_url, link_url")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Marketplace listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, description, category, listing_type, user_id, created_at, is_active, price")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Profiles for display names
  const allUserIds = [
    ...new Set([
      ...(flowItems || []).map((i) => i.user_id),
      ...(listings || []).map((l) => l.user_id),
    ]),
  ];
  const { data: profiles } = useQuery({
    queryKey: ["admin-mod-profiles", allUserIds.join(",")],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      const { data } = await supabase.rpc("get_profiles_by_ids", { _ids: allUserIds });
      return data || [];
    },
    enabled: allUserIds.length > 0,
  });

  const getName = (uid: string) => {
    const p = (profiles as any[])?.find((pr: any) => pr.user_id === uid);
    return p?.display_name || uid.slice(0, 8);
  };

  // Delete content
  const deleteContent = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const table = deleteTarget.type === "flow" ? "flow_items" : "marketplace_listings";
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deleteTarget?.type === "flow" ? ["admin-flow-items"] : ["admin-listings"] });
      toast.success(`${deleteTarget?.title} removed`);
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Send warning notification
  const sendWarning = useMutation({
    mutationFn: async () => {
      if (!warningTarget) return;
      const { error } = await supabase.from("notifications").insert({
        user_id: warningTarget.userId,
        title: "⚠️ Content Warning from Rhozeland",
        body: warningMessage || `Your content "${warningTarget.reason}" has been flagged for review. Please ensure your posts follow community guidelines. Repeated violations may result in account suspension.`,
        type: "warning",
        link: "/settings",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Warning sent to ${warningTarget?.displayName}`);
      setWarningTarget(null);
      setWarningMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filterItems = <T extends { title: string; description?: string | null }>(items: T[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-foreground">Content Moderation</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{(flowItems || []).length} flow items</Badge>
          <Badge variant="outline">{(listings || []).length} listings</Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search content by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="flow" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="flow" className="gap-1.5 text-xs">
            <Image className="h-3.5 w-3.5" /> Flow Items
          </TabsTrigger>
          <TabsTrigger value="listings" className="gap-1.5 text-xs">
            <ShoppingBag className="h-3.5 w-3.5" /> Listings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow">
          {flowLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {filterItems(flowItems || []).map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <Badge variant="outline" className="text-[9px] capitalize shrink-0">{item.category}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        by {getName(item.user_id)} · {format(new Date(item.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => {
                          setWarningTarget({
                            userId: item.user_id,
                            displayName: getName(item.user_id),
                            reason: item.title,
                          });
                          setWarningMessage("");
                        }}
                      >
                        <Send className="h-3 w-3" /> Warn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "flow", id: item.id, title: item.title })}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filterItems(flowItems || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No flow items found.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="listings">
          {listingsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {filterItems(listings || []).map((listing) => (
                <Card key={listing.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{listing.title}</p>
                        <Badge variant="outline" className="text-[9px] capitalize shrink-0">{listing.category}</Badge>
                        {!listing.is_active && (
                          <Badge variant="secondary" className="text-[9px]">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        by {getName(listing.user_id)} · {format(new Date(listing.created_at), "MMM d, yyyy")}
                        {listing.price ? ` · $${Number(listing.price).toFixed(2)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => {
                          setWarningTarget({
                            userId: listing.user_id,
                            displayName: getName(listing.user_id),
                            reason: listing.title,
                          });
                          setWarningMessage("");
                        }}
                      >
                        <Send className="h-3 w-3" /> Warn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "listing", id: listing.id, title: listing.title })}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filterItems(listings || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No listings found.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remove Content
            </DialogTitle>
            <DialogDescription>
              Permanently remove "{deleteTarget?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteContent.mutate()} disabled={deleteContent.isPending} className="gap-1.5">
              {deleteContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning dialog */}
      <Dialog open={!!warningTarget} onOpenChange={(o) => !o && setWarningTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Send Warning
            </DialogTitle>
            <DialogDescription>
              Send a warning notification to {warningTarget?.displayName} about "{warningTarget?.reason}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Custom Message (optional)
              </label>
              <Textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Leave blank for default warning message..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningTarget(null)}>Cancel</Button>
            <Button onClick={() => sendWarning.mutate()} disabled={sendWarning.isPending} className="gap-1.5">
              {sendWarning.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContentModeration;
