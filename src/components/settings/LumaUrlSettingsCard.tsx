import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LumaEventEmbed } from "@/components/profile/LumaEventEmbed";

/**
 * v10.3 — single Luma URL field saved to `profiles.luma_url`.
 * Replaces the legacy ICS sync flow. We embed the URL directly via Luma's
 * iframe on the creator's profile and on event surfaces.
 */
export default function LumaUrlSettingsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState<string>("");

  const { data: prof } = useQuery({
    enabled: !!user,
    queryKey: ["profile-luma-url", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("luma_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { luma_url: string | null } | null;
    },
  });

  useEffect(() => {
    if (prof?.luma_url) setUrl(prof.luma_url);
  }, [prof?.luma_url]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      if (trimmed && !/^https?:\/\/(www\.)?lu\.ma\//i.test(trimmed)) {
        throw new Error("Please paste a valid lu.ma URL (e.g. https://lu.ma/yourcalendar)");
      }
      const { error } = await supabase
        .from("profiles")
        .update({ luma_url: trimmed || null })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(url.trim() ? "Luma link saved" : "Luma link removed");
      qc.invalidateQueries({ queryKey: ["profile-luma-url"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="luma-url" className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Luma event or calendar URL
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Paste any public <code className="px-1 rounded bg-muted">lu.ma</code> link — a single event
          or your whole calendar. We embed it on your profile so fans can RSVP without leaving
          Rhozeland.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id="luma-url"
          type="url"
          placeholder="https://lu.ma/yourhandle"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || url.trim() === (prof?.luma_url ?? "")}
        >
          {save.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      {prof?.luma_url && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Preview</p>
          <LumaEventEmbed url={prof.luma_url} />
        </div>
      )}
    </div>
  );
}
