/**
 * AdminArtistVerifications — admin tab for reviewing Verified Artist requests.
 * Approve/reject flips `artist_verification_requests.status`; the DB trigger
 * then updates `profiles.verification_status` and notifies the user.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, ExternalLink, Eye, Loader2, XCircle } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  video_url: string;
  social_links: string[] | null;
  contact_email: string;
  bio: string | null;
  wallet_address: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  decided_at: string | null;
  created_at: string;
  applicant_name?: string;
};

const FILTERS = ["pending", "all", "approved", "rejected"] as const;

const AdminArtistVerifications = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("pending");
  const [selected, setSelected] = useState<Row | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("artist_verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data || []) as Row[];
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || p.username || "Anon"]));
      list.forEach((r) => (r.applicant_name = map.get(r.user_id) ?? "Anon"));
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const openVideo = async (r: Row) => {
    setSelected(r);
    setNote(r.review_note ?? "");
    const { data } = await supabase.storage
      .from("artist-verification")
      .createSignedUrl(r.video_url, 600);
    setVideoUrl(data?.signedUrl ?? null);
  };

  const decide = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from("artist_verification_requests")
      .update({ status, review_note: note || null })
      .eq("id", selected.id);
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Verified" : "Rejected" });
    setSelected(null);
    setVideoUrl(null);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artist verification queue</CardTitle>
        <CardDescription>Approve or reject Verified Artist submissions.</CardDescription>
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
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.applicant_name}</TableCell>
                  <TableCell className="text-xs">{r.contact_email}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.wallet_address ? `${r.wallet_address.slice(0, 6)}…${r.wallet_address.slice(-4)}` : "—"}
                  </TableCell>
                  <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openVideo(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setVideoUrl(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.applicant_name}</DialogTitle>
            <DialogDescription>{selected?.contact_email}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full rounded-md" />
              ) : (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading video…
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Bio</p>
                <p className="text-sm">{selected.bio}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Socials</p>
                <ul className="space-y-1 text-sm">
                  {(selected.social_links ?? []).map((s, i) => (
                    <li key={i}>
                      <a href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {s} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <Textarea
                placeholder="Optional review note (sent to applicant on rejection)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {selected.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={() => decide("approved")} disabled={busy} className="flex-1">
                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button onClick={() => decide("rejected")} disabled={busy} variant="destructive" className="flex-1">
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminArtistVerifications;
