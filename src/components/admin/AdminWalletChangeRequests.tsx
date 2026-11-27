/**
 * AdminWalletChangeRequests — admin tab for reviewing wallet replacement
 * requests. Users file them through verify-wallet-ownership once the new
 * wallet has signed a challenge. Decisions go through the
 * process_wallet_change RPC, which re-checks that proof and swaps
 * profiles.wallet_address; the table itself has no UPDATE policy.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { describeWalletChangeError } from "@/lib/wallet-change-errors";
import { CheckCircle, Eye, Loader2, XCircle } from "lucide-react";

type Row = Pick<
  Tables<"wallet_change_requests">,
  | "id"
  | "user_id"
  | "current_wallet"
  | "requested_wallet"
  | "reason"
  | "status"
  | "admin_note"
  | "verification_id"
  | "processed_at"
  | "created_at"
> & { user_name?: string };

const FILTERS = ["pending", "all", "approved", "rejected"] as const;

const short = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

const AdminWalletChangeRequests = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("pending");
  const [selected, setSelected] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("wallet_change_requests")
      .select(
        "id, user_id, current_wallet, requested_wallet, reason, status, admin_note, verification_id, processed_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list: Row[] = data ?? [];
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ids);
      const names = new Map(
        (profs ?? []).map((p) => [p.user_id, p.display_name || p.username || "Anon"]),
      );
      list.forEach((r) => (r.user_name = names.get(r.user_id) ?? "Anon"));
    }
    setRows(list);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const open = (r: Row) => {
    setSelected(r);
    setNote(r.admin_note ?? "");
  };

  const decide = async (approve: boolean) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("process_wallet_change", {
      _request_id: selected.id,
      _approve: approve,
      _note: note.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      toast.error(describeWalletChangeError(error));
      load();
      return;
    }
    toast.success(approve ? "Wallet change approved" : "Wallet change rejected");
    setSelected(null);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet change requests</CardTitle>
        <CardDescription>
          Approve or reject requests to replace a user's linked wallet. The new wallet has already
          signed to prove ownership; the change applies only once approved.
        </CardDescription>
        <div className="flex gap-2 pt-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No requests.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Current wallet</TableHead>
                <TableHead>Requested wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.user_name}</TableCell>
                  <TableCell className="font-mono text-xs">{short(r.current_wallet)}</TableCell>
                  <TableCell className="font-mono text-xs">{short(r.requested_wallet)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => open(r)} aria-label={`Review request from ${r.user_name}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(isOpen) => { if (!isOpen) setSelected(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Wallet change for {selected?.user_name}</DialogTitle>
            <DialogDescription>
              Filed {selected ? new Date(selected.created_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current wallet</p>
                <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">{selected.current_wallet}</code>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Requested wallet</p>
                <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">{selected.requested_wallet}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.verification_id
                  ? "The requested wallet signed an ownership challenge for this change."
                  : "No ownership proof is on file for the requested wallet, so this request can't be approved."}
              </p>
              {selected.reason && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm">{selected.reason}</p>
                </div>
              )}
              {selected.status === "pending" ? (
                <>
                  <Textarea
                    placeholder="Optional note (kept with the request)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => decide(true)}
                      disabled={busy || !selected.verification_id}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button onClick={() => decide(false)} disabled={busy} variant="destructive" className="flex-1">
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {selected.status === "approved" ? "Approved" : "Rejected"}
                    {selected.processed_at ? ` ${new Date(selected.processed_at).toLocaleString()}` : ""}
                  </p>
                  {selected.admin_note && <p className="text-sm">{selected.admin_note}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminWalletChangeRequests;
