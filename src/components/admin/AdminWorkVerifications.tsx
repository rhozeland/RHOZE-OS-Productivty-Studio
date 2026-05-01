/**
 * AdminWorkVerifications — admin tab for reviewing IP verification requests.
 *
 * Approve → calls `approve-work-verification` edge function which anchors on
 * Solana then marks the request approved (and writes signature onto the Work
 * + linked Flow items). Reject / request changes → direct RPC call.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { shortHash } from "@/lib/content-hash";

type WorkRow = {
  id: string; title: string; content_hash: string; kind: string;
  file_url: string | null; mime_type: string | null; user_id: string;
};

type RequestRow = {
  id: string; work_id: string; applicant_id: string; status: string;
  applicant_note: string | null; supporting_urls: string[];
  reviewer_id: string | null; review_note: string | null;
  decided_at: string | null; created_at: string;
  applicant_name?: string;
  work?: WorkRow;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  changes_requested: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "secondary",
};

const FILTERS = ["pending", "all", "approved", "rejected"] as const;

const AdminWorkVerifications = () => {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("pending");
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    let q = supabase
      .from("work_verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter === "pending") q = q.in("status", ["pending", "changes_requested"]);
    else if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data || []) as RequestRow[];
    const workIds = [...new Set(rows.map((r) => r.work_id))];
    const userIds = [...new Set(rows.map((r) => r.applicant_id))];

    const [worksRes, profilesRes] = await Promise.all([
      workIds.length
        ? supabase.from("works").select("id,title,content_hash,kind,file_url,mime_type,user_id").in("id", workIds)
        : Promise.resolve({ data: [] as WorkRow[] }),
      userIds.length
        ? supabase.from("profiles").select("user_id, display_name, username").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; username: string | null }[] }),
    ]);

    const workMap = new Map((worksRes.data || []).map((w) => [w.id, w as WorkRow]));
    const nameMap = new Map(
      (profilesRes.data || []).map((p) => [p.user_id, p.display_name || p.username || "Unknown"]),
    );

    setRequests(rows.map((r) => ({
      ...r,
      work: workMap.get(r.work_id),
      applicant_name: nameMap.get(r.applicant_id) || "Unknown",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("approve-work-verification", {
        body: { request_id: selected.id, review_note: reviewNote.trim() || null },
      });
      if (error || (data && (data as any).error)) {
        throw new Error(error?.message || (data as any).error);
      }
      toast({
        title: "Approved & anchored",
        description: `Anchored on Solana${(data as any)?.signature ? ` (${shortHash((data as any).signature, 6, 6)})` : ""}.`,
      });
      setSelected(null); setReviewNote("");
      fetchRequests();
    } catch (err) {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (changesRequested: boolean) => {
    if (!selected) return;
    if (!reviewNote.trim()) {
      toast({ title: "Note required", description: "Add a note explaining the decision.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const { error } = await supabase.rpc("reject_work_verification", {
      _request_id: selected.id,
      _review_note: reviewNote.trim(),
      _changes_requested: changesRequested,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: changesRequested ? "Changes requested" : "Request rejected" });
      setSelected(null); setReviewNote("");
      fetchRequests();
    }
    setProcessing(false);
  };

  const isOpen = selected && ["pending", "changes_requested"].includes(selected.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          IP Verifications
        </CardTitle>
        <CardDescription>
          Review creator submissions. Approve to anchor on Solana and grant the Verified IP badge.
        </CardDescription>
        <div className="flex gap-2 pt-2">
          {FILTERS.map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)} className="capitalize">
              {f === "pending" ? "Open" : f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No requests in this view.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium max-w-[240px] truncate">
                    {r.work?.title ?? "—"}
                  </TableCell>
                  <TableCell>{r.applicant_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.work?.content_hash ? shortHash(r.work.content_hash) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] || "outline"}>{r.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setSelected(r); setReviewNote(r.review_note || ""); }}>
                      <Eye className="h-4 w-4 mr-1" /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected?.work?.title ?? "Verification request"}</DialogTitle>
              <DialogDescription>Submitted by {selected?.applicant_name}</DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                {selected.work?.file_url && (
                  <div className="rounded-md overflow-hidden border bg-muted/30 max-h-64 flex items-center justify-center">
                    {selected.work.kind === "image" ? (
                      <img src={selected.work.file_url} alt={selected.work.title} className="max-h-64 object-contain" />
                    ) : selected.work.kind === "video" ? (
                      <video src={selected.work.file_url} controls className="max-h-64" />
                    ) : selected.work.kind === "audio" ? (
                      <audio src={selected.work.file_url} controls className="w-full" />
                    ) : (
                      <a href={selected.work.file_url} target="_blank" rel="noreferrer"
                        className="text-sm text-primary inline-flex items-center gap-1 p-4">
                        Open file <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">SHA-256</span>
                    <p className="font-mono text-xs break-all">{selected.work?.content_hash}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Kind</span>
                    <p>{selected.work?.kind}</p>
                  </div>
                </div>

                {selected.applicant_note && (
                  <div>
                    <span className="text-xs text-muted-foreground">Applicant note</span>
                    <p className="text-sm bg-muted/40 rounded-md p-3 mt-1 whitespace-pre-wrap">{selected.applicant_note}</p>
                  </div>
                )}

                {selected.supporting_urls?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Supporting links</span>
                    <ul className="space-y-1 mt-1">
                      {selected.supporting_urls.map((u) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                            {u} <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isOpen ? (
                  <>
                    <div>
                      <span className="text-xs text-muted-foreground">Reviewer note</span>
                      <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Required when rejecting / requesting changes" className="mt-1" />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="destructive" onClick={() => handleReject(false)} disabled={processing}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button variant="outline" onClick={() => handleReject(true)} disabled={processing}>
                        Request changes
                      </Button>
                      <Button onClick={handleApprove} disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                        Approve & anchor
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p>Status: <strong>{selected.status}</strong></p>
                    {selected.review_note && (
                      <p className="mt-2 bg-muted/40 rounded-md p-3 whitespace-pre-wrap">{selected.review_note}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminWorkVerifications;
