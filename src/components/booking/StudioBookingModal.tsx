import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CreditCard,
  Wallet,
  Clock,
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import {
  format,
  setHours,
  setMinutes,
  addHours,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

type Step = "schedule" | "details" | "payment";
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

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8am - 10pm

const StudioBookingModal = ({ open, onOpenChange, studio }: StudioBookingModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("schedule");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [notes, setNotes] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cardToken, setCardToken] = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [dragDate, setDragDate] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch studio staff
  const { data: staffMembers } = useQuery({
    queryKey: ["studio-staff", studio?.id],
    queryFn: async () => {
      // Staff members are linked via user-based association — for now fetch all available staff
      const { data } = await supabase
        .from("staff_members")
        .select("*")
        .eq("is_available", true);
      return data ?? [];
    },
    enabled: !!studio && open,
  });

  // Fetch existing bookings for this studio to show occupied slots
  const { data: existingBookings } = useQuery({
    queryKey: ["studio-bookings-week", studio?.id, weekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      const { data } = await supabase
        .from("studio_bookings")
        .select("*")
        .eq("studio_id", studio!.id)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .neq("status", "cancelled");
      return data ?? [];
    },
    enabled: !!studio && open,
  });

  const resetForm = () => {
    setStep("schedule");
    setPaymentMethod("card");
    setNotes("");
    setGuestCount(1);
    setSelectedStaffId(null);
    setLoading(false);
    setCardToken(null);
    resetDrag();
  };

  const resetDrag = () => {
    setIsDragging(false);
    setDragDay(null);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDate(null);
  };

  const resolveSlotFromTouch = useCallback((touch: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const slotEl = el.closest("[data-bslot]") as HTMLElement | null;
    if (!slotEl) return null;
    const dayIndex = Number(slotEl.dataset.bday);
    const hour = Number(slotEl.dataset.bhour);
    if (isNaN(dayIndex) || isNaN(hour)) return null;
    return { dayIndex, hour };
  }, []);

  const handleTouchMoveHandler = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const slot = resolveSlotFromTouch(touch);
      if (slot && slot.dayIndex === dragDay) {
        setDragEndHour(slot.hour);
      }
    },
    [isDragging, dragDay, resolveSlotFromTouch]
  );

  useEffect(() => {
    const handler = () => {
      if (isDragging) setIsDragging(false);
    };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [isDragging]);

  if (!studio) return null;

  const selectedDuration =
    dragStartHour !== null && dragEndHour !== null
      ? Math.abs(dragEndHour - dragStartHour) + 1
      : 0;
  const totalPrice = studio.hourly_rate * selectedDuration;
  const solPrice = +(totalPrice / 150).toFixed(4);
  const maxGuests = studio.max_guests ?? 10;

  const canProceedToDetails = dragDate && dragStartHour !== null && dragEndHour !== null && selectedDuration > 0;

  const isSlotBooked = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    return (
      existingBookings?.some((b) => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        if (!isSameDay(bStart, day)) return false;
        return hour >= bStart.getHours() && hour < bEnd.getHours();
      }) ?? false
    );
  };

  // Drag handlers
  const handleMouseDown = (dayIndex: number, hour: number) => {
    if (isSlotBooked(dayIndex, hour)) return;
    setIsDragging(true);
    setDragDay(dayIndex);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setDragDate(weekDays[dayIndex]);
  };

  const handleMouseEnter = (dayIndex: number, hour: number) => {
    if (isDragging && dayIndex === dragDay && !isSlotBooked(dayIndex, hour)) {
      setDragEndHour(hour);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (dayIndex: number, hour: number, e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown(dayIndex, hour);
  };

  const isSlotSelected = (dayIndex: number, hour: number) => {
    if (dragDay !== dayIndex || dragStartHour === null || dragEndHour === null) return false;
    const minH = Math.min(dragStartHour, dragEndHour);
    const maxH = Math.max(dragStartHour, dragEndHour);
    return hour >= minH && hour <= maxH;
  };


  const getStartTime = () => {
    if (!dragDate || dragStartHour === null || dragEndHour === null) return null;
    const startH = Math.min(dragStartHour, dragEndHour);
    return setMinutes(setHours(dragDate, startH), 0);
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
            description: `Rhozeland Studio: ${studio.name} — ${selectedDuration}h`,
            source_id: token,
            location_id: SQUARE_LOCATION_ID,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Payment failed");
      }

      const endTime = addHours(startTime, selectedDuration);

      const { error: bookingError } = await supabase.from("studio_bookings").insert({
        user_id: user.id,
        studio_id: studio.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: totalPrice,
        guest_count: guestCount,
        notes: [
          notes || null,
          selectedStaffId ? `Staff: ${staffMembers?.find((s) => s.id === selectedStaffId)?.display_name}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
        status: "confirmed",
        payment_method: paymentMethod,
      });
      if (bookingError) throw bookingError;

      await supabase.from("calendar_events").insert({
        user_id: user.id,
        title: `🏛️ ${studio.name}`,
        description: `Studio booking · ${selectedDuration}h · ${guestCount} guest(s)`,
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Book: {studio.name}</DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-2">
          {(["schedule", "details", "payment"] as Step[]).map((s, i) => {
            const stepLabels = ["Schedule", "Details", "Payment"];
            const stepIdx = ["schedule", "details", "payment"].indexOf(step);
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : stepIdx > i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {stepIdx > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{stepLabels[i]}</span>
                {i < 2 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded",
                      stepIdx > i ? "bg-primary/30" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Price bar */}
        {selectedDuration > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{studio.name}</p>
              <p className="text-xs text-muted-foreground">
                ${studio.hourly_rate}/hr × {selectedDuration}h
              </p>
            </div>
            <p className="text-xl font-bold text-primary">${totalPrice}</p>
          </div>
        )}

        {/* ═══════ Step 1: Drag Calendar ═══════ */}
        {step === "schedule" && (
          <div className="space-y-4">
            {/* Week nav */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-semibold text-foreground">
                {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
              </h3>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Grid */}
            <div
              ref={gridRef}
              className="grid border border-border rounded-lg overflow-hidden select-none max-h-[360px] overflow-y-auto"
              style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
              onMouseLeave={() => {
                if (isDragging) handleMouseUp();
              }}
            >
              {/* Header row */}
              <div className="bg-muted/30 border-b border-r border-border" />
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-1.5 text-center border-b border-r border-border bg-muted/30",
                    isSameDay(day, new Date()) && "bg-primary/10"
                  )}
                >
                  <div className="text-[10px] text-muted-foreground">{format(day, "EEE")}</div>
                  <div
                    className={cn(
                      "text-xs font-semibold",
                      isSameDay(day, new Date()) ? "text-primary" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}

              {/* Time slots */}
              {HOURS.map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  <div
                    className="flex items-start justify-end pr-1 pt-0.5 text-[10px] text-muted-foreground border-r border-b border-border bg-muted/10"
                    style={{ height: 40 }}
                  >
                    {format(setHours(new Date(), hour), "ha").toLowerCase()}
                  </div>
                  {weekDays.map((_, dayIndex) => {
                    const booked = isSlotBooked(dayIndex, hour);
                    const selected = isSlotSelected(dayIndex, hour);
                    const isPast =
                      weekDays[dayIndex] < new Date() &&
                      !isSameDay(weekDays[dayIndex], new Date());

                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        data-bslot
                        data-bday={dayIndex}
                        data-bhour={hour}
                        className={cn(
                          "border-r border-b border-border relative transition-colors cursor-pointer touch-none",
                          booked
                            ? "bg-destructive/10 cursor-not-allowed"
                            : isPast
                            ? "bg-muted/20 cursor-not-allowed"
                            : selected
                            ? "bg-primary/25"
                            : "hover:bg-muted/20"
                        )}
                        style={{ height: 40 }}
                        onMouseDown={() =>
                          !booked && !isPast && handleMouseDown(dayIndex, hour)
                        }
                        onMouseEnter={() => handleMouseEnter(dayIndex, hour)}
                        onTouchStart={(e) =>
                          !booked && !isPast && handleTouchStart(dayIndex, hour, e)
                        }
                        onTouchMove={handleTouchMoveHandler}
                        onTouchEnd={handleMouseUp}
                      >
                        {booked && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-0.5 w-3/4 rounded-full bg-destructive/20" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Drag across time slots to set your session duration
            </p>

            <Button
              className="w-full"
              disabled={!canProceedToDetails}
              onClick={() => setStep("details")}
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ═══════ Step 2: Details (staff, guests, notes) ═══════ */}
        {step === "details" && (
          <div className="space-y-5">
            {/* Time summary */}
            {dragDate && dragStartHour !== null && dragEndHour !== null && (
              <div className="rounded-lg bg-muted/50 border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {format(dragDate, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(
                    setHours(new Date(), Math.min(dragStartHour, dragEndHour)),
                    "h:mm a"
                  )}{" "}
                  –{" "}
                  {format(
                    setHours(new Date(), Math.max(dragStartHour, dragEndHour) + 1),
                    "h:mm a"
                  )}{" "}
                  ({selectedDuration} hour{selectedDuration !== 1 ? "s" : ""})
                </p>
              </div>
            )}

            {/* Staff selection */}
            {staffMembers && staffMembers.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Work with a specialist (optional)
                </label>
                <div className="grid gap-2 max-h-40 overflow-y-auto">
                  {staffMembers.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() =>
                        setSelectedStaffId(selectedStaffId === staff.id ? null : staff.id)
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-all text-left",
                        selectedStaffId === staff.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={staff.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs font-semibold bg-muted">
                          {staff.display_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {staff.display_name}
                        </p>
                        {staff.specialties && staff.specialties.length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {staff.specialties.join(", ")}
                          </p>
                        )}
                      </div>
                      {selectedStaffId === staff.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Guests — numeric input */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                <Users className="inline h-3.5 w-3.5 mr-1" /> Guests
                <span className="text-muted-foreground font-normal ml-1">(max {maxGuests})</span>
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  disabled={guestCount <= 1}
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={maxGuests}
                  value={guestCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setGuestCount(Math.min(maxGuests, Math.max(1, v)));
                  }}
                  className="w-20 text-center font-semibold"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  disabled={guestCount >= maxGuests}
                  onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Notes (optional)
              </label>
              <Textarea
                placeholder="Describe your session goals..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("schedule")} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button className="flex-1" onClick={() => setStep("payment")}>
                Payment <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ Step 3: Payment ═══════ */}
        {step === "payment" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/30">
              <h3 className="font-display font-semibold text-foreground">Booking Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Studio</span>
                <span className="text-foreground font-medium">{studio.name}</span>
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground font-medium">
                  {dragDate ? format(dragDate, "MMM d, yyyy") : ""}
                </span>
                <span className="text-muted-foreground">Time</span>
                <span className="text-foreground font-medium">
                  {dragStartHour !== null && dragEndHour !== null
                    ? `${format(setHours(new Date(), Math.min(dragStartHour, dragEndHour)), "h:mm a")} – ${format(setHours(new Date(), Math.max(dragStartHour, dragEndHour) + 1), "h:mm a")}`
                    : ""}
                </span>
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground font-medium">{selectedDuration} hours</span>
                <span className="text-muted-foreground">Guests</span>
                <span className="text-foreground font-medium">{guestCount}</span>
                {selectedStaffId && staffMembers && (
                  <>
                    <span className="text-muted-foreground">Specialist</span>
                    <span className="text-foreground font-medium">
                      {staffMembers.find((s) => s.id === selectedStaffId)?.display_name}
                    </span>
                  </>
                )}
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="font-medium text-foreground">Total</span>
                <span className="font-display text-xl font-bold text-primary">
                  {paymentMethod === "card" ? `$${totalPrice}` : `~${solPrice} SOL`}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid gap-3">
              <button
                onClick={() => setPaymentMethod("card")}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 transition-all text-left",
                  paymentMethod === "card"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pay with Card</p>
                  <p className="text-xs text-muted-foreground">
                    Visa, Mastercard, Amex • ${totalPrice}
                  </p>
                </div>
                {paymentMethod === "card" && <Check className="h-5 w-5 text-primary" />}
              </button>

              <button
                onClick={() => setPaymentMethod("crypto")}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-4 transition-all text-left",
                  paymentMethod === "crypto"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Wallet className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pay with SOL</p>
                  <p className="text-xs text-muted-foreground">
                    ~{solPrice} SOL via Phantom/Solflare
                  </p>
                </div>
                {paymentMethod === "crypto" && <Check className="h-5 w-5 text-primary" />}
              </button>
            </div>

            {/* Payment form */}
            {paymentMethod === "card" ? (
              <SquareCardForm amount={totalPrice} onTokenize={handleCardTokenize} disabled={loading} />
            ) : (
              <PaySolAndVerify
                solAmount={solPrice}
                creditsToAdd={0}
                description={`Studio: ${studio.name} — ${selectedDuration}h`}
                label={`Pay ~${solPrice} SOL`}
                className="w-full"
                onSuccess={() => handleConfirm()}
              />
            )}

            <Button variant="outline" onClick={() => setStep("details")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudioBookingModal;
