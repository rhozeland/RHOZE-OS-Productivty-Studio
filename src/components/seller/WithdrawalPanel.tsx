import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wallet, ArrowDownToLine, Loader2, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { format, addBusinessDays } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MINIMUM_WITHDRAWAL = 10;

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  processing: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const payoutMethods = [
  { value: "bank_transfer", label: "Bank Transfer (ACH)", placeholder: "Bank name, routing number, account number" },
  { value: "paypal", label: "PayPal", placeholder: "PayPal email address" },
  { value: "cashapp", label: "Cash App", placeholder: "Cash App $cashtag" },
  { value: "zelle", label: "Zelle", placeholder: "Zelle email or phone number" },
];

const WithdrawalPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const { data: balance } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .single();
      return Number(data?.balance ?? 0);
    },
    enabled: !!user,
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const pendingAmount = (withdrawals ?? [])
    .filter((w: any) => ["pending", "approved", "processing"].includes(w.status))
    .reduce((s: number, w: any) => s + Number(w.amount), 0);

  const available = (balance ?? 0) - pendingAmount;

  const selectedMethod = payoutMethods.find((m) => m.value === payoutMethod)!;
  const numAmount = Number(amount);
  const canSubmit = numAmount >= MINIMUM_WITHDRAWAL && numAmount <= available && payoutDetails.trim().length > 0 && recipientName.trim().length > 0;

  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_withdrawal", {
        _user_id: user!.id,
        _amount: numAmount,
        _payout_method: payoutMethod,
        _payout_details: {
          recipient_name: recipientName.trim(),
          account_info: payoutDetails.trim(),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", user?.id] });
      setDialogOpen(false);
      setAmount("");
      setPayoutDetails("");
      setRecipientName("");
      toast.success("Withdrawal request submitted! Review takes 3-5 business days.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const estimatedApproval = format(addBusinessDays(new Date(), 5), "MMM d, yyyy");
  const estimatedDelivery = format(addBusinessDays(new Date(), 8), "MMM d, yyyy");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Wallet & Withdrawals
          </span>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Withdraw
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Balance</p>
            <p className="text-lg font-bold text-foreground">{fmt(balance ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-amber-600">{fmt(pendingAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</p>
            <p className="text-lg font-bold text-emerald-600">{fmt(available)}</p>
          </div>
        </div>

        {/* Recent withdrawals */}
        {withdrawals && withdrawals.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Requests</p>
            {withdrawals.slice(0, 5).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[w.status])}>
                      {w.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{w.payout_method.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(w.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <span className="text-sm font-bold text-foreground">{fmt(Number(w.amount))}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No withdrawal requests yet.</p>
        )}

        {/* Withdraw dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
                Request Withdrawal
              </DialogTitle>
              <DialogDescription>
                Withdraw your earnings. Available: <strong>{fmt(available)}</strong>.
                Minimum withdrawal is {fmt(MINIMUM_WITHDRAWAL)}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min={MINIMUM_WITHDRAWAL}
                    max={available}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`${MINIMUM_WITHDRAWAL}.00`}
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout Method</label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {payoutMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Recipient Name
                </label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Legal name on the account"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Account Details
                </label>
                <Input
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  placeholder={selectedMethod.placeholder}
                />
              </div>

              {/* Timeline info */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Estimated Timeline
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Review & Approval</p>
                    <p className="font-medium text-foreground">3-5 business days</p>
                    <p className="text-[10px] text-muted-foreground">by {estimatedApproval}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payout Delivery</p>
                    <p className="font-medium text-foreground">1-3 days after</p>
                    <p className="text-[10px] text-muted-foreground">by {estimatedDelivery}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Funds are held securely until admin review is complete. You'll be notified at each step of the process.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => requestWithdrawal.mutate()}
                disabled={!canSubmit || requestWithdrawal.isPending}
                className="gap-1.5"
              >
                {requestWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                Request {amount ? fmt(numAmount) : "Withdrawal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default WithdrawalPanel;
