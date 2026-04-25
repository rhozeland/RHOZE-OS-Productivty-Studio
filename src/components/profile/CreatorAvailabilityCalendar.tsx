import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  setHours,
  setMinutes,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  addHours,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Pencil,
  Check,
  X,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthGate } from "@/hooks/useAuthGate";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8am – 10pm

type Mode = "view" | "edit";

interface CreatorAvailabilityCalendarProps {
  creatorId: string;
  creatorName?: string | null;
}

interface AvailabilityRow {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
}

interface BookingRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const CreatorAvailabilityCalendar = ({
  creatorId,
  creatorName,
}: CreatorAvailabilityCalendarProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { requireAuth, AuthGateDialog } = useAuthGate();

  const isOwner = user?.id === creatorId;

  const [mode, setMode] = useState<Mode>("view");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [saving, setSaving] = useState(false);

  // Drag selection state (for edit mode = mark available; for view mode = book a slot)
  const [isDragging, setIsDragging] = useState(false);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [dragDate, setDragDate] = useState<Date | null>(null);

  // Booking confirmation dialog (visitor flow)
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);

  // Availability windows for this creator
  const { data: availability, isLoading: loadingAvail } = useQuery({
    queryKey: ["creator-availability", creatorId, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_availability")
        .select("*")
        .eq("user_id", creatorId)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString());
      if (error) throw error;
      return (data ?? []) as AvailabilityRow[];
    },
  });

  // Existing bookings against this creator (so we can grey out booked slots)
  const { data: bookings } = useQuery({
    queryKey: ["creator-bookings", creatorId, weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("staff_member_id", creatorId)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .neq("status", "cancelled");
      return (data ?? []) as BookingRow[];
    },
  });

  useEffect(() => {
    const handler = () => isDragging && setIsDragging(false);
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [isDragging]);

  const resetDrag = () => {
    setIsDragging(false);
    setDragDay(null);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDate(null);
  };

  const isSlotAvailable = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    return (
      availability?.some((a) => {
        const s = new Date(a.start_time);
        const e = new Date(a.end_time);
        if (!isSameDay(s, day)) return false;
        return hour >= s.getHours() && hour < e.getHours();
      }) ?? false
    );
  };

  const isSlotBooked = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    return (
      bookings?.some((b) => {
        const s = new Date(b.start_time);
        const e = new Date(b.end_time);
        if (!isSameDay(s, day)) return false;
        return hour >= s.getHours() && hour < e.getHours();
      }) ?? false
    );
  };

  const isSlotInDrag = (dayIndex: number, hour: number) => {
    if (dragDay !== dayIndex || dragStartHour === null || dragEndHour === null) return false;
    const minH = Math.min(dragStartHour, dragEndHour);
    const maxH = Math.max(dragStartHour, dragEndHour);
    return hour >= minH && hour <= maxH;
  };

  const slotIsPast = (day: Date, hour: number) => {
    const d = setMinutes(setHours(day, hour), 0);
    return d < new Date();
  };

  // ─── Drag handlers ───
  const handleSlotDown = (dayIndex: number, hour: number) => {
    const day = weekDays[dayIndex];
    if (slotIsPast(day, hour)) return;
    if (mode === "view") {
      // visitors can only start drag on AVAILABLE slots
      if (!isOwner && (!isSlotAvailable(dayIndex, hour) || isSlotBooked(dayIndex, hour))) return;
      if (!isOwner && !user) {
        requireAuth(`Sign up to book time with ${creatorName ?? "this creator"}.`);
        return;
      }
      if (isOwner) return; // owner needs to enter edit mode
    } else {
      if (isSlotBooked(dayIndex, hour)) return;
    }
    setIsDragging(true);
    setDragDay(dayIndex);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setDragDate(day);
  };

  const handleSlotEnter = (dayIndex: number, hour: number) => {
    if (!isDragging || dayIndex !== dragDay) return;
    if (mode === "view" && !isOwner) {
      // can only extend within available + non-booked slots
      if (!isSlotAvailable(dayIndex, hour) || isSlotBooked(dayIndex, hour)) return;
    } else if (mode === "edit") {
      if (isSlotBooked(dayIndex, hour)) return;
    }
    setDragEndHour(hour);
  };

  const handleSlotUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragStartHour === null || dragEndHour === null || !dragDate) return;

    if (mode === "edit") {
      void persistAvailability();
    } else if (!isOwner) {
      // Open booking confirmation
      setBookingOpen(true);
    }
  };

  // Touch resolver
  const resolveTouchSlot = useCallback((touch: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const slotEl = el.closest("[data-cslot]") as HTMLElement | null;
    if (!slotEl) return null;
    const dayIndex = Number(slotEl.dataset.cday);
    const hour = Number(slotEl.dataset.chour);
    if (isNaN(dayIndex) || isNaN(hour)) return null;
    return { dayIndex, hour };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const slot = resolveTouchSlot(e.touches[0]);
      if (slot && slot.dayIndex === dragDay) handleSlotEnter(slot.dayIndex, slot.hour);
    },
    [isDragging, dragDay, resolveTouchSlot]
  );

  // ─── Edit mode persistence ───
  const persistAvailability = async () => {
    if (!user || !isOwner || !dragDate || dragStartHour === null || dragEndHour === null) {
      resetDrag();
      return;
    }
    const startH = Math.min(dragStartHour, dragEndHour);
    const endH = Math.max(dragStartHour, dragEndHour) + 1;
    const start = setMinutes(setHours(dragDate, startH), 0);
    const end = setMinutes(setHours(dragDate, endH), 0);

    setSaving(true);
    try {
      const { error } = await supabase.from("creator_availability").insert({
        user_id: user.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["creator-availability", creatorId] });
      toast.success("Availability added");
    } catch (err: any) {
      toast.error(err.message || "Could not save availability");
    } finally {
      setSaving(false);
      resetDrag();
    }
  };

  const removeAvailabilityWindow = async (id: string) => {
    try {
      const { error } = await supabase.from("creator_availability").delete().eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["creator-availability", creatorId] });
      toast.success("Removed");
    } catch (err: any) {
      toast.error(err.message || "Could not remove");
    }
  };

  // ─── Booking confirm (visitor) ───
  const confirmBooking = async () => {
    if (!user || !dragDate || dragStartHour === null || dragEndHour === null) return;
    const startH = Math.min(dragStartHour, dragEndHour);
    const endH = Math.max(dragStartHour, dragEndHour) + 1;
    const start = setMinutes(setHours(dragDate, startH), 0);
    const end = setMinutes(setHours(dragDate, endH), 0);

    setSaving(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        staff_member_id: creatorId,
        title: `Session with ${creatorName ?? "creator"}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: endH - startH,
        status: "upcoming",
        notes: bookingNotes || null,
      });
      if (error) throw error;

      // Personal calendar entry
      await supabase.from("calendar_events").insert({
        user_id: user.id,
        title: `📅 ${creatorName ?? "Creator"} session`,
        description: bookingNotes || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        color: "#7c3aed",
      });

      await queryClient.invalidateQueries({ queryKey: ["creator-bookings", creatorId] });
      toast.success("Booking requested!");
      setBookingOpen(false);
      setBookingNotes("");
      resetDrag();
    } catch (err: any) {
      toast.error(err.message || "Could not book");
    } finally {
      setSaving(false);
    }
  };

  const dragDuration =
    dragStartHour !== null && dragEndHour !== null
      ? Math.abs(dragEndHour - dragStartHour) + 1
      : 0;

  // ─── Render ───
  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" /> Availability
        </h2>
        <div className="flex items-center gap-2">
          {isOwner && mode === "view" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMode("edit")}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {isOwner && mode === "edit" && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setMode("view");
                resetDrag();
              }}
            >
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          )}
        </div>
      </div>

      {/* Mode hint */}
      <p className="text-xs text-muted-foreground mb-3">
        {isOwner && mode === "edit"
          ? "Drag across hours to mark times you're available. Click an existing block to remove it."
          : isOwner
          ? "Switch to Edit to add available times so visitors can book you."
          : "Drag across the green slots to request a booking."}
      </p>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
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

      {loadingAvail ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid border border-border rounded-lg overflow-hidden select-none max-h-[420px] overflow-y-auto"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
          onMouseLeave={() => isDragging && handleSlotUp()}
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
              {weekDays.map((day, dayIndex) => {
                const available = isSlotAvailable(dayIndex, hour);
                const booked = isSlotBooked(dayIndex, hour);
                const inDrag = isSlotInDrag(dayIndex, hour);
                const past = slotIsPast(day, hour);

                let cls = "hover:bg-muted/20 cursor-pointer";
                if (past) cls = "bg-muted/20 cursor-not-allowed";
                else if (booked) cls = "bg-destructive/15 cursor-not-allowed";
                else if (available) cls = "bg-emerald-500/20 hover:bg-emerald-500/30 cursor-pointer";
                if (inDrag) cls = "bg-primary/40";
                if (mode === "view" && !isOwner && !available && !inDrag && !booked && !past) {
                  cls = "bg-background cursor-not-allowed";
                }

                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    data-cslot
                    data-cday={dayIndex}
                    data-chour={hour}
                    className={cn(
                      "border-r border-b border-border relative transition-colors touch-none",
                      cls
                    )}
                    style={{ height: 40 }}
                    onMouseDown={() => handleSlotDown(dayIndex, hour)}
                    onMouseEnter={() => handleSlotEnter(dayIndex, hour)}
                    onMouseUp={handleSlotUp}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleSlotDown(dayIndex, hour);
                    }}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleSlotUp}
                    onClick={() => {
                      // Owner edit-mode click on existing window → remove it
                      if (mode === "edit" && available) {
                        const win = availability?.find((a) => {
                          const s = new Date(a.start_time);
                          const e = new Date(a.end_time);
                          return (
                            isSameDay(s, day) &&
                            hour >= s.getHours() &&
                            hour < e.getHours()
                          );
                        });
                        if (win) void removeAvailabilityWindow(win.id);
                      }
                    }}
                  >
                    {mode === "edit" && available && !inDrag && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500/40" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-destructive/30" /> Booked
        </span>
        {!isOwner && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-primary/40" /> Selecting
          </span>
        )}
      </div>

      {saving && mode === "edit" && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}

      {/* ─── Visitor booking confirmation ─── */}
      <Dialog
        open={bookingOpen}
        onOpenChange={(o) => {
          setBookingOpen(o);
          if (!o) {
            setBookingNotes("");
            resetDrag();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Book {creatorName ?? "creator"}
            </DialogTitle>
          </DialogHeader>
          {dragDate && dragStartHour !== null && dragEndHour !== null && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{format(dragDate, "EEEE, MMM d")}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {format(
                    setHours(dragDate, Math.min(dragStartHour, dragEndHour)),
                    "h:mm a"
                  )}{" "}
                  –{" "}
                  {format(
                    addHours(
                      setHours(dragDate, Math.min(dragStartHour, dragEndHour)),
                      dragDuration
                    ),
                    "h:mm a"
                  )}{" "}
                  · {dragDuration}h
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Message (optional)
                </label>
                <Textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value.slice(0, 500))}
                  placeholder="Tell the creator what you'd like to discuss…"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBookingOpen(false);
                resetDrag();
              }}
            >
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={confirmBooking} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthGateDialog />
    </div>
  );
};

export default CreatorAvailabilityCalendar;
