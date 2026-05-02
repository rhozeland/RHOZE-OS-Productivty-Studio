/**
 * EventCreatePage — host wizard for creating an event under /spaces/events/new.
 *
 * Two paths in one page (no multi-step yet to keep v1 tight):
 *   1) Save as draft        → creates the event row + a free RSVP tier.
 *   2) Publish + anchor     → also computes manifest_hash (SHA-256 of the
 *                             canonical metadata) and anchors via the
 *                             existing anchor-contribution edge function.
 *
 * Manifest contains: title, host, venue, dates, capacity, tier shape, terms.
 * The hash is what proves the event terms were locked at publish time.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Sparkles, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CATEGORIES = [
  "music",
  "art",
  "talk",
  "workshop",
  "screening",
  "exhibition",
  "meetup",
  "other",
] as const;

const EventCreatePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("meetup");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 5 MB." });
      return;
    }
    setCoverUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/events/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("listing-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("listing-media").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Try a different image.",
      });
    } finally {
      setCoverUploading(false);
    }
  };

  // Free RSVP tier (always created). Paid tiers can be added in /manage later.
  const [rsvpTierName, setRsvpTierName] = useState("RSVP");
  const [rsvpQuantity, setRsvpQuantity] = useState<string>("");

  const buildManifest = () => ({
    protocol: "rhozeland",
    type: "event",
    version: "1",
    title,
    host_id: user?.id,
    category,
    is_online: isOnline,
    venue: isOnline ? null : { name: venueName, address: venueAddress },
    online_url: isOnline ? onlineUrl : null,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: capacity ? Number(capacity) : null,
    tiers: [
      {
        name: rsvpTierName || "RSVP",
        kind: "rsvp",
        quantity_total: rsvpQuantity ? Number(rsvpQuantity) : null,
      },
    ],
    terms: description,
  });

  const validate = (): string | null => {
    if (!title.trim()) return "Add a title";
    if (!startsAt) return "Pick a start time";
    if (!endsAt) return "Pick an end time";
    if (new Date(endsAt) <= new Date(startsAt))
      return "End time must be after start";
    if (!isOnline && !venueName.trim()) return "Add a venue name";
    if (isOnline && !onlineUrl.trim()) return "Add an online link";
    return null;
  };

  const submitMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!user) throw new Error("Sign in required");
      const err = validate();
      if (err) throw new Error(err);

      const manifest = buildManifest();
      const manifestStr = JSON.stringify(manifest);
      const manifest_hash = publish ? await sha256Hex(manifestStr) : null;

      // 1) Create the event
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .insert({
          host_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          starts_at: startsAt,
          ends_at: endsAt,
          is_online: isOnline,
          venue_name: isOnline ? null : venueName.trim() || null,
          venue_address: isOnline ? null : venueAddress.trim() || null,
          online_url: isOnline ? onlineUrl.trim() || null : null,
          capacity: capacity ? Number(capacity) : null,
          status: publish ? "published" : "draft",
          manifest_hash,
          manifest_json: manifest as any,
          ticket_currency_modes: ["rsvp"],
          cover_url: coverUrl,
        })
        .select()
        .single();
      if (evErr) throw evErr;

      // 2) Create the free RSVP tier
      const { error: tierErr } = await supabase.from("event_ticket_tiers").insert({
        event_id: ev.id,
        name: rsvpTierName.trim() || "RSVP",
        description: "Free RSVP",
        price_usd: 0,
        price_rhoze: 0,
        quantity_total: rsvpQuantity ? Number(rsvpQuantity) : null,
        sort_order: 0,
        is_active: true,
      });
      if (tierErr) throw tierErr;

      // 3) If publishing, write a contribution_proof + anchor on Solana
      let signature: string | null = null;
      if (publish) {
        const { data: proof, error: proofErr } = await supabase
          .from("contribution_proofs")
          .insert({
            user_id: user.id,
            action_type: "event_manifest",
            reference_id: ev.id,
            metadata: {
              event_id: ev.id,
              manifest_hash,
              title,
              starts_at: startsAt,
            },
          })
          .select()
          .single();
        if (proofErr) throw proofErr;

        const { data: anchorRes, error: anchorErr } =
          await supabase.functions.invoke("anchor-contribution", {
            body: { proof_id: proof.id },
          });
        if (anchorErr) {
          // Anchoring failure shouldn't kill the event creation — just warn.
          console.warn("Anchor failed:", anchorErr);
        } else {
          signature = (anchorRes as { signature?: string })?.signature ?? null;
          if (signature) {
            await supabase
              .from("events")
              .update({
                solana_signature: signature,
                anchored_at: new Date().toISOString(),
              })
              .eq("id", ev.id);
          }
        }
      }

      return { event: ev, signature };
    },
    onSuccess: ({ event, signature }, publish) => {
      toast.success(publish ? "Event published" : "Draft saved", {
        description: signature
          ? "Manifest anchored on Solana."
          : "You can add paid tiers and artifacts from Manage.",
      });
      navigate(`/spaces/events/${event.id}`);
    },
    onError: (err: unknown) => {
      toast.error("Could not create event", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Sign in to host</h1>
        <p className="text-muted-foreground mb-4">
          You need a Rhozeland account to publish an event.
        </p>
        <Link to="/auth">
          <Button className="rounded-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  const isSubmitting = submitMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/spaces?tab=events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
          New event
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Host an event
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm max-w-lg">
          Set the basics. When you publish, the manifest is hashed and anchored
          on Solana — a permanent proof of what you committed to.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border p-6 space-y-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A night of generative music"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description / terms</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's the vibe? What should attendees expect? Any house rules?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap">Capacity (optional)</Label>
            <Input
              id="cap"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 80"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="starts">Starts</Label>
            <Input
              id="starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ends">Ends</Label>
            <Input
              id="ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Online event</p>
            <p className="text-xs text-muted-foreground">
              Toggle if attendees join via a link instead of a venue.
            </p>
          </div>
          <Switch checked={isOnline} onCheckedChange={setIsOnline} />
        </div>

        {isOnline ? (
          <div className="space-y-1.5">
            <Label htmlFor="url">Online URL</Label>
            <Input
              id="url"
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
              placeholder="https://meet.example.com/…"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="venue">Venue name</Label>
              <Input
                id="venue"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Studio 33R"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr">Venue address</Label>
              <Input
                id="addr"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>
          </>
        )}

        <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Free RSVP tier</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Every event ships with a free tier. Add paid tiers (USD or $RHOZE)
            from Manage after publishing.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-name">Tier name</Label>
              <Input
                id="rsvp-name"
                value={rsvpTierName}
                onChange={(e) => setRsvpTierName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-qty">Spots (optional)</Label>
              <Input
                id="rsvp-qty"
                type="number"
                min="1"
                value={rsvpQuantity}
                onChange={(e) => setRsvpQuantity(e.target.value)}
                placeholder="Unlimited if blank"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={isSubmitting}
          onClick={() => submitMutation.mutate(false)}
        >
          Save as draft
        </Button>
        <Button
          className="rounded-full gap-1.5"
          disabled={isSubmitting}
          onClick={() => submitMutation.mutate(true)}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Publish & anchor
        </Button>
      </div>
    </div>
  );
};

export default EventCreatePage;
