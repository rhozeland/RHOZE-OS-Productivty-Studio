/**
 * EventCheckoutSheet — unified ticket checkout for all three modes:
 *   • paid (USD via Square, or $RHOZE)
 *   • free_rsvp (one-tap RSVP)
 *   • request (host approves)
 *
 * Guests fill name + email; we call `claim-event-ticket` which creates
 * an account + issues the ticket + emails confirmation. Signed-in users
 * skip step 1.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, CreditCard, Loader2, Mail, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SquareCardForm from "@/components/booking/SquareCardForm";
import PayWithRhozeButton from "@/components/PayWithRhozeButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fiatToRhoze, formatMoney, rhozeDiscount } from "@/lib/event-currency";
import { getHoldTier, type TierId } from "@/lib/tier-matrix";

interface Tier {
  id: string;
  name: string;
  description?: string | null;
  price_usd?: number | null;
  price_rhoze?: number | null;
  currency_code?: string | null;
  quantity_total?: number | null;
  quantity_sold: number;
  tier_kind?: "paid" | "free_rsvp" | "request" | string;
}

interface Event {
  id: string;
  title: string;
  host_id?: string;
  currency_code?: string | null;
  cover_url?: string | null;
  starts_at?: string;
  venue_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  tier: Tier;
  onIssued?: (ticketId: string) => void;
}

const guestSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
});

const EventCheckoutSheet = ({ open, onOpenChange, event, tier, onIssued }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const tierKind = (tier.tier_kind ?? "paid") as "paid" | "free_rsvp" | "request";
  const isPaid = tierKind === "paid";
  const fiatPrice = Number(tier.price_usd) || 0;
  const currency = tier.currency_code || event.currency_code || "USD";

  // Discount for paying with $RHOZE
  const { data: buyerBalance } = useQuery({
    queryKey: ["buyer-rhoze-balance", user?.id],
    enabled: !!user && isPaid,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return Number(data?.balance) || 0;
    },
  });
  const buyerTier: TierId = getHoldTier(buyerBalance ?? 0);
  const discountPct = rhozeDiscount(buyerTier);
  const rhoze = isPaid && fiatPrice > 0
    ? fiatToRhoze(fiatPrice, buyerTier)
    : Number(tier.price_rhoze) || 0;
  const hasRhoze = rhoze > 0;
  const hasFiat = fiatPrice > 0;

  // Step 1: collect guest info if not signed in
  const [step, setStep] = useState<1 | 2>(user ? 2 : 1);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"usd" | "rhoze">(hasFiat ? "usd" : "rhoze");

  useEffect(() => {
    if (open) {
      setStep(user ? 2 : 1);
      setGuestName("");
      setGuestEmail("");
      setTab(hasFiat ? "usd" : "rhoze");
    }
  }, [open, user, hasFiat]);

  // Resolve buyer name/email regardless of state
  const buyerInfo = useMemo(() => {
    if (user) {
      return {
        name:
          (user.user_metadata as any)?.full_name ||
          (user.user_metadata as any)?.display_name ||
          user.email?.split("@")[0] ||
          "Guest",
        email: user.email ?? "",
      };
    }
    return { name: guestName.trim(), email: guestEmail.trim().toLowerCase() };
  }, [user, guestName, guestEmail]);

  const proceed = () => {
    if (user) return setStep(2);
    const r = guestSchema.safeParse({ name: guestName, email: guestEmail });
    if (!r.success) {
      toast.error(r.error.errors[0]?.message || "Check your info");
      return;
    }
    setStep(2);
  };

  // Submit to claim-event-ticket
  const submitClaim = async (payment?: {
    currency: "usd" | "rhoze";
    reference: string;
    amount: number;
  }) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("claim-event-ticket", {
        body: {
          event_id: event.id,
          tier_id: tier.id,
          name: buyerInfo.name,
          email: buyerInfo.email,
          payment,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message || (data as any)?.error || "Could not issue ticket");
      }
      const ticketId = (data as any).ticket_id as string;
      const status = (data as any).status as string;
      const accountCreated = (data as any).account_created as boolean;

      if (status === "pending_approval") {
        toast.success("Request sent", {
          description: "The host will review and email you when approved.",
        });
        onIssued?.(ticketId);
        onOpenChange(false);
      } else {
        toast.success("You're in", {
          description: accountCreated
            ? "Check your email — we sent your ticket and a sign-in link."
            : "Your ticket is ready.",
        });
        onIssued?.(ticketId);
        onOpenChange(false);
        if (user) navigate(`/tickets/${ticketId}`);
      }
    } catch (err) {
      toast.error("Could not complete", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSquareToken = async (token: string) => {
    const { data, error } = await supabase.functions.invoke("square-payment", {
      body: {
        amount_cents: Math.round(fiatPrice * 100),
        currency,
        description: `Rhozeland Event: ${event.title} — ${tier.name}`,
        source_id: token,
        location_id: "DDWDTXBFW3T4R",
      },
    });
    if (error) throw new Error(error.message || "Payment failed");
    if (!data?.success) throw new Error(data?.error || "Payment declined");
    await submitClaim({
      currency: "usd",
      reference: data.payment_id ?? data.id ?? "square",
      amount: fiatPrice,
    });
  };

  const handleRhozeSuccess = async () => {
    const reference = `rhoze:${buyerInfo.email}:${tier.id}:${Date.now()}`;
    await submitClaim({ currency: "rhoze", reference, amount: rhoze });
  };

  const fiatLabel = formatMoney(fiatPrice, currency);
  const rhozeLabel = `${rhoze.toLocaleString()} $RHOZE`;
  const ctaLabel =
    tierKind === "request" ? "Send request" :
    tierKind === "free_rsvp" ? "Confirm RSVP" :
    "Continue to payment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" /> {tier.name}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {event.title}
            {tier.description ? ` — ${tier.description}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — guest info */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ec-name" className="text-xs uppercase tracking-wider text-muted-foreground">Your name</Label>
              <Input
                id="ec-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Jane Doe"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                id="ec-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
              <span>
                We'll create your free Rhozeland account so your ticket and pass live in
                one place. Sign in anytime with the magic link we email you — no password needed.
              </span>
            </div>
            <Button onClick={proceed} className="w-full rounded-full" disabled={submitting}>
              Continue
            </Button>
          </div>
        )}

        {/* STEP 2 — confirm/pay */}
        {step === 2 && (
          <div className="space-y-4">
            {!user && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>Buying as <strong className="text-foreground">{buyerInfo.email}</strong></span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-auto text-foreground hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Free RSVP */}
            {tierKind === "free_rsvp" && (
              <Button
                onClick={() => submitClaim()}
                disabled={submitting}
                className="w-full h-11 rounded-full"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
              </Button>
            )}

            {/* Request to join */}
            {tierKind === "request" && (
              <>
                <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>The host reviews requests. You'll get an email the moment yours is approved.</span>
                </div>
                <Button
                  onClick={() => submitClaim()}
                  disabled={submitting}
                  className="w-full h-11 rounded-full"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
                </Button>
              </>
            )}

            {/* Paid — USD + $RHOZE */}
            {isPaid && hasFiat && hasRhoze && (
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="usd" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> {fiatLabel}
                  </TabsTrigger>
                  <TabsTrigger value="rhoze" className="gap-1.5">
                    <Coins className="h-3.5 w-3.5" /> {rhozeLabel}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="usd" className="pt-3">
                  <SquareCardForm amount={fiatPrice} onTokenize={handleSquareToken} disabled={submitting} />
                </TabsContent>
                <TabsContent value="rhoze" className="pt-3 space-y-3">
                  {discountPct > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="text-primary">{Math.round(discountPct * 100)}% {buyerTier} discount</span> applied.
                    </p>
                  )}
                  {user ? (
                    <PayWithRhozeButton
                      tokenAmount={rhoze}
                      description={`Event ticket: ${event.title} — ${tier.name}`}
                      type="event_ticket"
                      intent="subscription"
                      onSuccess={handleRhozeSuccess}
                      label={`Pay ${rhozeLabel}`}
                      className="w-full"
                      variant="default"
                      disabled={submitting}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sign in to pay with $RHOZE — wallet required.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
            {isPaid && hasFiat && !hasRhoze && (
              <SquareCardForm amount={fiatPrice} onTokenize={handleSquareToken} disabled={submitting} />
            )}
            {isPaid && !hasFiat && hasRhoze && user && (
              <PayWithRhozeButton
                tokenAmount={rhoze}
                description={`Event ticket: ${event.title} — ${tier.name}`}
                type="event_ticket"
                intent="subscription"
                onSuccess={handleRhozeSuccess}
                label={`Pay ${rhozeLabel}`}
                className="w-full"
                variant="default"
                disabled={submitting}
              />
            )}

            {submitting && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Issuing your ticket…
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventCheckoutSheet;
