/**
 * AiRoadmapDraftButton — entry point for drafting a roadmap on a fresh project.
 *
 * v11 Pillar 7 / Wave 2:
 *  - Voice-to-roadmap: optional mic captures a spoken brief (uses the browser's
 *    built-in SpeechRecognition; no server transcription needed). The
 *    transcript is fed into the existing draft-project-roadmap edge fn as
 *    `brief.what`, so the AI tailors milestones to what the artist actually said.
 *  - Concierge CTA: after a successful draft we surface a soft banner inviting
 *    the user to escalate to a human A&R via <ConciergeIntakeSheet />. This
 *    bridges AI-drafted → human-managed without leaving the page.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Loader2, Mic, MicOff, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft, composeMilestoneDescription } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";
import { trackConciergeCta } from "@/lib/concierge-analytics";

interface Props {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  clientId?: string | null;
  specialistId?: string | null;
  existingGoalCount: number;
}

// Browser SpeechRecognition shim — Chrome/Edge/Safari expose this under a vendor prefix.
const getSpeechRecognition = (): any => {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

export const AiRoadmapDraftButton = ({
  projectId,
  projectTitle,
  totalBudget,
  clientId,
  specialistId,
  existingGoalCount,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draft = useAiRoadmapDraft();

  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showConcierge, setShowConcierge] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SR = getSpeechRecognition();
  const voiceSupported = !!SR;

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
    };
  }, []);

  const startListening = () => {
    if (!voiceSupported) {
      toast.error("Voice input isn't supported in this browser — try Chrome.");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;

      let finalText = "";
      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + " ";
          else interim += res[0].transcript;
        }
        setTranscript((finalText + interim).trim());
      };
      rec.onerror = (e: any) => {
        console.error("speech error", e);
        toast.error("Voice input stopped — please try again.");
        setListening(false);
      };
      rec.onend = () => setListening(false);

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e: any) {
      toast.error("Couldn't start voice input.");
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop?.(); } catch {}
    setListening(false);
  };

  const generate = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const [clientCtx, specialistCtx] = await Promise.all([
        fetchCreatorContext(clientId, "Client"),
        fetchCreatorContext(specialistId, "Creator"),
      ]);

      const tokenize_intent = !!specialistCtx.token_mint;
      const briefText = transcript.trim();

      const milestones = await draft.mutateAsync({
        projectName: projectTitle,
        totalBudget,
        tokenize_intent,
        release_type: "other",
        brief: briefText ? { what: briefText, when: "", vibe: "" } : undefined,
        clientProfile: clientCtx,
        specialistProfile: specialistCtx,
      });

      if (!milestones.length) throw new Error("No milestones returned");

      const rows = milestones.map((m, i) => ({
        project_id: projectId,
        user_id: user!.id,
        title: m.title,
        description: composeMilestoneDescription(m),
        budget_amount: m.suggested_amount,
        sort_order: existingGoalCount + i,
        parent_id: null,
      })) as any;
      const { error } = await supabase.from("project_goals" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Roadmap drafted — edit anything you want.");
      setShowConcierge(true);
      setTranscript("");
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't draft roadmap"),
    onSettled: () => setBusy(false),
  });

  const isWorking = busy || generate.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {existingGoalCount > 0 ? "Want more milestones?" : "Empty roadmap?"}
          </p>
          <p className="text-xs text-muted-foreground">
            {voiceSupported
              ? "Tap the mic to describe the release out loud, or just draft from the brief."
              : "Draft milestones from the project brief — edit freely after."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {voiceSupported && (
            <Button
              type="button"
              size="sm"
              variant={listening ? "default" : "outline"}
              className="gap-2"
              disabled={isWorking}
              onClick={listening ? stopListening : startListening}
            >
              {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {listening ? "Stop" : "Voice brief"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isWorking}
            onClick={() => generate.mutate()}
          >
            {isWorking
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Wand2 className="h-3.5 w-3.5" />}
            {existingGoalCount > 0 ? "Suggest more" : "Draft a roadmap"}
          </Button>
        </div>
      </div>

      {(transcript || listening) && (
        <div className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
          <div className="mb-1 flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {listening && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              {listening ? "Listening…" : "Brief captured"}
            </span>
            {!listening && transcript && (
              <button
                type="button"
                onClick={() => setTranscript("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-foreground/90">{transcript || "Start speaking…"}</p>
        </div>
      )}

      {showConcierge && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Want us to A&R this with you?</p>
              <p className="text-xs text-muted-foreground">
                Rhozeland Concierge takes the draft, refines the milestones, and project-manages the release end-to-end.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowConcierge(false)}
            >
              Not now
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setConciergeOpen(true)}
            >
              Book a call
            </Button>
          </div>
        </div>
      )}

      <ConciergeIntakeSheet open={conciergeOpen} onOpenChange={setConciergeOpen} />
    </div>
  );
};

export default AiRoadmapDraftButton;
