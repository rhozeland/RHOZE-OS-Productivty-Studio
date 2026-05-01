/**
 * MyVerificationRequests — creator-facing list of their submitted Verified-IP
 * applications. Sits at the top of Settings → Provenance so creators have one
 * place to track admin decisions and notes.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ExternalLink, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { shortHash } from "@/lib/content-hash";

type Row = {
  id: string;
  work_id: string;
  status: string;
  applicant_note: string | null;
  review_note: string | null;
  decided_at: string | null;
  created_at: string;
  work?: { title: string; content_hash: string; solana_signature: string | null };
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  changes_requested: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "secondary",
};

const MyVerificationRequests = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("work_verification_requests")
      .select("*")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load requests", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = [...new Set((data || []).map((r) => r.work_id))];
    const { data: works } = ids.length
      ? await supabase.from("works").select("id, title, content_hash, solana_signature").in("id", ids)
      : { data: [] as { id: string; title: string; content_hash: string; solana_signature: string | null }[] };
    const map = new Map((works || []).map((w) => [w.id, w]));
    setRows(((data || []) as Row[]).map((r) => ({ ...r, work: map.get(r.work_id) })));
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [user?.id]);

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("work_verification_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request cancelled" });
      fetchRows();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          My Verification Requests
        </CardTitle>
        <CardDescription>Track the status of every Verified-IP application you've submitted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.work?.title ?? "Untitled work"}</p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {r.work?.content_hash ? shortHash(r.work.content_hash) : ""}
                </p>
              </div>
              <Badge variant={statusVariant[r.status] || "outline"}>{r.status.replace("_", " ")}</Badge>
            </div>
            {r.applicant_note && (
              <p className="text-xs text-muted-foreground"><span className="font-medium">You:</span> {r.applicant_note}</p>
            )}
            {r.review_note && (
              <p className="text-xs bg-muted/40 rounded p-2"><span className="font-medium">Reviewer:</span> {r.review_note}</p>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.decided_at || r.created_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                {r.status === "approved" && r.work?.solana_signature && (
                  <a href={`https://solscan.io/tx/${r.work.solana_signature}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">
                    Solscan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {["pending", "changes_requested"].includes(r.status) && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => cancel(r.id)}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MyVerificationRequests;
