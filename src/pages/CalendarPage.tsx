import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  color?: string | null;
  source?: "rhozeland" | "google";
}

const CalendarPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").order("start_time");
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, source: "rhozeland" as const }));
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("calendar_events").insert({
        title,
        start_time: new Date(startDate).toISOString(),
        end_time: new Date(endDate || startDate).toISOString(),
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setTitle("");
      setStartDate("");
      setEndDate("");
      toast.success("Event created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fetchGoogleCalendar = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;

      if (!providerToken) {
        toast.error("Please sign in with Google to import your calendar. Sign out and sign back in with Google.");
        setGoogleLoading(false);
        return;
      }

      const timeMin = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0).toISOString();

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
  }, [currentMonth]);

  // Merge Rhozeland + Google events
  const allEvents: CalendarEvent[] = [
    ...(events ?? []),
    ...googleEvents,
  ];

  const getEventsForDay = (day: Date) =>
    allEvents.filter((e) => isSameDay(new Date(e.start_time), day));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground">Schedule your creative sessions</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }} className="space-y-4">
                <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Start</label>
                    <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">End</label>
                    <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createEvent.isPending}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Legend */}
      {googleConnected && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Rhozeland
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#4285F4" }} />
            Google Calendar
          </span>
        </div>
      )}

      <div className="surface-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
          {paddedDays.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            return (
              <div
                key={i}
                className={`min-h-[80px] rounded-lg border border-border/50 p-1.5 ${
                  day && isSameDay(day, new Date()) ? "bg-primary/5 border-primary/30" : "bg-muted/20"
                } ${!day ? "bg-transparent border-transparent" : ""}`}
              >
                {day && (
                  <>
                    <span className={`text-xs ${isSameDay(day, new Date()) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: e.source === "google" ? "rgba(66,133,244,0.15)" : "hsl(var(--primary) / 0.15)",
                            color: e.source === "google" ? "#4285F4" : "hsl(var(--primary))",
                          }}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
