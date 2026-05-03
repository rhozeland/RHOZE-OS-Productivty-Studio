/**
 * TicketCheckoutDialog — paid ticket checkout for an event tier.
 *
 * Supports two currencies on the same tier:
 *   • USD via Square (card form)
 *   • $RHOZE via Solana wallet (SPL transfer to treasury, server-verified)
 *
 * On success, inserts an event_tickets row with the verified payment
 * reference, increments the tier's quantity_sold, and bounces the user
 * to /tickets/:id.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Coins, CreditCard, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SquareCardForm from "@/components/booking/SquareCardForm";
import PayWithRhozeButton from "@/components/PayWithRhozeButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlatformFeeFromBalance } from "@/lib/platform-fee";
import { fiatToRhoze, formatMoney, rhozeDiscount } from "@/lib/event-currency";
import { getHoldTier, type TierId } from "@/lib/tier-matrix";

interface Tier {
  id: string;
  name: string;
  description?: string | null;
  price_usd?: number | null; // stored in event currency (legacy column name)
  price_rhoze?: number | null;
  currency_code?: string | null;
  quantity_total?: number | null;
  quantity_sold: number;
}

interface Event {
  id: string;
  title: string;
  host_id?: string;
  currency_code?: string | null;
}

interface TicketCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  tier: Tier;
  onIssued?: () => void;
}

const TicketCheckoutDialog = ({
  open,
  onOpenChange,
  event,
  tier,
  onIssued,
}: TicketCheckoutDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const fiatPrice = Number(tier.price_usd) || 0;
  const currency = tier.currency_code || event.currency_code || "USD";
  const hasFiat = fiatPrice > 0;

  // Buyer's $RHOZE balance → tier → discount
  const { data: buyerBalance } = useQuery({
    queryKey: ["buyer-rhoze-balance", user?.id],
    enabled: !!user && hasFiat,
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
  const rhoze = hasFiat ? fiatToRhoze(fiatPrice, buyerTier) : Number(tier.price_rhoze) || 0;
  const hasRhoze = rhoze > 0;

  const defaultTab = useMemo(() => (hasFiat ? "usd" : "rhoze"), [hasFiat]);
  const [tab, setTab] = useState<"usd" | "rhoze">(defaultTab);
  useEffect(() => setTab(defaultTab), [defaultTab]);

  const issueTicket = useMutation({
    mutationFn: async (args: {
      currency: "usd" | "rhoze";
      reference: string;
      amount: number;
    }) => {
      if (!user) throw new Error("Sign in required");
      const qr_token = `tk_${crypto.randomUUID().replace(/-/g, "")}`;
      const { data, error } = await supabase
        .from("event_tickets")
        .insert([
          {
            event_id: event.id,
            holder_id: user.id,
            tier_id: tier.id,
            qr_token,
            purchase_currency: args.currency,
            amount_paid: args.amount,
            payment_reference: args.reference,
            status: "issued",
          },
        ])
        .select()
        .single();
      if (error) throw error;

      // Increment quantity_sold (best-effort; RLS allows host-only update,
      // so this is a soft attempt — server-side trigger would be better long-term)
      await supabase
        .from("event_ticket_tiers")
        .update({ quantity_sold: tier.quantity_sold + 1 })
        .eq("id", tier.id);

      // Tier-based platform fee — no reserve.
      // Spark/Bloom 15% · Glow 10% · Play 7%. Host = gross − platform.
      if (event.host_id && args.amount > 0) {
        const { data: hostCredits } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", event.host_id)
          .maybeSingle();
        const fee = getPlatformFeeFromBalance(Number(hostCredits?.balance) || 0);
        const platform_amount = +(args.amount * fee).toFixed(4);
        const host_amount = +(args.amount - platform_amount).toFixed(4);
        await supabase.from("event_ticket_settlements").insert([{
          ticket_id: data.id,
          event_id: event.id,
          host_id: event.host_id,
          buyer_id: user.id,
          currency: args.currency,
          gross_amount: args.amount,
          host_amount,
          reserve_amount: 0,
          platform_amount,
          payment_reference: args.reference,
        }]);
      }

      return data;
    },
    onSuccess: (ticket) => {
      toast.success("Ticket issued", {
        description: "Your QR is ready. See you at the event.",
      });
      onIssued?.();
      onOpenChange(false);
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (err: unknown) => {
      toast.error("Could not issue ticket", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const handleSquareToken = async (token: string) => {
    if (!user) {
      toast.error("Sign in to purchase");
      return;
    }
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
    await issueTicket.mutateAsync({
      currency: "usd",
      reference: data.payment_id ?? data.id ?? "square",
      amount: fiatPrice,
    });
  };

  const handleRhozeSuccess = async () => {
    const reference = `rhoze:${user?.id}:${tier.id}:${Date.now()}`;
    await issueTicket.mutateAsync({
      currency: "rhoze",
      reference,
      amount: rhoze,
    });
  };

  const fiatLabel = formatMoney(fiatPrice, currency);
  const rhozeLabel = `${rhoze.toLocaleString()} $RHOZE`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" /> {tier.name}
          </DialogTitle>
          <DialogDescription>
            {event.title}
            {tier.description ? ` — ${tier.description}` : ""}
          </DialogDescription>
        </DialogHeader>

        {hasFiat && hasRhoze ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "usd" | "rhoze")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="usd" className="gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> {fiatLabel}
              </TabsTrigger>
              <TabsTrigger value="rhoze" className="gap-1.5">
                <Coins className="h-3.5 w-3.5" /> {rhozeLabel}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="usd" className="pt-4">
              <SquareCardForm
                amount={fiatPrice}
                onTokenize={handleSquareToken}
                disabled={issueTicket.isPending}
              />
            </TabsContent>
            <TabsContent value="rhoze" className="pt-4 space-y-3">
              {discountPct > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pay <strong className="text-foreground">{rhozeLabel}</strong> from your wallet —
                  <span className="text-primary"> {Math.round(discountPct * 100)}% {buyerTier} discount</span> applied
                  ({fiatLabel} → {fiatToRhoze(fiatPrice)} $RHOZE without discount).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pay {rhozeLabel} from your wallet. Hold more $RHOZE to unlock tier discounts
                  (Bloom 5% · Glow 10% · Play 15%).
                </p>
              )}
              <PayWithRhozeButton
                tokenAmount={rhoze}
                description={`Event ticket: ${event.title} — ${tier.name}`}
                type="event_ticket"
                intent="subscription"
                onSuccess={handleRhozeSuccess}
                label={`Pay ${rhozeLabel}`}
                className="w-full"
                variant="default"
                disabled={issueTicket.isPending}
              />
            </TabsContent>
          </Tabs>
        ) : hasFiat ? (
          <SquareCardForm
            amount={fiatPrice}
            onTokenize={handleSquareToken}
            disabled={issueTicket.isPending}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pay {rhozeLabel} from your connected wallet. Your transfer is
              verified on-chain before the ticket is issued.
            </p>
            <PayWithRhozeButton
              tokenAmount={rhoze}
              description={`Event ticket: ${event.title} — ${tier.name}`}
              type="event_ticket"
              intent="subscription"
              onSuccess={handleRhozeSuccess}
              label={`Pay ${rhozeLabel}`}
              className="w-full"
              variant="default"
              disabled={issueTicket.isPending}
            />
          </div>
        )}

        {issueTicket.isPending && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Issuing your ticket…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketCheckoutDialog;
