import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Lets a creator paste a public iCal feed URL (Luma, Google Calendar, Apple,
 * Eventbrite, etc.) and mirror upcoming events into their Rhozeland calendar.
 *
 * Read-only sync — published rows include `external_url` so attendees can RSVP
 * on the source platform.
 */
export default function IcsImportCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState<string>("");

  const { data: prof } = useQuery({
    enabled: !!user,
    queryKey: ["profile-ics", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("luma_ics_url, ics_last_synced_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data?.luma_ics_url) setUrl(data.luma_ics_url);
      return data;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error("Please paste a valid https:// iCal feed URL");
      }
      const { data, error } = await supabase.functions.invoke("sync-ics-events", {
        body: { ics_url: trimmed },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { inserted: number; updated: number; total: number };
    },
    onSuccess: (r) => {
      toast.success(`Synced ${r.total} upcoming · ${r.inserted} new, ${r.updated} updated`);
      qc.invalidateQueries({ queryKey: ["profile-ics"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(e.message || "Sync failed"),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="ics-url" className="flex items-center gap-2">
          <CalendarSync className="h-4 w-4 text-primary" />
          iCal / Luma feed URL
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Paste any public <code className="px-1 rounded bg-muted">.ics</code> URL — Luma calendars,
          Google Calendar share links, Eventbrite, Apple, etc. We pull upcoming events into your
          Rhozeland calendar and link attendees back to the source for RSVP.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id="ics-url"
          type="url"
          placeholder="https://api.lu.ma/ics/get?entity=calendar&id=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending || !url.trim()}
        >
          {sync.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing…
            </>
          ) : (
            "Sync now"
          )}
        </Button>
      </div>

      {prof?.ics_last_synced_at && (
        <p className="text-xs text-muted-foreground">
          Last synced {formatDistanceToNow(new Date(prof.ics_last_synced_at), { addSuffix: true })}
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Finding your Luma calendar URL
        </p>
        <p>
          Open your Luma calendar → ⋯ menu → <em>Subscribe</em> → copy the <code>webcal://</code> or
          <code> https://api.lu.ma/ics/…</code> link. (Works on free Luma — no Plus needed.)
        </p>
      </div>
    </div>
  );
}
