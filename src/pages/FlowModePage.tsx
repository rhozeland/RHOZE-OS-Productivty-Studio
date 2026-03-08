import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, RotateCcw, Plus, Sparkles, Music } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PROMPTS = [
  "What emotion would you paint today if you could only use one color?",
  "Create something inspired by the last dream you remember.",
  "Design a world where gravity works differently.",
  "What would your inner voice look like as a character?",
  "Capture the feeling of a forgotten memory in your medium.",
  "Build something using only curves — no straight lines.",
  "What would music look like if it were visible?",
  "Create art inspired by the texture of water.",
  "Design a sanctuary for your future self.",
  "Express the concept of time without using clocks.",
];

const FlowModePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [time, setTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && time > 0) {
      interval = setInterval(() => setTime((t) => t - 1), 1000);
    } else if (time === 0) {
      setIsRunning(false);
      toast.success("Flow session complete! Take a break.");
    }
    return () => clearInterval(interval);
  }, [isRunning, time]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const generatePrompt = () => setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  const { data: tasks } = useQuery({
    queryKey: ["flow-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("user_id", user!.id).eq("completed", false).limit(10);
      return data ?? [];
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      await supabase.from("tasks").update({ completed }).eq("id", taskId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-tasks"] }),
  });

  const progress = ((25 * 60 - time) / (25 * 60)) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Flow Mode</h1>
        <p className="text-muted-foreground">Enter your creative zone</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="surface-card flex flex-col items-center justify-center p-8 lg:col-span-1"
        >
          <div className="relative mb-6">
            <svg className="h-48 w-48 -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <circle
                cx="100" cy="100" r="90" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-4xl font-bold text-foreground">{formatTime(time)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setIsRunning(!isRunning)} size="lg">
              {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isRunning ? "Pause" : "Start"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => { setTime(25 * 60); setIsRunning(false); }}>
              <RotateCcw className="mr-2 h-4 w-4" />Reset
            </Button>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          {/* AI Prompt */}
          <div className="surface-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-semibold text-foreground">Creative Prompt</h2>
            </div>
            <p className="mb-4 text-foreground italic">&ldquo;{prompt}&rdquo;</p>
            <Button variant="outline" onClick={generatePrompt}>
              <Sparkles className="mr-2 h-4 w-4" />New Prompt
            </Button>
          </div>

          {/* Tasks */}
          <div className="surface-card p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Focus Tasks</h2>
            <div className="space-y-2">
              {tasks?.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Checkbox
                    checked={task.completed ?? false}
                    onCheckedChange={(c) => toggleTask.mutate({ taskId: task.id, completed: !!c })}
                  />
                  <span className="text-sm text-foreground">{task.title}</span>
                </div>
              ))}
              {(!tasks || tasks.length === 0) && (
                <p className="text-sm text-muted-foreground">No pending tasks. Create some in your projects!</p>
              )}
            </div>
          </div>

          {/* Music */}
          <div className="surface-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Music className="h-5 w-5 text-warm" />
              <h2 className="font-display text-lg font-semibold text-foreground">Focus Music</h2>
            </div>
            <iframe
              src="https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxVfibe1L0?utm_source=generator&theme=0"
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowModePage;
