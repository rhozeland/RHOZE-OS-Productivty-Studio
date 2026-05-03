/**
 * HostFiatPayoutPanel — fiat earnings + manual cashout for event/Spaces hosts.
 *
 * Reads `get_host_fiat_earnings` to display gross/net/available + pending+paid
 * payouts grouped by currency. Hosts request a payout via `request_host_payout`
 * which lands in an admin queue (5–8 day manual processing window).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Loader2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/event-currency";

interface Earning {
  currency_code: string;
  gross: number;
  host_net: number;
  platform_fee: number;
  ticket_count: number;
  pending_payouts: number;
  paid_payouts: number;
  available: number;
}

const MIN_PAYOUT = 10;

const HostFiatPayoutPanel = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState<"bank_transfer" | "paypal">("bank_transfer");
  const [details, setDetails] = useState("");

  const { data: earnings = [], isLoading } = useQuery({
    queryKey: ["host-fiat-earnings", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Earning[]> => {
      const { data, error } = await (supabase as any).rpc("get_host_fiat_earnings", { _host_id: user!.id });
      if (error) throw error;
      return (data ?? []) as Earning[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["host-payout-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("host_payout_requests")
        .select("*")
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const payout = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt < MIN_PAYOUT) throw new Error(`Minimum payout is ${formatMoney(MIN_PAYOUT, currency)}`);
      const { error } = await (supabase as any).rpc("request_host_payout", {
        _amount: amt,
        _currency_code: currency,
        _payout_method: method,
        _payout_details: details ? { account: details } : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout requested", { description: "Manual processing — funds in 5–8 business days." });
      setAmount("");
      setDetails("");
      qc.invalidateQueries({ queryKey: ["host-fiat-earnings", user?.id] });
      qc.invalidateQueries({ queryKey: ["host-payout-requests", user?.id] });
    },
    onError: (err: unknown) =>
      toast.error("Could not request payout", {
        description: err instanceof Error ? err.message : "Unknown error",
      }),
  });

  if (!user) return null;

  const selectedEarning = earnings.find((e) => e.currency_code === currency);
  const available = Number(selectedEarning?.available ?? 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Fiat earnings
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Customer ticket payments settle here. Request a manual payout — funds arrive in 5–8 business days.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border p-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : earnings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No paid ticket sales yet. Earnings will show here as soon as guests check out.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {earnings.map((e) => (
            <button
              type="button"
              key={e.currency_code}
              onClick={() => setCurrency(e.currency_code)}
              className={`text-left rounded-xl border p-4 space-y-2 transition-colors ${
                currency === e.currency_code ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{e.currency_code}</p>
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-display text-2xl font-bold">{formatMoney(Number(e.available), e.currency_code)}</p>
              <p className="text-[11px] text-muted-foreground">
                available · {Number(e.ticket_count)} tickets · {formatMoney(Number(e.host_net), e.currency_code)} earned
              </p>
              {Number(e.pending_payouts) > 0 && (
                <p className="text-[11px] text-amber-500">
                  {formatMoney(Number(e.pending_payouts), e.currency_code)} pending payout
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
        <p className="text-sm font-medium">Request a payout</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount ({currency})</Label>
            <Input
              type="number"
              min={MIN_PAYOUT}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`min ${MIN_PAYOUT}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs">Account / email</Label>
            <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Account ref / paypal@email" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            Available: <strong className="text-foreground">{formatMoney(available, currency)}</strong>
          </p>
          <Button
            size="sm"
            className="rounded-full"
            disabled={payout.isPending || !amount || Number(amount) > available}
            onClick={() => payout.mutate()}
          >
            {payout.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Request payout"}
          </Button>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent requests</p>
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{formatMoney(Number(r.amount), r.currency_code)} · {r.payout_method.replace("_", " ")}</p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</p>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${
                  r.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : r.status === "rejected" || r.status === "cancelled"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-500"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HostFiatPayoutPanel;
