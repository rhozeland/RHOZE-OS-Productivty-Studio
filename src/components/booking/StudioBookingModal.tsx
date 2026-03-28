import { useState, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Wallet,
  Clock,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Users,
} from "lucide-react";
import { format, setHours, setMinutes, addHours } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

type Step = "datetime" | "payment" | "confirm";
type PaymentMethod = "card" | "crypto";

interface StudioBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: {
    id: string;
    name: string;
    hourly_rate: number;
    daily_rate: number | null;
    max_guests: number | null;
    currency: string;
  } | null;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = (i % 2) * 30;
  if (hour > 22) return null;
  return { hour, min, label: format(setMinutes(setHours(new Date(), hour), min), "h:mm a") };
}).filter(Boolean) as { hour: number; min: number; label: string }[];

const DURATION_OPTIONS = [1, 2, 3, 4, 6, 8];

const StudioBookingModal = ({ open, onOpenChange, studio }: StudioBookingModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("datetime");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [duration, setDuration] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [notes, setNotes] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cardToken, setCardToken] = useState<string | null>(null);

  const resetForm = () => {
    setStep("datetime");
    setSelectedDate(undefined);
    setSelectedTime("");
    setDuration(2);
    setPaymentMethod("card");
    setNotes("");
    setGuestCount(1);
    setLoading(false);
    setCardToken(null);
  };

  if (!studio) return null;

  const totalPrice = studio.hourly_rate * duration;
  const solPrice = +(totalPrice / 150).toFixed(4);
  const canProceed = selectedDate && selectedTime;

  const getStartTime = () => {
    if (!selectedDate || !selectedTime) return null;
    const [h, m] = selectedTime.split(":").map(Number);
    return setMinutes(setHours(selectedDate, h), m);
  };

  const handleConfirm = async (tokenOverride?: string) => {
    if (!user || !studio) return;
    const startTime = getStartTime();
    if (!startTime) return;

    setLoading(true);
    try {
      if (paymentMethod === "card") {
        const token = tokenOverride || cardToken;
        if (!token) {
          toast.error("Please enter your card details");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("square-payment", {
          body: {
            amount_cents: Math.round(totalPrice * 100),
            currency: "USD",
            description: `Rhozeland Studio: ${studio.name} — ${duration}h`,
            source_id: token,
            location_id: SQUARE_LOCATION_ID,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Payment failed");
      }
      // crypto is handled via PaySolAndVerify component directly

      const endTime = addHours(startTime, duration);

      const { error: bookingError } = await supabase.from("studio_bookings").insert({
        user_id: user.id,
        studio_id: studio.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: totalPrice,
        guest_count: guestCount,
        notes: notes || null,
        status: "confirmed",
        payment_method: paymentMethod,
      });
      if (bookingError) throw bookingError;

      // Auto-create calendar event
      await supabase.from("calendar_events").insert({
        user_id: user.id,
        title: `🏛️ ${studio.name}`,
        description: `Studio booking · ${duration}h · ${guestCount} guest(s)`,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        color: "#2dd4a8",
      });

      queryClient.invalidateQueries({ queryKey: ["studio-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      toast.success("Studio booked successfully!");
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
          <DialogTitle className="font-display text-xl">Book: {studio.name}</DialogTitle>
        </DialogHeader>

        {/* Steps */}
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

        {/* Price summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{studio.name}</p>
            <p className="text-xs text-muted-foreground">${studio.hourly_rate}/hr × {duration}h</p>
          </div>
          <p className="text-xl font-bold text-primary">${totalPrice}</p>
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
                disabled={(date) => date < new Date()}
                className="rounded-lg border border-border pointer-events-auto"
              />
            </div>

            {selectedDate && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs font-medium border transition-all",
                          duration === d
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {d}h — ${studio.hourly_rate * d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Start Time
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                    {TIME_SLOTS.map((slot) => {
                      const val = `${slot.hour}:${slot.min.toString().padStart(2, "0")}`;
                      return (
                        <button
                          key={val}
                          onClick={() => setSelectedTime(val)}
                          className={cn(
                            "rounded-lg px-2 py-2 text-xs font-medium transition-all border",
                            selectedTime === val
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

                {studio.max_guests && studio.max_guests > 1 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      <Users className="inline h-3.5 w-3.5 mr-1" /> Guests
                    </label>
                    <div className="flex gap-2">
                      {Array.from({ length: Math.min(studio.max_guests, 6) }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setGuestCount(n)}
                          className={cn(
                            "rounded-lg px-3 py-2 text-xs font-medium border transition-all",
                            guestCount === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border text-foreground hover:bg-muted"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Button className="w-full" disabled={!canProceed} onClick={() => setStep("payment")}>
              Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === "payment" && (
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground block">Choose Payment Method</label>

            <div className="grid gap-3">
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
                  <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex • ${totalPrice}</p>
                </div>
                {paymentMethod === "card" && <Check className="h-5 w-5 text-primary" />}
              </button>

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
                placeholder="Describe your session goals..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("datetime")} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button className="flex-1" onClick={() => setStep("confirm")}>
                Review <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Pay */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/30">
              <h3 className="font-display font-semibold text-foreground">Booking Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Studio</span>
                <span className="text-foreground font-medium">{studio.name}</span>
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground font-medium">{selectedDate ? format(selectedDate, "MMM d, yyyy") : ""}</span>
                <span className="text-muted-foreground">Time</span>
                <span className="text-foreground font-medium">
                  {TIME_SLOTS.find(s => `${s.hour}:${s.min.toString().padStart(2, "0")}` === selectedTime)?.label}
                </span>
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground font-medium">{duration} hours</span>
                <span className="text-muted-foreground">Guests</span>
                <span className="text-foreground font-medium">{guestCount}</span>
                <span className="text-muted-foreground">Payment</span>
                <span className="text-foreground font-medium capitalize">{paymentMethod}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-display text-xl font-bold text-primary">
                  {paymentMethod === "card" ? `$${totalPrice}` : `~${solPrice} SOL`}
                </span>
              </div>
            </div>

            {paymentMethod === "card" ? (
              <SquareCardForm amount={totalPrice} onTokenize={handleCardTokenize} disabled={loading} />
            ) : (
              <PaySolAndVerify
                solAmount={solPrice}
                creditsToAdd={0}
                description={`Studio: ${studio.name} — ${duration}h`}
                label={`Pay ~${solPrice} SOL`}
                className="w-full"
                onSuccess={() => handleConfirm()}
              />
            )}

            <Button variant="outline" onClick={() => setStep("payment")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudioBookingModal;
