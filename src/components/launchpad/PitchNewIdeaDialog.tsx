/**
 * PitchNewIdeaDialog — "Pitch us a new idea" proposal popup from the
 * Launch-a-Coin flow. Lets the creator describe a release + coin idea
 * freeform, get AI to fill the structured fields, attach reference
 * links, and upload media. Submits as a `concierge_requests` row
 * (category="coin-launch", tier="curated").
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  Paperclip,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GRADIENT =
  "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 50%, hsl(38 92% 55%) 100%)";

const MAX_FILE_MB = 25;

type Attachment = { name: string; url: string; size: number; mime: string };

export default function PitchNewIdeaDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [holderBenefits, setHolderBenefits] = useState("");
  const [outcome, setOutcome] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setTitle("");
    setSummary("");
    setHolderBenefits("");
    setOutcome("");
    setLinkInput("");
    setLinks([]);
    setFiles([]);
    setAiPrompt("");
    setShowAi(false);
    setSubmitted(false);
  };

  const runAi = async () => {
    if (!aiPrompt.trim() || aiPrompt.trim().length < 5) {
      toast.error("Tell the AI a bit more about your idea first.");
      return;
    }
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("draft-pitch-idea", {
      body: { prompt: aiPrompt.trim() },
    });
    setAiLoading(false);
    if (error) {
      toast.error(error.message || "AI couldn't draft this one — try again.");
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    if (data?.title) setTitle(data.title);
    if (data?.summary) setSummary(data.summary);
    if (data?.holder_benefits) setHolderBenefits(data.holder_benefits);
    if (data?.outcome) setOutcome(data.outcome);
    setShowAi(false);
    toast.success("Pitch drafted — edit anything before sending.");
  };

  const addLink = () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setLinks((prev) => Array.from(new Set([...prev, value])));
    setLinkInput("");
  };

  const removeLink = (i: number) => setLinks((prev) => prev.filter((_, x) => x !== i));
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, x) => x !== i));

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !user) return;
    setUploading(true);
    const next: Attachment[] = [];
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} is over ${MAX_FILE_MB}MB.`);
        continue;
      }
      const path = `${user.id}/pitch-${Date.now()}-${f.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const { error } = await supabase.storage.from("flow-uploads").upload(path, f, {
        contentType: f.type,
        upsert: false,
      });
      if (error) {
        toast.error(`Upload failed: ${f.name}`);
        continue;
      }
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      next.push({ name: f.name, url: pub.publicUrl, size: f.size, mime: f.type });
    }
    setFiles((prev) => [...prev, ...next]);
    setUploading(false);
  };

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!title.trim() || summary.trim().length < 20) {
      toast.error("Add a title and at least one solid sentence describing it.");
      return;
    }
    setSubmitting(true);
    const summaryBlob = [
      `Title: ${title.trim()}`,
      `Description: ${summary.trim()}`,
      `Holder benefits: ${holderBenefits.trim() || "—"}`,
      links.length ? `Links:\n${links.map((l) => `- ${l}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: inserted, error } = await (supabase as any)
      .from("concierge_requests")
      .insert({
        client_id: user.id,
        summary: summaryBlob,
        outcome: outcome.trim() || `Launch a pump.fun coin for "${title.trim()}" with Rhozeland A&R support`,
        category: "coin-launch",
        tier: "curated",
        attachments: [
          ...files.map((f) => ({ kind: "file", ...f })),
          ...links.map((url) => ({ kind: "link", url })),
        ],
      })
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      toast.error(error.message || "Could not submit. Try again.");
      return;
    }

    supabase.functions
      .invoke("send-transactional-email", {
        body: {
          templateName: "concierge-request-internal",
          recipientEmail: "collab@rhozeland.com",
          idempotencyKey: `concierge-internal-${inserted?.id ?? user.id}-${Date.now()}`,
          templateData: {
            category: "coin-launch",
            tier: "curated",
            submitterName: user.user_metadata?.full_name ?? null,
            submitterEmail: user.email ?? null,
            submitterId: user.id,
            summary: summaryBlob,
            outcome: outcome.trim() || null,
            requestId: inserted?.id ?? null,
            source: "PitchNewIdeaDialog",
          },
        },
      })
      .catch((e) => console.warn("[pitch alert] email failed:", e));

    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 300);
      }}
    >
      <DialogContent className="w-[min(95vw,42rem)] max-w-[42rem] max-h-[90vh] overflow-hidden p-0 border-border bg-background gap-0 [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>Pitch us a new idea</DialogTitle>
          <DialogDescription>Send a release + coin proposal to the Rhozeland A&R team.</DialogDescription>
        </VisuallyHidden>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {submitted ? (
          <div className="px-6 py-10 sm:px-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Pitch sent</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Rhozeland's A&R team will review your idea and reply within 48 hours.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="rounded-full">
              Close
            </Button>
          </div>
        ) : (
          <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden px-5 pt-10 pb-6 sm:px-7 sm:pt-12 sm:pb-7 space-y-5">
            <div className="mx-auto max-w-[32rem] text-center space-y-1.5">
              <div
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
                style={{ background: GRADIENT, color: "white" }}
              >
                <Sparkles className="h-3 w-3" /> New idea pitch
              </div>
              <h2 className="mx-auto max-w-[16ch] font-display text-xl sm:text-2xl font-bold tracking-tight" style={{ overflowWrap: "anywhere" }}>
                Tell us what you want to launch
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Sketch the release + coin you have in mind. A&R will scope it with you.
              </p>
            </div>

            {/* AI assist */}
            <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-3 space-y-2">
              {!showAi ? (
                <button
                  type="button"
                  onClick={() => setShowAi(true)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center shrink-0">
                    <Wand2 className="h-4 w-4 text-fuchsia-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Describe it in plain English</p>
                    <p className="text-[11px] text-muted-foreground">
                      AI will draft the title, description and holder benefits for you.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder='e.g. "4-track EP about leaving Lagos. Want to launch a coin so day-one fans share the upside and unlock a remix pack."'
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={runAi}
                      disabled={aiLoading}
                      className="text-white border-0 flex-1"
                      style={{ background: GRADIENT }}
                    >
                      {aiLoading ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting…</>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5" /> Draft my pitch</>
                      )}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowAi(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pitch-title">Working title</Label>
                <Input
                  id="pitch-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Leaving Lagos EP"
                  maxLength={80}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pitch-summary">Describe the release & coin</Label>
                <Textarea
                  id="pitch-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder="What is it? Why now? Who is it for?"
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">{summary.length} chars</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pitch-benefits">What do holders get?</Label>
                <Textarea
                  id="pitch-benefits"
                  value={holderBenefits}
                  onChange={(e) => setHolderBenefits(e.target.value)}
                  rows={2}
                  placeholder="Early access, splits, exclusive drops…"
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pitch-outcome">What does success look like? (optional)</Label>
                <Input
                  id="pitch-outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="e.g. EP out Q3, 200 holders, $25k MC"
                />
              </div>

              {/* Links */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Reference links (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                    placeholder="paste a SoundCloud, demo, mood ref…"
                  />
                  <Button type="button" variant="outline" onClick={addLink}>Add</Button>
                </div>
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {links.map((l, i) => (
                      <span
                        key={l + i}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-foreground/[0.06] border border-border max-w-full"
                      >
                        <span className="truncate max-w-[180px]">{l}</span>
                        <button type="button" onClick={() => removeLink(i)} aria-label="Remove link">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Media */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Media (optional)
                </Label>
                <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-border bg-card/60 hover:bg-card cursor-pointer text-sm text-muted-foreground">
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <><Paperclip className="h-4 w-4" /> Attach files (audio, images, PDFs · max {MAX_FILE_MB}MB each)</>
                  )}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={uploading}
                  />
                </label>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {files.map((f, i) => (
                      <span
                        key={f.url}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 max-w-full"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{f.name}</span>
                        <button type="button" onClick={() => removeFile(i)} aria-label="Remove file">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit — matches Launch Coin modal CTA */}
            <style>{`
              @keyframes rhoze-cta-flow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
              @keyframes rhoze-cta-shine { 0%{transform:translateX(-120%) skewX(-20deg)} 60%,100%{transform:translateX(220%) skewX(-20deg)} }
              @keyframes rhoze-cta-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
              .rhoze-cta{
                position:relative; overflow:hidden; isolation:isolate;
                background-size:200% 200%;
                animation: rhoze-cta-flow 6s ease-in-out infinite, rhoze-cta-float 4s ease-in-out infinite;
                box-shadow:
                  0 1px 0 rgba(255,255,255,0.5) inset,
                  0 -3px 8px rgba(0,0,0,0.18) inset,
                  0 10px 24px -8px hsl(330 85% 55% / 0.55),
                  0 18px 40px -12px hsl(292 84% 55% / 0.45);
                transform: translateZ(0);
                transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
              }
              .rhoze-cta:hover{
                transform: translateY(-2px) scale(1.012);
                filter: brightness(1.06) saturate(1.08);
                box-shadow:
                  0 1px 0 rgba(255,255,255,0.6) inset,
                  0 -3px 8px rgba(0,0,0,0.22) inset,
                  0 16px 34px -8px hsl(330 85% 55% / 0.65),
                  0 26px 50px -12px hsl(292 84% 55% / 0.55);
              }
              .rhoze-cta:active{ transform: translateY(1px) scale(0.995); filter: brightness(0.98); }
              .rhoze-cta::before{
                content:""; position:absolute; inset:0; pointer-events:none;
                background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%, rgba(0,0,0,0.18));
                mix-blend-mode: overlay;
              }
              .rhoze-cta::after{
                content:""; position:absolute; top:0; bottom:0; left:0; width:35%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
                animation: rhoze-cta-shine 3.2s ease-in-out infinite;
                pointer-events:none;
              }
              .rhoze-cta .rhoze-cta-label{ position:relative; z-index:1; display:inline-flex; align-items:center; gap:0.5rem; text-shadow: 0 1px 1px rgba(0,0,0,0.18); }
              .rhoze-cta:hover .rhoze-cta-arrow{ transform: translateX(4px); }
              .rhoze-cta-arrow{ transition: transform .25s ease; }
            `}</style>
            <Button
              onClick={submit}
              disabled={submitting || !title.trim() || summary.trim().length < 20}
              className="rhoze-cta w-full h-14 text-base font-semibold text-white border-0 rounded-2xl"
              style={{ background: GRADIENT }}
            >
              {submitting ? (
                <span className="rhoze-cta-label"><Loader2 className="h-4 w-4 animate-spin" /> Sending…</span>
              ) : (
                <span className="rhoze-cta-label">Send to Rhozeland <ArrowRight className="rhoze-cta-arrow h-4 w-4" /></span>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Free to pitch — our A&R team reviews within 48 hours and replies in your Inbox.
              <br />
              If we build it together, platform fee is 7–15% based on your tier. Everything else is yours.
            </p>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
