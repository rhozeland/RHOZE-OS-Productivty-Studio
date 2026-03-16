import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  CreditCard,
  Wallet,
  Clock,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { format, setHours, setMinutes, addHours } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

type Step = "datetime" | "payment" | "confirm";
type PaymentMethod = "credits" | "card" | "crypto";

type StaffMember = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  specialties: string[];
  is_available: boolean;
};

interface BookingCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: {
    id: string;
    title: string;
    category: string;
    credits_cost: number;
    duration_hours: number;
    non_member_rate: number | null;
    description: string | null;
  } | null;
  userCredits: number;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10; // 10am - 9pm
  const min = (i % 2) * 30;
  if (hour > 21) return null;
  return { hour, min, label: format(setMinutes(setHours(new Date(), hour), min), "h:mm a") };
}).filter(Boolean) as { hour: number; min: number; label: string }[];

const CREDIT_RATE = 75;

const BookingCheckoutModal = ({ open, onOpenChange, service, userCredits }: BookingCheckoutModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("datetime");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credits");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Fetch available staff members
  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("*")
        .eq("is_available", true)
        .order("display_name");
      return (data as StaffMember[]) || [];
    },
  });

  const resetForm = () => {
    setStep("datetime");
    setSelectedDate(undefined);
    setSelectedTime("");
    setPaymentMethod("credits");
    setNotes("");
    setLoading(false);
    setCardToken(null);
    setSelectedStaffId(null);
  };

  if (!service) return null;

  const usdPrice = service.credits_cost * CREDIT_RATE;
  const solPrice = +(usdPrice / 150).toFixed(4); // rough SOL estimate
  const hasEnoughCredits = userCredits >= service.credits_cost;

  const canProceedFromDatetime = selectedDate && selectedTime;

  const getStartTime = () => {
    if (!selectedDate || !selectedTime) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    return setMinutes(setHours(selectedDate, h), m);
  };

  const handleConfirm = async (tokenOverride?: string) => {
    if (!user || !service) return;
    const startTime = getStartTime();
    if (!startTime) return;

    setLoading(true);
    try {
      // Process payment based on method
      if (paymentMethod === "credits") {
        if (!hasEnoughCredits) {
          toast.error("Not enough credits");
          setLoading(false);
          return;
        }
        const { error: creditError } = await supabase
          .from("user_credits")
          .update({ balance: userCredits - service.credits_cost })
          .eq("user_id", user.id);
        if (creditError) throw creditError;

        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: -service.credits_cost,
          type: "usage",
          description: `Booking: ${service.title}`,
        });
      } else if (paymentMethod === "card") {
        const token = tokenOverride || cardToken;
        if (!token) {
          toast.error("Please enter your card details");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("square-payment", {
          body: {
            amount_cents: usdPrice * 100,
            currency: "USD",
            description: `Rhozeland: ${service.title}`,
            source_id: token,
            location_id: SQUARE_LOCATION_ID,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Payment failed");
      }

      // Create booking
      const endTime = addHours(startTime, service.duration_hours);
      const { error: bookingError } = await supabase.from("bookings").insert({
        user_id: user.id,
        service_id: service.id,
        title: service.title,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_hours: service.duration_hours,
        notes: notes || null,
        status: "upcoming",
      });
      if (bookingError) throw bookingError;

      // Auto-create calendar event
      await supabase.from("calendar_events").insert({
        user_id: user.id,
        title: `📅 ${service.title}`,
        description: `Booked via checkout · ${service.duration_hours}h · ${paymentMethod}`,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: "#2dd4a8",
      });

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      // Send confirmation email (fire-and-forget, don't block checkout)
      const timeSlot = TIME_SLOTS.find(s => `${s.hour}:${s.min.toString().padStart(2, "0")}` === selectedTime);
      supabase.functions.invoke("send-booking-confirmation", {
        body: {
          to_email: user.email,
          user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
          service_title: service.title,
          date: format(selectedDate!, "MMMM d, yyyy"),
          time: timeSlot?.label || selectedTime,
          duration_hours: service.duration_hours,
          payment_method: paymentMethod,
          payment_amount: paymentMethod === "credits" ? `${service.credits_cost} credits` : paymentMethod === "card" ? `$${usdPrice}` : `~${solPrice} SOL`,
          notes: notes || undefined,
        },
      }).catch((err) => console.error("Confirmation email failed:", err));

      toast.success("Booking confirmed!");
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCardTokenize = async (token: string) => {
    setCardToken(token);
    await handleConfirm(token);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Book: {service.title}</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          {(["datetime", "payment", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                step === s ? "bg-primary text-primary-foreground" :
                  (["datetime", "payment", "confirm"].indexOf(step) > i)
                    ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {["datetime", "payment", "confirm"].indexOf(step) > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < 2 && <div className={cn("h-0.5 flex-1 rounded", step === s || ["datetime", "payment", "confirm"].indexOf(step) > i ? "bg-primary/30" : "bg-muted")} />}
            </div>
          ))}
        </div>

        {/* Service summary bar */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border p-3">
          <div>
            <Badge variant="secondary" className="capitalize text-xs mb-1">{service.category}</Badge>
            <p className="text-sm font-medium text-foreground">{service.title}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{service.credits_cost} cr</p>
            <p className="text-xs text-muted-foreground">${usdPrice}</p>
          </div>
        </div>

        {/* Step 1: Date & Time */}
        {step === "datetime" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Date</label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className={cn("rounded-lg border border-border pointer-events-auto")}
              />
            </div>

            {selectedDate && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Time ({service.duration_hours}h session)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const val = `${slot.hour}:${slot.min.toString().padStart(2, "0")}`;
                    const isSelected = selectedTime === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setSelectedTime(val)}
                        className={cn(
                          "rounded-lg px-2 py-2 text-xs font-medium transition-all border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!canProceedFromDatetime}
              onClick={() => setStep("payment")}
            >
              Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === "payment" && (
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground block">Choose Payment Method</label>

            <div className="grid gap-3">
              {/* Credits */}
              <button
                onClick={() => setPaymentMethod("credits")}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 transition-all text-left",
                  paymentMethod === "credits" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Coins className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pay with Credits</p>
                  <p className="text-xs text-muted-foreground">
                    {service.credits_cost} credits • Balance: {userCredits} cr
                    {!hasEnoughCredits && " (insufficient)"}
                  </p>
                </div>
                {paymentMethod === "credits" && <Check className="h-5 w-5 text-primary" />}
              </button>

              {/* Card (Square) */}
              <button
                onClick={() => setPaymentMethod("card")}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 transition-all text-left",
                  paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pay with Card</p>
                  <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex • ${usdPrice}</p>
                </div>
                {paymentMethod === "card" && <Check className="h-5 w-5 text-primary" />}
              </button>

              {/* Crypto */}
              <button
                onClick={() => setPaymentMethod("crypto")}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 transition-all text-left",
                  paymentMethod === "crypto" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pay with SOL</p>
                  <p className="text-xs text-muted-foreground">~{solPrice} SOL via Phantom/Solflare</p>
                </div>
                {paymentMethod === "crypto" && <Check className="h-5 w-5 text-primary" />}
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Notes (optional)</label>
              <Textarea
                placeholder="Describe your project or session goals..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("datetime")} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("confirm")}
                disabled={paymentMethod === "credits" && !hasEnoughCredits}
              >
                Review Order <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border divide-y divide-border">
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-muted-foreground">Service</span>
                <span className="text-sm font-medium text-foreground">{service.title}</span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="text-sm font-medium text-foreground">
                  {selectedDate && format(selectedDate, "MMM d, yyyy")}
                  {selectedTime && ` at ${TIME_SLOTS.find(s => `${s.hour}:${s.min.toString().padStart(2, "0")}` === selectedTime)?.label}`}
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {service.duration_hours}h
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-muted-foreground">Payment</span>
                <span className="text-sm font-medium text-foreground capitalize flex items-center gap-1">
                  {paymentMethod === "credits" && <><Coins className="h-3.5 w-3.5 text-primary" /> {service.credits_cost} credits</>}
                  {paymentMethod === "card" && <><CreditCard className="h-3.5 w-3.5 text-blue-500" /> ${usdPrice}</>}
                  {paymentMethod === "crypto" && <><Wallet className="h-3.5 w-3.5 text-orange-500" /> ~{solPrice} SOL</>}
                </span>
              </div>
              {notes && (
                <div className="p-3">
                  <span className="text-sm text-muted-foreground">Notes</span>
                  <p className="text-sm text-foreground mt-1">{notes}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
              <CalendarDays className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                A calendar event will be automatically created for this session.
              </p>
            </div>

            {/* Square card form for card payments */}
            {paymentMethod === "card" && (
              <SquareCardForm
                amount={usdPrice}
                onTokenize={handleCardTokenize}
                disabled={loading}
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("payment")} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              {paymentMethod === "crypto" ? (
                <PaySolAndVerify
                  solAmount={solPrice}
                  creditsToAdd={0}
                  description={`Booking: ${service.title}`}
                  type="usage"
                  label={`Pay ${solPrice} SOL & Book`}
                  className="flex-1"
                  onSuccess={() => handleConfirm()}
                />
              ) : paymentMethod === "credits" ? (
                <Button
                  className="flex-1"
                  onClick={() => handleConfirm()}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Check className="mr-2 h-4 w-4" /> Confirm Booking</>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingCheckoutModal;
