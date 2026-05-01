/**
 * VerifyWorkDialog — creator-facing flow to apply for the Verified IP badge.
 *
 * Two paths:
 *   1. Item is already linked to a Work (modern uploads)
 *      → straight to the application form.
 *   2. Item is a legacy Flow upload with no Work yet
 *      → we re-hash the stored file via `rehash-stored-file`, create a Work,
 *        then submit the request. All in one click for the user.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { inferWorkKind } from "@/lib/content-hash";

interface FlowItemLike {
  id: string;
  user_id?: string;
  title: string;
  description?: string | null;
  file_url?: string | null;
  content_hash?: string | null;
  work_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowItem: FlowItemLike;
  onSubmitted?: () => void;
}

const VerifyWorkDialog = ({ open, onOpenChange, flowItem, onSubmitted }: Props) => {
  const [note, setNote] = useState("");
  const [supportingUrl, setSupportingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!flowItem.user_id) {
      toast({ title: "Cannot verify", description: "Missing owner reference.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let workId = flowItem.work_id ?? null;

      // Path 2: backfill — no Work yet. Rehash + create Work, then link.
      if (!workId) {
        if (!flowItem.file_url) {
          throw new Error("This item has no file to fingerprint. Add a file first.");
        }

        let hash = flowItem.content_hash ?? null;
        let size: number | null = null;
        let mime: string | null = null;

        // If we already have a hash, skip the rehash hop.
        if (!hash) {
          const { data: rehash, error: rehashErr } = await supabase.functions.invoke(
            "rehash-stored-file",
            { body: { file_url: flowItem.file_url } },
          );
          if (rehashErr || !rehash?.hash) {
            throw new Error(rehashErr?.message || "Could not fingerprint stored file");
          }
          hash = rehash.hash;
          size = rehash.size ?? null;
          mime = rehash.mime ?? null;
        }

        // Create the Work record on behalf of the owner (RLS = owner inserts own row).
        const { data: work, error: workErr } = await supabase
          .from("works")
          .insert({
            user_id: flowItem.user_id,
            title: flowItem.title,
            description: flowItem.description ?? null,
            kind: inferWorkKind(mime),
            content_hash: hash!,
            file_url: flowItem.file_url,
            mime_type: mime,
            file_size: size,
            visibility: "public",
          })
          .select("id")
          .single();
        if (workErr || !work) throw new Error(workErr?.message || "Could not register Work");
        workId = work.id;

        // Link the flow_item back so future renders skip the rehash.
        await supabase
          .from("flow_items")
          .update({ work_id: workId, content_hash: hash! })
          .eq("id", flowItem.id);
      }

      const supporting_urls = supportingUrl.trim() ? [supportingUrl.trim()] : [];
      const { error: rpcErr } = await supabase.rpc("submit_work_verification", {
        _work_id: workId!,
        _applicant_note: note.trim() || null,
        _supporting_urls: supporting_urls,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      toast({
        title: "Submitted for review",
        description: "An admin will review your work and anchor it on Solana.",
      });
      onOpenChange(false);
      setNote(""); setSupportingUrl("");
      onSubmitted?.();
    } catch (err) {
      toast({
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Verify this work
          </DialogTitle>
          <DialogDescription>
            Apply for the Verified IP badge. An admin will review authorship,
            then anchor a tamper-proof receipt on Solana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Work</Label>
            <p className="text-sm font-medium truncate">{flowItem.title}</p>
          </div>
          <div>
            <Label htmlFor="vnote" className="text-xs">Note to reviewer (optional)</Label>
            <Textarea
              id="vnote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything that helps prove this is yours…"
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div>
            <Label htmlFor="vurl" className="text-xs">Supporting link (optional)</Label>
            <Input
              id="vurl"
              type="url"
              value={supportingUrl}
              onChange={(e) => setSupportingUrl(e.target.value)}
              placeholder="https://your-site.com/this-piece"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyWorkDialog;
