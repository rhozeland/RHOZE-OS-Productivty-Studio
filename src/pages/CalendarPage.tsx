import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Clock, X, CalendarDays, RefreshCw, Coins, CreditCard, Wallet, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";
import PaySolAndVerify from "@/components/PaySolAndVerify";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  setHours,
  setMinutes,
} from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type ViewMode = "month" | "week";
type TabMode = "upcoming" | "history" | "cancelled";
type PaymentMethod = "credits" | "card" | "crypto";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  source: "google";
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am - 8pm

const CalendarPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(searchParams.get("service") ? "week" : "month");
  const [activeTab, setActiveTab] = useState<TabMode>("upcoming");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(searchParams.get("service") || "");
  const [bookingNotes, setBookingNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credits");
  const [bookingLoading, setBookingLoading] = useState(false);
  // Google Calendar
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Drag state for weekly view
  const [isDragging, setIsDragging] = useState(false);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [dragDate, setDragDate] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, services(title, category, credits_cost)")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: calendarEvents } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const createBookingWithPayment = async (cardToken?: string) => {
    if (!dragDate || dragStartHour === null || dragEndHour === null || !user) return;
    const startH = Math.min(dragStartHour, dragEndHour);
    const endH = Math.max(dragStartHour, dragEndHour) + 1;
    const start = setMinutes(setHours(dragDate, startH), 0);
    const end = setMinutes(setHours(dragDate, endH), 0);
    const service = services?.find((s) => s.id === selectedService);
    const duration = endH - startH;

    setBookingLoading(true);
    try {
      // Validate early (before any side effects)
      if (paymentMethod === "credits" && service) {
        const balance = userCredits?.balance ?? 0;
        if (balance < service.credits_cost) {
          toast.error("Not enough credits");
          setBookingLoading(false);
          return;
        }
      } else if (paymentMethod === "card" && service) {
        if (!cardToken) {
          toast.error("Please enter your card details");
          setBookingLoading(false);
          return;
        }
      }

      // Process card payment first (non-reversible external call)
      if (paymentMethod === "card" && service) {
        const usdPrice = service.non_member_rate ?? 0;
        const { data, error } = await supabase.functions.invoke("square-payment", {
          body: {
            amount_cents: Math.round(usdPrice * 100),
            currency: "USD",
            description: `Rhozeland: ${service.title}`,
            source_id: cardToken,
            location_id: SQUARE_LOCATION_ID,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Payment failed");
      }
      // crypto is handled by PaySolAndVerify callback

      // Create booking first so we don't lose credits on insert failure
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        service_id: selectedService || null,
        title: service?.title || "Studio Booking",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: duration,
        notes: bookingNotes || null,
        status: "upcoming",
      });
      if (error) throw error;

      // Deduct credits atomically after successful booking
      if (paymentMethod === "credits" && service) {
        // Use atomic decrement to avoid race conditions
        const { error: deductError } = await supabase
          .from("user_credits")
          .update({ balance: (userCredits?.balance ?? 0) - service.credits_cost, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (deductError) {
          console.error("Credit deduction failed:", deductError);
          toast.error("Credit deduction failed — please contact support");
        }

        const { error: txError } = await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: -service.credits_cost,
          type: "usage",
          description: `Booking: ${service.title} (${duration}h)`,
          payment_method: "credits",
        });
        if (txError) console.error("Transaction log failed:", txError);
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });

      // Send confirmation email with payment method
      if (user.email && service) {
        const paymentLabel = paymentMethod === "credits"
          ? "Credits"
          : paymentMethod === "card"
          ? "Card (Square)"
          : "SOL (Crypto)";
        const paymentAmountStr = paymentMethod === "credits"
          ? `${service.credits_cost} credits`
          : paymentMethod === "card"
          ? `$${(service.non_member_rate ?? 0).toFixed(2)}`
          : `SOL`;
        supabase.functions.invoke("send-booking-confirmation", {
          body: {
            to_email: user.email,
            user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
            service_title: service.title,
            date: format(start, "MMMM d, yyyy"),
            time: format(start, "h:mm a"),
            duration_hours: duration,
            payment_method: paymentLabel,
            payment_amount: paymentAmountStr,
            notes: bookingNotes || undefined,
          },
        }).catch((err) => console.error("Confirmation email failed:", err));
      }

      resetDrag();
      setBookingDialogOpen(false);
      setSelectedService("");
      setBookingNotes("");
      setPaymentMethod("credits");
      toast.success("Booking confirmed!");
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  const cancelBooking = useMutation({
    mutationFn: async (id: string) => {
      const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).single();
      if (!booking) throw new Error("Booking not found");
      if (new Date(booking.start_time) <= new Date()) throw new Error("Cannot cancel a booking that has already started");

      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;

      let creditsRefunded = 0;

      // Refund credits if the booking had a linked service
      if (booking.service_id && user) {
        const { data: service } = await supabase.from("services").select("credits_cost").eq("id", booking.service_id).single();
        if (service && service.credits_cost > 0) {
          const { data: creditRow } = await supabase.from("user_credits").select("balance").eq("user_id", user.id).single();
          if (creditRow) {
            await supabase.from("user_credits").update({ balance: creditRow.balance + service.credits_cost }).eq("user_id", user.id);
            await supabase.from("credit_transactions").insert({
              user_id: user.id,
              amount: service.credits_cost,
              type: "refund",
              description: `Refund: ${booking.title} (cancelled)`,
            });
            creditsRefunded = service.credits_cost;
          }
        }
      }

      return { booking, creditsRefunded };
    },
    onSuccess: ({ booking, creditsRefunded }) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      toast.success("Booking cancelled — credits refunded");

      if (booking && user?.email) {
        supabase.functions.invoke("send-booking-cancellation", {
          body: {
            to_email: user.email,
            user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
            service_title: booking.title,
            date: format(new Date(booking.start_time), "MMMM d, yyyy"),
            time: format(new Date(booking.start_time), "h:mm a"),
            duration_hours: booking.duration_hours,
            credits_refunded: creditsRefunded,
          },
        }).catch((err) => console.error("Cancellation email failed:", err));
      }
    },
  });

  const fetchGoogleCalendar = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;

      if (!providerToken) {
        toast.error("Please sign in with Google to import your calendar.");
        setGoogleLoading(false);
        return;
      }

      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();

      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { provider_token: providerToken, time_min: timeMin, time_max: timeMax },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGoogleEvents(data.events || []);
      setGoogleConnected(true);
      toast.success(`Imported ${data.events?.length ?? 0} events from Google Calendar`);
    } catch (error: any) {
      console.error("Google Calendar import error:", error);
      toast.error(error.message || "Failed to import Google Calendar");
    } finally {
      setGoogleLoading(false);
    }
  }, [currentDate]);

  const resetDrag = () => {
    setIsDragging(false);
    setDragDay(null);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDate(null);
  };

  // Week view dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  // Month view dates
  const mStart = startOfMonth(currentDate);
  const mEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: mStart, end: mEnd });
  const monthPadding = (mStart.getDay() + 6) % 7;
  const paddedMonthDays: (Date | null)[] = Array(monthPadding).fill(null).concat(monthDays);

  // Filter bookings by tab
  const now = new Date();
  const filteredBookings = bookings?.filter((b) => {
    if (activeTab === "upcoming") return b.status === "upcoming" && new Date(b.start_time) >= now;
    if (activeTab === "history") return b.status === "upcoming" && new Date(b.end_time) < now;
    if (activeTab === "cancelled") return b.status === "cancelled";
    return true;
  }) ?? [];

  // Get bookings + events for a day
  const getItemsForDay = (day: Date) => {
    const dayBookings = bookings?.filter((b) => b.status !== "cancelled" && isSameDay(new Date(b.start_time), day)) ?? [];
    const dayCalEvents = calendarEvents?.filter((e) => isSameDay(new Date(e.start_time), day)) ?? [];
    const dayGoogleEvents = googleEvents.filter((e) => isSameDay(new Date(e.start_time), day));
    return { bookings: dayBookings, events: dayCalEvents, google: dayGoogleEvents };
  };

  // Drag handlers (mouse + touch)
  const handleMouseDown = (dayIndex: number, hour: number) => {
    setIsDragging(true);
    setDragDay(dayIndex);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setDragDate(weekDays[dayIndex]);
  };

  const handleMouseEnter = (dayIndex: number, hour: number) => {
    if (isDragging && dayIndex === dragDay) setDragEndHour(hour);
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartHour !== null && dragEndHour !== null) setBookingDialogOpen(true);
    setIsDragging(false);
  };

  // Touch support: resolve which slot the finger is over
  const resolveSlotFromTouch = useCallback((touch: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const slotEl = el.closest('[data-slot]') as HTMLElement | null;
    if (!slotEl) return null;
    const dayIndex = Number(slotEl.dataset.day);
    const hour = Number(slotEl.dataset.hour);
    if (isNaN(dayIndex) || isNaN(hour)) return null;
    return { dayIndex, hour };
  }, []);

  const handleTouchStart = useCallback((dayIndex: number, hour: number, e: React.TouchEvent) => {
    e.preventDefault(); // prevent scroll while dragging
    handleMouseDown(dayIndex, hour);
  }, [weekDays]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const slot = resolveSlotFromTouch(touch);
    if (slot && slot.dayIndex === dragDay) {
      setDragEndHour(slot.hour);
    }
  }, [isDragging, dragDay, resolveSlotFromTouch]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [isDragging, dragStartHour, dragEndHour]);

  useEffect(() => {
    const handler = () => { if (isDragging) handleMouseUp(); };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [isDragging, dragStartHour, dragEndHour]);

  const isSlotSelected = (dayIndex: number, hour: number) => {
    if (dragDay !== dayIndex || dragStartHour === null || dragEndHour === null) return false;
    const minH = Math.min(dragStartHour, dragEndHour);
    const maxH = Math.max(dragStartHour, dragEndHour);
    return hour >= minH && hour <= maxH;
  };

  const isSlotBooked = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    return bookings?.some((b) => {
      if (b.status === "cancelled") return false;
      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      if (!isSameDay(bStart, day)) return false;
      return hour >= bStart.getHours() && hour < bEnd.getHours();
    }) ?? false;
  };

  const getBookingForSlot = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    return bookings?.find((b) => {
      if (b.status === "cancelled") return false;
      const bStart = new Date(b.start_time);
      if (!isSameDay(bStart, day)) return false;
      return hour === bStart.getHours();
    });
  };

  const selectedDuration = dragStartHour !== null && dragEndHour !== null
    ? Math.abs(dragEndHour - dragStartHour) + 1
    : 0;

  const selectedServiceObj = useMemo(
    () => services?.find((s) => s.id === selectedService),
    [services, selectedService]
  );

  // Fixed credit model: credits_cost is the flat session price,
  // duration_hours is the max time that credit unlocks
  const maxDragHours = selectedServiceObj ? Number(selectedServiceObj.duration_hours) : 24;
  const isOverMax = selectedDuration > maxDragHours;

  return (
    <div className="space-y-6">
      {/* Service pre-selection banner */}
      {searchParams.get("service") && selectedServiceObj && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-4">
          <Coins className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Booking: {selectedServiceObj.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedServiceObj.credits_cost} credits · up to {selectedServiceObj.duration_hours}h — drag across the week view to claim your slot
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground">Schedule and manage your creative sessions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchGoogleCalendar}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {googleConnected ? "Refresh Google" : "Import Google Calendar"}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Your Bookings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          Available
        </span>
        {googleConnected && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              Events
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#4285F4" }} />
              Google
            </span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["upcoming", "history", "cancelled"] as TabMode[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>today</Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `${format(weekDays[0], "MMM d")} – ${format(weekDays[4], "d, yyyy")}`}
          </h2>

          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(["month", "week"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Month view */}
        {viewMode === "month" && (
          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-3 text-center text-sm font-medium text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
            ))}
            {paddedMonthDays.map((day, i) => {
              const items = day ? getItemsForDay(day) : { bookings: [], events: [], google: [] };
              const totalItems = items.bookings.length + items.events.length + items.google.length;
              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-2 border-b border-r border-border cursor-pointer hover:bg-muted/20 transition-colors ${
                    day && isSameDay(day, new Date()) ? "bg-primary/5" : ""
                  } ${!day ? "bg-muted/10" : ""}`}
                  onClick={() => { if (day) { setCurrentDate(day); setViewMode("week"); } }}
                >
                  {day && (
                    <>
                      <span className={`text-sm ${
                        isSameDay(day, new Date()) ? "font-bold text-primary" :
                        !isSameMonth(day, currentDate) ? "text-muted-foreground/50" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {items.bookings.slice(0, 2).map((b) => (
                          <div key={b.id} className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                            {format(new Date(b.start_time), "ha")} {b.title}
                          </div>
                        ))}
                        {items.events.slice(0, totalItems > 2 ? 1 : 2).map((e) => (
                          <div key={e.id} className="truncate rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-foreground">
                            {e.title}
                          </div>
                        ))}
                        {items.google.slice(0, 1).map((e) => (
                          <div key={e.id} className="truncate rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "rgba(66,133,244,0.15)", color: "#4285F4" }}>
                            {e.title}
                          </div>
                        ))}
                        {totalItems > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{totalItems - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Week view with draggable slots */}
        {viewMode === "week" && (
          <div
            ref={gridRef}
            className="grid border border-border rounded-lg overflow-hidden select-none"
            style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}
            onMouseLeave={() => { if (isDragging) handleMouseUp(); }}
          >
            <div className="bg-muted/30 border-b border-r border-border" />
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`p-3 text-center border-b border-r border-border bg-muted/30 ${
                  isSameDay(day, new Date()) ? "bg-primary/10" : ""
                }`}
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                <div className={`text-sm font-semibold ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}>
                  {format(day, "M/d")}
                </div>
              </div>
            ))}

            {HOURS.map((hour) => (
              <>
                <div
                  key={`label-${hour}`}
                  className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-r border-b border-border bg-muted/10"
                  style={{ height: 60 }}
                >
                  {format(setHours(new Date(), hour), "ha").toLowerCase()}
                </div>
                {weekDays.map((_, dayIndex) => {
                  const booked = isSlotBooked(dayIndex, hour);
                  const selected = isSlotSelected(dayIndex, hour);
                  const booking = getBookingForSlot(dayIndex, hour);

                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      data-slot
                      data-day={dayIndex}
                      data-hour={hour}
                      className={cn(
                        "border-r border-b border-border relative transition-colors cursor-pointer touch-none",
                        booked
                          ? "bg-primary/10 cursor-not-allowed"
                          : selected
                          ? "bg-primary/20"
                          : "hover:bg-muted/20"
                      )}
                      style={{ height: 60 }}
                      onMouseDown={() => !booked && handleMouseDown(dayIndex, hour)}
                      onMouseEnter={() => handleMouseEnter(dayIndex, hour)}
                      onTouchStart={(e) => !booked && handleTouchStart(dayIndex, hour, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      {/* Booked indicator stripe */}
                      {booked && !booking && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-0.5 w-4/5 rounded-full bg-primary/20" />
                        </div>
                      )}
                      {booking && (
                        <div className="absolute inset-1 rounded-md bg-primary/20 border border-primary/30 px-1.5 py-0.5 overflow-hidden z-10 shadow-sm"
                          style={{ height: `${(Number(booking.duration_hours)) * 60 - 8}px` }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            <p className="text-[10px] font-semibold text-primary truncate">{booking.title}</p>
                          </div>
                          <p className="text-[9px] text-primary/70">
                            {format(new Date(booking.start_time), "h:mma")} – {format(new Date(booking.end_time), "h:mma")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        )}

        {viewMode === "week" && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Click and drag across time slots to select your booking duration
          </p>
        )}
      </div>

      {/* Booking list */}
      <div className="surface-card p-6">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 capitalize">
          {activeTab} Bookings
        </h3>
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-muted/30">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No {activeTab} bookings</p>
            <p className="text-sm text-muted-foreground mt-1">
              Switch to week view and drag to select time slots
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredBookings.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{booking.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.start_time), "EEE, MMM d · h:mma")} – {format(new Date(booking.end_time), "h:mma")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={booking.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">
                      {booking.status}
                    </Badge>
                    {(booking.status === "upcoming" || booking.status === "confirmed") && new Date(booking.start_time) > now && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => cancelBooking.mutate(booking.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Booking confirmation dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetDrag();
          if (!searchParams.get("service")) setSelectedService("");
          setBookingNotes("");
          setPaymentMethod("credits");
          setSearchParams({}, { replace: true });
        }
        setBookingDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Confirm Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dragDate && dragStartHour !== null && dragEndHour !== null && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">
                  {format(dragDate, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(setHours(new Date(), Math.min(dragStartHour, dragEndHour)), "h:mma")} – {format(setHours(new Date(), Math.max(dragStartHour, dragEndHour) + 1), "h:mma")}
                  {" "}({selectedDuration} hour{selectedDuration !== 1 ? "s" : ""})
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Service</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} — {s.credits_cost} cr · up to {s.duration_hours}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fixed credit + duration info */}
            {selectedServiceObj && selectedDuration > 0 && (
              <div className={`rounded-xl border p-4 ${isOverMax ? "bg-destructive/10 border-destructive/30" : "bg-primary/10 border-primary/20"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedDuration}h selected
                    {isOverMax && (
                      <span className="text-destructive font-medium"> (max {maxDragHours}h)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-primary font-display text-xl font-bold">
                    <Coins className="h-4 w-4" />
                    {selectedServiceObj.credits_cost} credits
                  </div>
                </div>
              </div>
            )}

            {/* Payment method selection */}
            {selectedServiceObj && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Payment Method</label>
                <div className="grid gap-2">
                  {/* Credits */}
                  <button
                    onClick={() => setPaymentMethod("credits")}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-all text-left",
                      paymentMethod === "credits" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Coins className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Pay with Credits</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedServiceObj.credits_cost} credits • Balance: {userCredits?.balance ?? 0}
                        {(userCredits?.balance ?? 0) < selectedServiceObj.credits_cost && " (insufficient)"}
                      </p>
                    </div>
                    {paymentMethod === "credits" && <Check className="h-4 w-4 text-primary" />}
                  </button>

                  {/* Card */}
                  {selectedServiceObj.non_member_rate && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-all text-left",
                        paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Pay with Card</p>
                        <p className="text-xs text-muted-foreground">
                          ${selectedServiceObj.non_member_rate} • Visa, Mastercard, Amex
                        </p>
                      </div>
                      {paymentMethod === "card" && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  )}

                  {/* SOL */}
                  <button
                    onClick={() => setPaymentMethod("crypto")}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-all text-left",
                      paymentMethod === "crypto" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                      <Wallet className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Pay with SOL</p>
                      <p className="text-xs text-muted-foreground">
                        ~{((selectedServiceObj.non_member_rate ?? selectedServiceObj.credits_cost * 75) / 150).toFixed(4)} SOL via Phantom/Solflare
                      </p>
                    </div>
                    {paymentMethod === "crypto" && <Check className="h-4 w-4 text-primary" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Notes (optional)</label>
              <Textarea placeholder="What is the project about?" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} rows={2} />
            </div>

            {/* Card form inline */}
            {paymentMethod === "card" && selectedServiceObj?.non_member_rate && (
              <SquareCardForm
                amount={selectedServiceObj.non_member_rate}
                disabled={bookingLoading}
                onTokenize={async (token) => {
                  await createBookingWithPayment(token);
                }}
              />
            )}

            {/* SOL payment */}
            {paymentMethod === "crypto" && selectedServiceObj && (
              <PaySolAndVerify
                solAmount={Number(((selectedServiceObj.non_member_rate ?? selectedServiceObj.credits_cost * 75) / 150).toFixed(4))}
                creditsToAdd={0}
                description={`Booking: ${selectedServiceObj.title}`}
                label="Pay with SOL & Book"
                onSuccess={async () => {
                  await createBookingWithPayment();
                }}
              />
            )}

            {/* Credits confirm button */}
            {paymentMethod === "credits" && (
              <Button
                className="w-full"
                onClick={() => createBookingWithPayment()}
                disabled={!selectedService || bookingLoading || isOverMax || (selectedServiceObj && (userCredits?.balance ?? 0) < selectedServiceObj.credits_cost)}
              >
                {bookingLoading ? "Processing..." : selectedServiceObj
                  ? `Book Session · ${selectedServiceObj.credits_cost} credits`
                  : "Book Session"
                }
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
