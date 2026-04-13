import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  processing: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const AdminWithdrawals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processDialog, setProcessDialog] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("approved");
  const [adminNote, setAdminNote] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch profiles for display names
  const userIds = [...new Set((requests ?? []).map((r: any) => r.user_id))];
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-withdrawals", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.rpc("get_profiles_by_ids", { _ids: userIds });
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const processRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("process_withdrawal", {
        _request_id: processDialog.id,
        _admin_id: user!.id,
        _new_status: newStatus,
        _note: adminNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setProcessDialog(null);
      setAdminNote("");
      toast.success("Withdrawal request updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingCount = (requests ?? []).filter((r: any) => r.status === "pending").length;
  const getName = (uid: string) => {
    const p = (profiles as any[])?.find((p: any) => p.user_id === uid);
    return p?.display_name || uid.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-display font-bold text-foreground">Withdrawals</h2>
        {pendingCount > 0 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !requests?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No withdrawal requests yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[r.status])}>
                      {r.status}
                    </Badge>
                    <span className="text-sm font-medium">{getName(r.user_id)}</span>
                  </div>
                  <span className="text-sm font-bold">{Number(r.amount)} credits</span>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="capitalize">{r.payout_method.replace("_", " ")}</span>
                  <span>{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</span>
                </div>

                {r.payout_details && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    {typeof r.payout_details === "object" ? JSON.stringify(r.payout_details) : r.payout_details}
                  </p>
                )}

                {r.admin_note && (
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Note</p>
                    <p className="text-xs text-foreground">{r.admin_note}</p>
                  </div>
                )}

                {["pending", "approved", "processing"].includes(r.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setProcessDialog(r);
                      setNewStatus(r.status === "pending" ? "approved" : r.status === "approved" ? "processing" : "completed");
                      setAdminNote("");
                    }}
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    Process
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!processDialog} onOpenChange={(o) => !o && setProcessDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Process Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed (deducts credits)</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note</label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Optional note..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialog(null)}>Cancel</Button>
            <Button onClick={() => processRequest.mutate()} disabled={processRequest.isPending} className="gap-1.5">
              {processRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawals;
