/**
 * VerificationPage — `/settings/verification`.
 *
 * v9 simplified flow. No selfie video. Verified Artist is earned by:
 *   1. Uploading creative work
 *   2. Reaching ≥3 works approved as Verified IP by admins
 *   3. Clicking "Submit for review" — admin one-click approves
 *
 * Status surfaces unchanged: none / pending / verified / revoked.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useArtistVerification } from "@/hooks/useArtistVerification";
import { ArrowLeft, BadgeCheck, Check, Clock, Loader2, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const REQUIRED_VERIFIED_WORKS = 3;

type LatestRequest = {
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  review_note: string | null;
};

const submitSchema = z.object({
  contact_email: z.string().trim().email().max(255),
  bio: z.string().trim().min(20, "Tell us a bit about your work (min 20 chars)").max(500),
});

const VerificationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: verif, refetch } = useArtistVerification(user?.id);

  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState<LatestRequest | null>(null);

  // Count of works that have been admin-approved as Verified IP
  const { data: verifiedWorksCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["verified-works-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_unverified", false)
        .not("anchored_at", "is", null);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const meetsThreshold = verifiedWorksCount >= REQUIRED_VERIFIED_WORKS;

  const loadLatest = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("artist_verification_requests")
      .select("status, created_at, decided_at, review_note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as LatestRequest | null) ?? null);
  };

  useEffect(() => {
    if (!user) return;
    loadLatest();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!meetsThreshold) {
      toast({
        title: "Not yet eligible",
        description: `You need ${REQUIRED_VERIFIED_WORKS} works approved as Verified IP first.`,
        variant: "destructive",
      });
      return;
    }
    const parsed = submitSchema.safeParse({ contact_email: contactEmail, bio });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message ?? "Invalid input", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from("artist_verification_requests")
        .insert({
          user_id: user.id,
          contact_email: parsed.data.contact_email,
          bio: parsed.data.bio,
          status: "pending",
        });
      if (insertErr) throw insertErr;

      toast({ title: "Submitted", description: "An admin will review and notify you shortly." });
      await Promise.all([refetch(), loadLatest()]);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message ?? "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const status = verif?.status ?? "none";
  const progressPct = Math.min(100, (verifiedWorksCount / REQUIRED_VERIFIED_WORKS) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Settings
      </Button>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verified Artist</h1>
        <p className="text-sm text-muted-foreground">
          Earned, not applied for. Get {REQUIRED_VERIFIED_WORKS} works approved as Verified IP and an admin signs you off — unlocks paid services, Shares, and coin launches.
        </p>
      </header>

      {latest && <SubmissionTimeline latest={latest} status={status} />}

      {status === "verified" ? (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <BadgeCheck className="h-5 w-5" /> You're verified
            </CardTitle>
            <CardDescription>All monetization surfaces are unlocked.</CardDescription>
          </CardHeader>
        </Card>
      ) : status === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Under review</CardTitle>
            <CardDescription>An admin is taking a look. Most decisions take a day or two.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {status === "revoked" && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-5 w-5" /> Verification revoked
                </CardTitle>
                <CardDescription>You can submit a new request once you have {REQUIRED_VERIFIED_WORKS} Verified IP works again.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* ─── Eligibility gate ─── */}
          <Card className={cn(meetsThreshold && "border-emerald-500/30 bg-emerald-500/5")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Verified IP progress
              </CardTitle>
              <CardDescription>
                {countLoading
                  ? "Counting your approved works…"
                  : meetsThreshold
                  ? "You're eligible. Fill the form below to submit."
                  : `You're at ${verifiedWorksCount} / ${REQUIRED_VERIFIED_WORKS}. Keep uploading and request Verified IP review on each work.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPct} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{verifiedWorksCount} approved</span>
                <span>{REQUIRED_VERIFIED_WORKS} required</span>
              </div>
              {!meetsThreshold && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/dashboard?tab=works")}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload a work
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ─── Submit form (only enabled when threshold met) ─── */}
          <Card className={cn(!meetsThreshold && "opacity-60")}>
            <CardHeader>
              <CardTitle>Submit your verification</CardTitle>
              <CardDescription>
                {meetsThreshold
                  ? "Quick check — an admin will confirm and flip the badge on."
                  : `Form unlocks at ${REQUIRED_VERIFIED_WORKS} Verified IP works.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Contact email</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!meetsThreshold}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Short artist bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you make, where you're based, anything that helps us recognize you."
                  disabled={!meetsThreshold}
                />
                <p className="text-xs text-muted-foreground">{bio.length}/500</p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !meetsThreshold}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <><BadgeCheck className="mr-2 h-4 w-4" /> Submit for review</>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

/* ─── Submission timeline ───────────────────────────────────────────────── */

function SubmissionTimeline({
  latest,
  status,
}: {
  latest: LatestRequest;
  status: "none" | "pending" | "verified" | "revoked";
}) {
  const submittedAt = new Date(latest.created_at);
  const decidedAt = latest.decided_at ? new Date(latest.decided_at) : null;

  const submittedState = "done" as const;
  const reviewState =
    decidedAt
      ? ("done" as const)
      : status === "pending"
        ? ("active" as const)
        : ("done" as const);
  const decisionState =
    latest.status === "approved"
      ? ("done" as const)
      : latest.status === "rejected"
        ? ("rejected" as const)
        : ("pending" as const);

  const steps = [
    { key: "submitted", label: "Submitted", detail: `${formatDistanceToNow(submittedAt)} ago`, state: submittedState },
    {
      key: "review",
      label: "In review",
      detail: reviewState === "active" ? "Our team is taking a look" : reviewState === "done" ? "Reviewed" : "Pending",
      state: reviewState,
    },
    {
      key: "decision",
      label: latest.status === "approved" ? "Approved" : latest.status === "rejected" ? "Needs changes" : "Decision",
      detail: decidedAt ? `${formatDistanceToNow(decidedAt)} ago` : "Usually 1–2 days",
      state: decisionState,
    },
  ];

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          {steps.map((step, i) => (
            <div key={step.key} className="flex-1 flex flex-col items-center text-center">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={cn("h-px flex-1 -mr-1", steps[i - 1].state === "done" ? "bg-sky-500/60" : "bg-border")} />
                )}
                <div
                  className={cn(
                    "h-7 w-7 rounded-full border flex items-center justify-center shrink-0 z-10",
                    step.state === "done" && "bg-sky-500 border-sky-500 text-white",
                    step.state === "active" && "bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400",
                    step.state === "rejected" && "bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400",
                    step.state === "pending" && "bg-muted border-border text-muted-foreground",
                  )}
                >
                  {step.state === "done" ? <Check className="h-4 w-4" /> :
                    step.state === "active" ? <Clock className="h-3.5 w-3.5" /> :
                    step.state === "rejected" ? <ShieldAlert className="h-3.5 w-3.5" /> :
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("h-px flex-1 -ml-1", step.state === "done" ? "bg-sky-500/60" : "bg-border")} />
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-medium text-foreground">{step.label}</p>
                <p className="text-[10px] text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
        {latest.status === "rejected" && latest.review_note && (
          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-medium">Reviewer note:</span> {latest.review_note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default VerificationPage;
