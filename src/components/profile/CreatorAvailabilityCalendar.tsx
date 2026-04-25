import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  setHours,
  setMinutes,
  startOfWeek,
  startOfDay,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  addMinutes,
  differenceInMinutes,
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
  Minus,
  Plus,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthGate } from "@/components/AuthGateDialog";

// ─── Time grid configuration ───
const HOUR_START = 8;       // 8am
const HOUR_END = 23;        // 11pm (exclusive)
const HOUR_PX = 48;         // pixel height per hour cell
const SNAP_MIN = 15;        // minute snap granularity
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const DAY_START_MIN = HOUR_START * 60;
const DAY_END_MIN = HOUR_END * 60;
const PX_PER_MIN = HOUR_PX / 60;

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

const snap = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN;
const clamp = (m: number) => Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, m));

const minutesToTime = (day: Date, mins: number) =>
  addMinutes(startOfDay(day), mins);

const formatTime = (day: Date, mins: number) =>
  format(minutesToTime(day, mins), "h:mm a");

const formatDuration = (mins: number) => {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const CreatorAvailabilityCalendar = ({
  creatorId,
  creatorName,
}: CreatorAvailabilityCalendarProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { requireAuth } = useAuthGate();

  const isOwner = user?.id === creatorId;

  const [mode, setMode] = useState<Mode>("view");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [saving, setSaving] = useState(false);

  // Minute-precision drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragDayIdx, setDragDayIdx] = useState<number | null>(null);
  const [dragAnchorMin, setDragAnchorMin] = useState<number | null>(null); // pointer-down position
  const [dragCurrentMin, setDragCurrentMin] = useState<number | null>(null); // pointer-current position

  // Final selection committed for the booking modal
  const [pendingSelection, setPendingSelection] = useState<{
    day: Date;
    startMin: number;
    endMin: number;
  } | null>(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");

  // Resize state for owner editing of existing availability blocks
  const [resizing, setResizing] = useState<{
    id: string;
    dayIdx: number;
    edge: "top" | "bottom";
    originalStart: number;
    originalEnd: number;
    currentStart: number;
    currentEnd: number;
  } | null>(null);

  // Click-to-edit popover for an existing block
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const dayColumnRefs = useRef<Array<HTMLDivElement | null>>([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = addDays(weekStart, 7);

  // ─── Data ───
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

  // Per-day intervals (minutes-from-midnight) for fast hit-testing
  const availabilityByDay = useMemo(() => {
    const map: Record<number, Array<{ id: string; startMin: number; endMin: number }>> = {};
    weekDays.forEach((d, i) => (map[i] = []));
    availability?.forEach((a) => {
      const s = new Date(a.start_time);
      const e = new Date(a.end_time);
      const idx = weekDays.findIndex((d) => isSameDay(d, s));
      if (idx === -1) return;
      map[idx].push({
        id: a.id,
        startMin: s.getHours() * 60 + s.getMinutes(),
        endMin: e.getHours() * 60 + e.getMinutes(),
      });
    });
    return map;
  }, [availability, weekDays]);

  const bookingsByDay = useMemo(() => {
    const map: Record<number, Array<{ startMin: number; endMin: number }>> = {};
    weekDays.forEach((d, i) => (map[i] = []));
    bookings?.forEach((b) => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      const idx = weekDays.findIndex((d) => isSameDay(d, s));
      if (idx === -1) return;
      map[idx].push({
        startMin: s.getHours() * 60 + s.getMinutes(),
        endMin: e.getHours() * 60 + e.getMinutes(),
      });
    });
    return map;
  }, [bookings, weekDays]);

  // Hit-test helpers
  const minIsAvailable = (dayIdx: number, m: number) =>
    availabilityByDay[dayIdx]?.some((iv) => m >= iv.startMin && m < iv.endMin) ?? false;
  const minIsBooked = (dayIdx: number, m: number) =>
    bookingsByDay[dayIdx]?.some((iv) => m >= iv.startMin && m < iv.endMin) ?? false;
  const rangeIsBookable = (dayIdx: number, startMin: number, endMin: number) => {
    if (endMin - startMin < SNAP_MIN) return false;
    // Every snap-step must be available and not booked
    for (let m = startMin; m < endMin; m += SNAP_MIN) {
      if (!minIsAvailable(dayIdx, m)) return false;
      if (minIsBooked(dayIdx, m)) return false;
    }
    return true;
  };
  const rangeIsBookableForOwnerEdit = (dayIdx: number, startMin: number, endMin: number) => {
    if (endMin - startMin < SNAP_MIN) return false;
    for (let m = startMin; m < endMin; m += SNAP_MIN) {
      if (minIsBooked(dayIdx, m)) return false;
    }
    return true;
  };

  // ─── Pointer → minute resolution ───
  const minutesFromPointer = useCallback(
    (dayIdx: number, clientY: number) => {
      const col = dayColumnRefs.current[dayIdx];
      if (!col) return null;
      const rect = col.getBoundingClientRect();
      const relY = clientY - rect.top;
      const rawMin = DAY_START_MIN + relY / PX_PER_MIN;
      return clamp(snap(rawMin));
    },
    []
  );

  const dayIdxFromPointer = useCallback((clientX: number, clientY: number) => {
    for (let i = 0; i < dayColumnRefs.current.length; i++) {
      const col = dayColumnRefs.current[i];
      if (!col) continue;
      const r = col.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return i;
      }
    }
    return null;
  }, []);

  // ─── Pointer handlers ───
  const handlePointerDown = (dayIdx: number, e: React.PointerEvent) => {
    if (resizing) return; // resize takes precedence
    if (mode === "view" && isOwner) return; // owner must enter edit mode

    const day = weekDays[dayIdx];
    const m = minutesFromPointer(dayIdx, e.clientY);
    if (m === null) return;

    // Past-time guard
    const candidate = minutesToTime(day, m);
    if (candidate < new Date()) return;

    if (mode === "view") {
      if (!user) {
        requireAuth(`Sign up to book time with ${creatorName ?? "this creator"}.`);
        return;
      }
      if (!minIsAvailable(dayIdx, m) || minIsBooked(dayIdx, m)) return;
    } else {
      if (minIsBooked(dayIdx, m)) return;
    }

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    setDragDayIdx(dayIdx);
    setDragAnchorMin(m);
    setDragCurrentMin(m + SNAP_MIN); // initial 15-min selection
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || dragDayIdx === null) return;
      const m = minutesFromPointer(dragDayIdx, e.clientY);
      if (m === null) return;
      setDragCurrentMin(m);
    },
    [isDragging, dragDayIdx, minutesFromPointer]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging || dragDayIdx === null || dragAnchorMin === null || dragCurrentMin === null) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);

    const a = Math.min(dragAnchorMin, dragCurrentMin);
    const b = Math.max(dragAnchorMin, dragCurrentMin);
    const startMin = a;
    const endMin = Math.max(a + SNAP_MIN, b); // ensure at least one snap
    const day = weekDays[dragDayIdx];

    if (mode === "edit") {
      if (rangeIsBookableForOwnerEdit(dragDayIdx, startMin, endMin)) {
        void persistAvailability(day, startMin, endMin);
      } else {
        toast.error("That range overlaps a booking");
      }
      setDragAnchorMin(null);
      setDragCurrentMin(null);
      setDragDayIdx(null);
    } else {
      if (rangeIsBookable(dragDayIdx, startMin, endMin)) {
        setPendingSelection({ day, startMin, endMin });
        setBookingOpen(true);
      } else {
        toast.error("Selection extends outside available time");
        setDragAnchorMin(null);
        setDragCurrentMin(null);
        setDragDayIdx(null);
      }
    }
  }, [
    isDragging,
    dragDayIdx,
    dragAnchorMin,
    dragCurrentMin,
    weekDays,
    mode,
  ]);

  // Global pointer listeners while dragging
  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // ─── Persist availability ───
  const persistAvailability = async (day: Date, startMin: number, endMin: number) => {
    if (!user || !isOwner) return;
    const start = addMinutes(startOfDay(day), startMin);
    const end = addMinutes(startOfDay(day), endMin);

    setSaving(true);
    try {
      const { error } = await supabase.from("creator_availability").insert({
        user_id: user.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["creator-availability", creatorId] });
      toast.success(`Added ${formatTime(day, startMin)} – ${formatTime(day, endMin)}`);
    } catch (err: any) {
      toast.error(err.message || "Could not save availability");
    } finally {
      setSaving(false);
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

  // ─── Update an existing availability block (resize / nudge) ───
  const updateAvailabilityWindow = async (
    id: string,
    day: Date,
    startMin: number,
    endMin: number
  ) => {
    if (!user || !isOwner) return;
    const start = addMinutes(startOfDay(day), startMin);
    const end = addMinutes(startOfDay(day), endMin);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("creator_availability")
        .update({ start_time: start.toISOString(), end_time: end.toISOString() })
        .eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["creator-availability", creatorId] });
    } catch (err: any) {
      toast.error(err.message || "Could not update");
    } finally {
      setSaving(false);
    }
  };

  // Bounds: don't let a resize cross a booking or another availability block
  const computeResizeBounds = (
    dayIdx: number,
    blockId: string,
    edge: "top" | "bottom",
    originalStart: number,
    originalEnd: number
  ) => {
    const others = (availabilityByDay[dayIdx] ?? []).filter((iv) => iv.id !== blockId);
    const bks = bookingsByDay[dayIdx] ?? [];

    if (edge === "top") {
      // Lower bound: after the latest "other end" before originalStart, and after any booking inside this block
      let lower = DAY_START_MIN;
      others.forEach((iv) => {
        if (iv.endMin <= originalStart && iv.endMin > lower) lower = iv.endMin;
      });
      bks.forEach((b) => {
        if (b.endMin <= originalEnd && b.endMin > lower) lower = b.endMin;
      });
      return { min: lower, max: originalEnd - SNAP_MIN };
    } else {
      let upper = DAY_END_MIN;
      others.forEach((iv) => {
        if (iv.startMin >= originalEnd && iv.startMin < upper) upper = iv.startMin;
      });
      bks.forEach((b) => {
        if (b.startMin >= originalStart && b.startMin < upper) upper = b.startMin;
      });
      return { min: originalStart + SNAP_MIN, max: upper };
    }
  };

  // ─── Resize pointer handlers ───
  const handleResizeStart = (
    iv: { id: string; startMin: number; endMin: number },
    dayIdx: number,
    edge: "top" | "bottom",
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setEditingBlockId(null);
    setResizing({
      id: iv.id,
      dayIdx,
      edge,
      originalStart: iv.startMin,
      originalEnd: iv.endMin,
      currentStart: iv.startMin,
      currentEnd: iv.endMin,
    });
  };

  const handleResizeMove = useCallback(
    (e: PointerEvent) => {
      if (!resizing) return;
      const m = minutesFromPointer(resizing.dayIdx, e.clientY);
      if (m === null) return;
      const bounds = computeResizeBounds(
        resizing.dayIdx,
        resizing.id,
        resizing.edge,
        resizing.originalStart,
        resizing.originalEnd
      );
      const clamped = Math.max(bounds.min, Math.min(bounds.max, m));
      if (resizing.edge === "top") {
        setResizing({ ...resizing, currentStart: clamped });
      } else {
        setResizing({ ...resizing, currentEnd: clamped });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resizing, minutesFromPointer]
  );

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;
    const { id, dayIdx, currentStart, currentEnd, originalStart, originalEnd } = resizing;
    setResizing(null);
    if (currentStart === originalStart && currentEnd === originalEnd) return;
    const day = weekDays[dayIdx];
    void updateAvailabilityWindow(id, day, currentStart, currentEnd);
  }, [resizing, weekDays]);

  useEffect(() => {
    if (!resizing) return;
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizeEnd);
    return () => {
      window.removeEventListener("pointermove", handleResizeMove);
      window.removeEventListener("pointerup", handleResizeEnd);
    };
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // ─── Click-popover nudge: adjust an existing block's start/end by ±15 ───
  const nudgeBlock = (
    iv: { id: string; startMin: number; endMin: number },
    dayIdx: number,
    edge: "start" | "end",
    deltaMin: number
  ) => {
    const bounds = computeResizeBounds(
      dayIdx,
      iv.id,
      edge === "start" ? "top" : "bottom",
      iv.startMin,
      iv.endMin
    );
    let nextStart = iv.startMin;
    let nextEnd = iv.endMin;
    if (edge === "start") {
      nextStart = Math.max(bounds.min, Math.min(bounds.max, iv.startMin + deltaMin));
      if (nextStart === iv.startMin) {
        toast.error("Can't move further");
        return;
      }
    } else {
      nextEnd = Math.max(bounds.min, Math.min(bounds.max, iv.endMin + deltaMin));
      if (nextEnd === iv.endMin) {
        toast.error("Can't move further");
        return;
      }
    }
    void updateAvailabilityWindow(iv.id, weekDays[dayIdx], nextStart, nextEnd);
  };


  const adjustEnd = (deltaMin: number) => {
    if (!pendingSelection) return;
    const next = pendingSelection.endMin + deltaMin;
    if (next - pendingSelection.startMin < SNAP_MIN) return;
    if (next > DAY_END_MIN) return;
    if (!rangeIsBookable(weekDays.findIndex((d) => isSameDay(d, pendingSelection.day)), pendingSelection.startMin, next)) {
      toast.error("Cannot extend — outside available time");
      return;
    }
    setPendingSelection({ ...pendingSelection, endMin: next });
  };
  const adjustStart = (deltaMin: number) => {
    if (!pendingSelection) return;
    const next = pendingSelection.startMin + deltaMin;
    if (pendingSelection.endMin - next < SNAP_MIN) return;
    if (next < DAY_START_MIN) return;
    if (!rangeIsBookable(weekDays.findIndex((d) => isSameDay(d, pendingSelection.day)), next, pendingSelection.endMin)) {
      toast.error("Cannot extend — outside available time");
      return;
    }
    setPendingSelection({ ...pendingSelection, startMin: next });
  };

  const confirmBooking = async () => {
    if (!user || !pendingSelection) return;
    const { day, startMin, endMin } = pendingSelection;
    const start = addMinutes(startOfDay(day), startMin);
    const end = addMinutes(startOfDay(day), endMin);

    setSaving(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        staff_member_id: creatorId,
        title: `Session with ${creatorName ?? "creator"}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: +(differenceInMinutes(end, start) / 60).toFixed(2),
        status: "upcoming",
        notes: bookingNotes || null,
      });
      if (error) throw error;

      await supabase.from("calendar_events").insert({
        user_id: user.id,
        title: `📅 ${creatorName ?? "Creator"} session`,
        description: bookingNotes || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        color: "#7c3aed",
      });

      await queryClient.invalidateQueries({ queryKey: ["creator-bookings", creatorId] });
      toast.success(
        `Booked ${format(day, "MMM d")} · ${formatTime(day, startMin)}–${formatTime(day, endMin)}`
      );
      setBookingOpen(false);
      setBookingNotes("");
      setPendingSelection(null);
    } catch (err: any) {
      toast.error(err.message || "Could not book");
    } finally {
      setSaving(false);
    }
  };

  // ─── Live drag derived values ───
  const liveStartMin =
    dragAnchorMin !== null && dragCurrentMin !== null
      ? Math.min(dragAnchorMin, dragCurrentMin)
      : null;
  const liveEndMin =
    dragAnchorMin !== null && dragCurrentMin !== null
      ? Math.max(dragAnchorMin + SNAP_MIN, dragCurrentMin)
      : null;
  const liveDuration =
    liveStartMin !== null && liveEndMin !== null ? liveEndMin - liveStartMin : 0;

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
              }}
            >
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {isOwner && mode === "edit"
          ? "Drag vertically inside any day to mark availability. Snaps to 15-minute increments."
          : isOwner
          ? "Switch to Edit to add available times so visitors can book you."
          : "Drag inside the green area to pick an exact time. Snaps to 15-minute increments."}
      </p>

      {/* Live selection bar */}
      {isDragging && liveStartMin !== null && liveEndMin !== null && dragDayIdx !== null && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <div>
            <p className="font-semibold text-foreground">
              {format(weekDays[dragDayIdx], "EEE, MMM d")}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(weekDays[dragDayIdx], liveStartMin)} –{" "}
              {formatTime(weekDays[dragDayIdx], liveEndMin)}
            </p>
          </div>
          <span className="text-base font-bold text-primary">
            {formatDuration(liveDuration)}
          </span>
        </div>
      )}

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
          className="grid border border-border rounded-lg overflow-hidden select-none max-h-[480px] overflow-y-auto"
          style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
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

          {/* Body — left hour gutter + 7 day columns spanning all hours */}
          <div className="contents">
            {/* Hour gutter */}
            <div className="border-r border-border bg-muted/10">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end pr-1 pt-0.5 text-[10px] text-muted-foreground border-b border-border"
                  style={{ height: HOUR_PX }}
                >
                  {format(setHours(new Date(), hour), "ha").toLowerCase()}
                </div>
              ))}
            </div>

            {/* 7 day columns */}
            {weekDays.map((day, dayIdx) => {
              const isToday = isSameDay(day, new Date());
              const dayHeight = HOURS.length * HOUR_PX;
              const now = new Date();
              const pastEndMin = isSameDay(day, now)
                ? clamp(now.getHours() * 60 + now.getMinutes())
                : day < startOfDay(now)
                ? DAY_END_MIN
                : DAY_START_MIN;
              const pastTopPx = 0;
              const pastHeightPx = (pastEndMin - DAY_START_MIN) * PX_PER_MIN;

              const dayAvail = availabilityByDay[dayIdx] ?? [];
              const dayBookings = bookingsByDay[dayIdx] ?? [];

              return (
                <div
                  key={dayIdx}
                  ref={(el) => (dayColumnRefs.current[dayIdx] = el)}
                  className={cn(
                    "relative border-r border-border touch-none",
                    isToday && "bg-primary/[0.02]"
                  )}
                  style={{ height: dayHeight }}
                  onPointerDown={(e) => handlePointerDown(dayIdx, e)}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-border/60"
                      style={{ top: i * HOUR_PX, height: HOUR_PX }}
                    />
                  ))}
                  {/* 30-min subtle line */}
                  {HOURS.map((_, i) => (
                    <div
                      key={`half-${i}`}
                      className="absolute left-0 right-0 border-b border-dashed border-border/30"
                      style={{ top: i * HOUR_PX + HOUR_PX / 2, height: 0 }}
                    />
                  ))}

                  {/* Past overlay */}
                  {pastHeightPx > 0 && (
                    <div
                      className="absolute left-0 right-0 bg-muted/30 pointer-events-none"
                      style={{ top: pastTopPx, height: pastHeightPx }}
                    />
                  )}

                  {/* Availability windows (green) */}
                  {dayAvail.map((iv) => {
                    const top = (iv.startMin - DAY_START_MIN) * PX_PER_MIN;
                    const height = (iv.endMin - iv.startMin) * PX_PER_MIN;
                    return (
                      <div
                        key={iv.id}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded-md bg-emerald-500/25 border border-emerald-500/40 pointer-events-none",
                          mode === "edit" && "pointer-events-auto cursor-pointer hover:bg-emerald-500/35 group"
                        )}
                        style={{ top, height }}
                        onClick={(e) => {
                          if (mode !== "edit") return;
                          e.stopPropagation();
                          void removeAvailabilityWindow(iv.id);
                        }}
                      >
                        {mode === "edit" && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="rounded-full bg-card/95 p-1 shadow">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Booked windows (red) */}
                  {dayBookings.map((iv, i) => {
                    const top = (iv.startMin - DAY_START_MIN) * PX_PER_MIN;
                    const height = (iv.endMin - iv.startMin) * PX_PER_MIN;
                    return (
                      <div
                        key={`b-${i}`}
                        className="absolute left-0.5 right-0.5 rounded-md bg-destructive/20 border border-destructive/40 pointer-events-none"
                        style={{ top, height }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[9px] font-medium text-destructive/80 px-1">
                            Booked
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Live drag overlay */}
                  {isDragging &&
                    dragDayIdx === dayIdx &&
                    liveStartMin !== null &&
                    liveEndMin !== null && (
                      <div
                        className="absolute left-1 right-1 rounded-md bg-primary/40 border-2 border-primary pointer-events-none z-10 shadow-lg"
                        style={{
                          top: (liveStartMin - DAY_START_MIN) * PX_PER_MIN,
                          height: (liveEndMin - liveStartMin) * PX_PER_MIN,
                        }}
                      >
                        <div className="absolute inset-x-0 -top-5 text-center">
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded">
                            {formatTime(weekDays[dayIdx], liveStartMin)}
                          </span>
                        </div>
                        <div className="flex items-center justify-center h-full">
                          <span className="text-[10px] font-bold text-primary-foreground bg-primary/80 px-1.5 py-0.5 rounded">
                            {formatDuration(liveEndMin - liveStartMin)}
                          </span>
                        </div>
                        <div className="absolute inset-x-0 -bottom-5 text-center">
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded">
                            {formatTime(weekDays[dayIdx], liveEndMin)}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
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
        <span className="ml-auto opacity-60">Snaps to 15 min</span>
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
            setPendingSelection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Book {creatorName ?? "creator"}
            </DialogTitle>
          </DialogHeader>

          {pendingSelection && (
            <div className="space-y-4">
              {/* Big time summary */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {format(pendingSelection.day, "EEEE, MMMM d")}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatTime(pendingSelection.day, pendingSelection.startMin)}
                  </p>
                  <span className="text-muted-foreground">→</span>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatTime(pendingSelection.day, pendingSelection.endMin)}
                  </p>
                </div>
                <p className="text-sm text-primary font-semibold mt-1">
                  {formatDuration(pendingSelection.endMin - pendingSelection.startMin)} session
                </p>
              </div>

              {/* Fine-tune controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Start time
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustStart(-SNAP_MIN)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatTime(pendingSelection.day, pendingSelection.startMin)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustStart(SNAP_MIN)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    End time
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustEnd(-SNAP_MIN)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatTime(pendingSelection.day, pendingSelection.endMin)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustEnd(SNAP_MIN)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
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
                setPendingSelection(null);
              }}
            >
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={confirmBooking} disabled={saving || !pendingSelection}>
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
    </div>
  );
};

export default CreatorAvailabilityCalendar;
