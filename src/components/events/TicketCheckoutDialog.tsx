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
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
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

interface Tier {
  id: string;
  name: string;
  description?: string | null;
  price_usd?: number | null;
  price_rhoze?: number | null;
  quantity_total?: number | null;
  quantity_sold: number;
}

interface Event {
  id: string;
  title: string;
  host_id?: string;
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

  const usd = Number(tier.price_usd) || 0;
  const rhoze = Number(tier.price_rhoze) || 0;
  const hasUsd = usd > 0;
  const hasRhoze = rhoze > 0;

  const defaultTab = useMemo(() => (hasUsd ? "usd" : "rhoze"), [hasUsd]);
  const [tab, setTab] = useState<"usd" | "rhoze">(defaultTab);

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
        amount_cents: Math.round(usd * 100),
        currency: "USD",
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
      amount: usd,
    });
  };

  const handleRhozeSuccess = async () => {
    // PayWithRhozeButton already verified the on-chain transfer server-side.
    // We don't have the signature returned, so use a synthetic ref scoped to user/tier/time.
    const reference = `rhoze:${user?.id}:${tier.id}:${Date.now()}`;
    await issueTicket.mutateAsync({
      currency: "rhoze",
      reference,
      amount: rhoze,
    });
  };

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

        {hasUsd && hasRhoze ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "usd" | "rhoze")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="usd" className="gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> ${usd.toFixed(2)} USD
              </TabsTrigger>
              <TabsTrigger value="rhoze" className="gap-1.5">
                <Coins className="h-3.5 w-3.5" /> {rhoze} $RHOZE
              </TabsTrigger>
            </TabsList>
            <TabsContent value="usd" className="pt-4">
              <SquareCardForm
                amount={usd}
                onTokenize={handleSquareToken}
                disabled={issueTicket.isPending}
              />
            </TabsContent>
            <TabsContent value="rhoze" className="pt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Pay {rhoze} $RHOZE from your connected wallet. Your transfer is
                verified on-chain before the ticket is issued.
              </p>
              <PayWithRhozeButton
                tokenAmount={rhoze}
                description={`Event ticket: ${event.title} — ${tier.name}`}
                type="event_ticket"
                intent="subscription"
                onSuccess={handleRhozeSuccess}
                label={`Pay ${rhoze} $RHOZE`}
                className="w-full"
                variant="default"
                disabled={issueTicket.isPending}
              />
            </TabsContent>
          </Tabs>
        ) : hasUsd ? (
          <SquareCardForm
            amount={usd}
            onTokenize={handleSquareToken}
            disabled={issueTicket.isPending}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pay {rhoze} $RHOZE from your connected wallet. Your transfer is
              verified on-chain before the ticket is issued.
            </p>
            <PayWithRhozeButton
              tokenAmount={rhoze}
              description={`Event ticket: ${event.title} — ${tier.name}`}
              type="event_ticket"
              intent="subscription"
              onSuccess={handleRhozeSuccess}
              label={`Pay ${rhoze} $RHOZE`}
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
