import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ChevronLeft, ChevronRight, Clock, X, CalendarDays } from "lucide-react";
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

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am - 8pm

const BookingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [activeTab, setActiveTab] = useState<TabMode>("upcoming");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

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

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!dragDate || dragStartHour === null || dragEndHour === null) return;
      const startH = Math.min(dragStartHour, dragEndHour);
      const endH = Math.max(dragStartHour, dragEndHour) + 1;
      const start = setMinutes(setHours(dragDate, startH), 0);
      const end = setMinutes(setHours(dragDate, endH), 0);
      const service = services?.find((s) => s.id === selectedService);

      const { error } = await supabase.from("bookings").insert({
        user_id: user!.id,
        service_id: selectedService || null,
        title: service?.title || "Studio Booking",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: endH - startH,
        notes: bookingNotes || null,
        status: "upcoming",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      resetDrag();
      setBookingDialogOpen(false);
      setSelectedService("");
      setBookingNotes("");
      toast.success("Booking created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
    },
  });

  const resetDrag = () => {
    setIsDragging(false);
    setDragDay(null);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDate(null);
  };

  // Week view dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon-Fri

  // Month view dates
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthPadding = (monthStart.getDay() + 6) % 7; // Monday start
  const paddedMonthDays: (Date | null)[] = Array(monthPadding).fill(null).concat(monthDays);

  // Filter bookings by tab
  const now = new Date();
  const filteredBookings = bookings?.filter((b) => {
    if (activeTab === "upcoming") return b.status === "upcoming" && new Date(b.start_time) >= now;
    if (activeTab === "history") return b.status === "upcoming" && new Date(b.end_time) < now;
    if (activeTab === "cancelled") return b.status === "cancelled";
    return true;
  }) ?? [];

  // Get bookings for a specific day
  const getBookingsForDay = (day: Date) =>
    bookings?.filter((b) => b.status !== "cancelled" && isSameDay(new Date(b.start_time), day)) ?? [];

  // Drag handlers for weekly view
  const handleMouseDown = (dayIndex: number, hour: number) => {
    setIsDragging(true);
    setDragDay(dayIndex);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setDragDate(weekDays[dayIndex]);
  };

  const handleMouseEnter = (dayIndex: number, hour: number) => {
    if (isDragging && dayIndex === dragDay) {
      setDragEndHour(hour);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartHour !== null && dragEndHour !== null) {
      setBookingDialogOpen(true);
    }
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) handleMouseUp();
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Bookings</h1>
        <p className="text-muted-foreground">Schedule your creative sessions</p>
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

      {/* Calendar controls */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
              }
            >
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
              <div key={d} className="p-3 text-center text-sm font-medium text-muted-foreground bg-muted/30 border-b border-border">
                {d}
              </div>
            ))}
            {paddedMonthDays.map((day, i) => {
              const dayBookings = day ? getBookingsForDay(day) : [];
              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-2 border-b border-r border-border cursor-pointer hover:bg-muted/20 transition-colors ${
                    day && isSameDay(day, new Date()) ? "bg-primary/5" : ""
                  } ${!day ? "bg-muted/10" : ""}`}
                  onClick={() => {
                    if (day) {
                      setCurrentDate(day);
                      setViewMode("week");
                    }
                  }}
                >
                  {day && (
                    <>
                      <span className={`text-sm ${
                        isSameDay(day, new Date()) ? "font-bold text-primary" : 
                        !isSameMonth(day, currentDate) ? "text-muted-foreground/50" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </span>
                      {dayBookings.length > 0 && (
                        <div className="mt-1">
                          {dayBookings.slice(0, 2).map((b) => (
                            <div key={b.id} className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary mb-0.5">
                              {format(new Date(b.start_time), "ha")} {b.title}
                            </div>
                          ))}
                          {dayBookings.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 2} more</span>
                          )}
                        </div>
                      )}
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
            {/* Header row */}
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

            {/* Time slots */}
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
                      className={`border-r border-b border-border relative transition-colors cursor-pointer ${
                        booked
                          ? "bg-muted/40 cursor-not-allowed"
                          : selected
                          ? "bg-primary/20"
                          : "hover:bg-muted/20"
                      }`}
                      style={{ height: 60 }}
                      onMouseDown={() => !booked && handleMouseDown(dayIndex, hour)}
                      onMouseEnter={() => handleMouseEnter(dayIndex, hour)}
                    >
                      {booking && (
                        <div className="absolute inset-1 rounded bg-primary/25 border border-primary/30 px-1.5 py-0.5 overflow-hidden z-10"
                          style={{ height: `${(Number(booking.duration_hours)) * 60 - 8}px` }}
                        >
                          <p className="text-[10px] font-medium text-primary truncate">{booking.title}</p>
                          <p className="text-[9px] text-primary/70">
                            {format(new Date(booking.start_time), "h:mma")} - {format(new Date(booking.end_time), "h:mma")}
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
            <p className="text-foreground font-medium">Your booking list is empty</p>
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
                    {booking.status === "upcoming" && new Date(booking.start_time) > now && (
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
        if (!open) { resetDrag(); setSelectedService(""); setBookingNotes(""); }
        setBookingDialogOpen(open);
      }}>
        <DialogContent>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} — {s.credits_cost} credit{Number(s.credits_cost) !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Notes (optional)</label>
              <Textarea
                placeholder="What is the project about?"
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createBooking.mutate()}
              disabled={!selectedService || createBooking.isPending}
            >
              Book Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingsPage;
