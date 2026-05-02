/**
 * UnsubscribePage — handles one-click unsubscribe links from app emails.
 *
 * Flow:
 *   1. On mount: GET handle-email-unsubscribe?token=<t> to validate.
 *   2. If valid → render confirm button.
 *   3. On click: POST { token } to actually suppress the address.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "done" }
  | { kind: "error"; message: string };

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Missing unsubscribe token." });
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY },
        });
        const data = await r.json();
        if (!r.ok) {
          setState({ kind: "error", message: data?.error ?? "Invalid link." });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        if (data.valid === true) {
          setState({ kind: "ready" });
          return;
        }
        setState({ kind: "error", message: "Unexpected response." });
      } catch (e: any) {
        setState({ kind: "error", message: e.message ?? "Network error." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } },
      );
      if (error) throw error;
      if ((data as any)?.success) setState({ kind: "done" });
      else if ((data as any)?.reason === "already_unsubscribed")
        setState({ kind: "already" });
      else setState({ kind: "error", message: "Couldn't unsubscribe." });
    } catch (e: any) {
      setState({ kind: "error", message: e.message ?? "Network error." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-8 space-y-5 text-center">
        <h1 className="font-display text-2xl">Email preferences</h1>

        {state.kind === "loading" && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">
              Click below to unsubscribe from Rhozeland app emails. You'll still
              receive critical account messages (sign-in, password reset).
            </p>
            <Button
              onClick={confirm}
              disabled={submitting}
              variant="destructive"
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm unsubscribe"
              )}
            </Button>
          </>
        )}

        {state.kind === "done" && (
          <div className="space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm">You've been unsubscribed.</p>
          </div>
        )}

        {state.kind === "already" && (
          <div className="space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This email is already unsubscribed.
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-2">
            <XCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{state.message}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UnsubscribePage;
