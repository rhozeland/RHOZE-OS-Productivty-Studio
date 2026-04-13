import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  resolved: "bg-green-500/10 text-green-600 border-green-500/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const AdminDisputes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("resolved");
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resolveDispute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_disputes")
        .update({
          status: newStatus,
          resolution_note: resolutionNote.trim() || null,
          resolved_by: user!.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", resolveDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      setResolveDialog(null);
      setResolutionNote("");
      toast.success("Dispute updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCount = disputes?.filter((d) => d.status === "open").length ?? 0;
  const reviewCount = disputes?.filter((d) => d.status === "under_review").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-display font-bold text-foreground">Disputes</h2>
        {openCount > 0 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">{openCount} open</Badge>
        )}
        {reviewCount > 0 && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">{reviewCount} under review</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !disputes?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No disputes filed yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[d.status])}>
                    {d.status === "under_review" ? "Under Review" : d.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{d.dispute_type}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(new Date(d.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>

                <p className="text-sm text-foreground">{d.reason}</p>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Project: {d.project_id.slice(0, 8)}</span>
                  {d.milestone_id && <span>• Milestone: {d.milestone_id.slice(0, 8)}</span>}
                </div>

                {d.resolution_note && (
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resolution</p>
                    <p className="text-xs text-foreground">{d.resolution_note}</p>
                  </div>
                )}

                {(d.status === "open" || d.status === "under_review") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setResolveDialog(d);
                      setNewStatus(d.status === "open" ? "under_review" : "resolved");
                      setResolutionNote("");
                    }}
                  >
                    <Eye className="h-3 w-3" />
                    {d.status === "open" ? "Review" : "Resolve"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resolveDialog} onOpenChange={(o) => !o && setResolveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Resolve Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolution Note</label>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Explain the resolution..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
            <Button onClick={() => resolveDispute.mutate()} disabled={resolveDispute.isPending} className="gap-1.5">
              {resolveDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDisputes;
