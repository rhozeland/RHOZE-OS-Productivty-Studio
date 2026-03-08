import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Share2,
  ExternalLink,
  Sparkles,
  Heart,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const CATEGORIES = ["design", "music", "photo", "video", "writing"];
const CALIBRATION_QUESTIONS = [
  { q: "What kind of content are you interested in seeing Today?", options: CATEGORIES },
  { q: "What inspires you most?", options: ["Color", "Texture", "Typography", "Motion", "Sound"] },
];

const FlowModePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [calibrated, setCalibrated] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("design");
  const [newLink, setNewLink] = useState("");

  // Check if user has done calibration before
  useEffect(() => {
    const saved = localStorage.getItem(`flow-calibrated-${user?.id}`);
    if (saved) {
      setCalibrated(true);
      setSelectedCategories(JSON.parse(saved));
    }
  }, [user]);

  const { data: flowItems } = useQuery({
    queryKey: ["flow-items", selectedCategories],
    queryFn: async () => {
      let query = supabase.from("flow_items").select("*").order("created_at", { ascending: false }).limit(50);
      if (selectedCategories.length > 0) {
        query = query.in("category", selectedCategories);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: calibrated,
  });

  const { data: interactions } = useQuery({
    queryKey: ["flow-interactions"],
    queryFn: async () => {
      const { data } = await supabase.from("flow_interactions").select("flow_item_id, action").eq("user_id", user!.id);
      return new Map((data ?? []).map((d) => [d.flow_item_id, d.action]));
    },
    enabled: calibrated,
  });

  const { data: smartboards } = useQuery({
    queryKey: ["smartboards-for-flow"],
    queryFn: async () => {
      const { data } = await supabase.from("smartboards").select("id, title").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: calibrated,
  });

  const interact = useMutation({
    mutationFn: async ({ itemId, action, smartboardId }: { itemId: string; action: string; smartboardId?: string }) => {
      const { error } = await supabase.from("flow_interactions").upsert({
        user_id: user!.id,
        flow_item_id: itemId,
        action,
        smartboard_id: smartboardId || null,
      }, { onConflict: "user_id,flow_item_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-interactions"] });
    },
  });

  const createFlowItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("flow_items").insert({
        user_id: user!.id,
        title: newTitle,
        description: newDesc || null,
        category: newCategory,
        link_url: newLink || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      setAddOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewLink("");
      toast.success("Content shared to Flow!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter out already-interacted items
  const unseenItems = flowItems?.filter((item) => !interactions?.has(item.id)) ?? [];
  const currentItem = unseenItems[currentIndex];

  const handleCalibrationSelect = (option: string) => {
    const updated = selectedCategories.includes(option)
      ? selectedCategories.filter((c) => c !== option)
      : [...selectedCategories, option];
    setSelectedCategories(updated);
  };

  const finishCalibration = () => {
    const cats = selectedCategories.length > 0 ? selectedCategories : CATEGORIES;
    setSelectedCategories(cats);
    localStorage.setItem(`flow-calibrated-${user?.id}`, JSON.stringify(cats));
    setCalibrated(true);
  };

  const swipe = (dir: "up" | "down" | "left" | "right") => {
    if (!currentItem) return;
    const actions: Record<string, string> = { up: "learn_more", down: "save", left: "share", right: "skip" };
    const action = actions[dir];
    const dirMap: Record<string, number> = { up: -1, down: 1, left: -1, right: 1 };
    setDirection(dirMap[dir]);

    if (action === "save" && smartboards && smartboards.length > 0) {
      interact.mutate({ itemId: currentItem.id, action, smartboardId: smartboards[0].id });
      toast.success("Saved to your Smartboard!");
    } else if (action === "share") {
      interact.mutate({ itemId: currentItem.id, action });
      toast("Shared!");
    } else if (action === "learn_more") {
      if (currentItem.link_url) {
        window.open(currentItem.link_url, "_blank");
      }
      interact.mutate({ itemId: currentItem.id, action });
    } else {
      interact.mutate({ itemId: currentItem.id, action });
    }

    setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, unseenItems.length - 1));
      setDirection(0);
    }, 300);
  };

  // Calibration screen
  if (!calibrated) {
    const step = CALIBRATION_QUESTIONS[calibrationStep];
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card mx-auto max-w-md p-8 text-center"
        >
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Find Your Flow</h1>
          <p className="text-muted-foreground mb-6">{step.q}</p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {step.options.map((opt) => (
              <Button
                key={opt}
                variant={selectedCategories.includes(opt.toLowerCase()) ? "default" : "outline"}
                size="sm"
                onClick={() => handleCalibrationSelect(opt.toLowerCase())}
                className="capitalize"
              >
                {opt}
              </Button>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            {calibrationStep > 0 && (
              <Button variant="outline" onClick={() => setCalibrationStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {calibrationStep < CALIBRATION_QUESTIONS.length - 1 ? (
              <Button onClick={() => setCalibrationStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button onClick={finishCalibration}>Start Flowing</Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Flow</h1>
          <p className="text-muted-foreground">Discover and interact with creative content</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setCalibrated(false); setCalibrationStep(0); }}>
            Recalibrate
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Share Content
          </Button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={selectedCategories.includes(cat) ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => {
              const updated = selectedCategories.includes(cat)
                ? selectedCategories.filter((c) => c !== cat)
                : [...selectedCategories, cat];
              setSelectedCategories(updated);
              localStorage.setItem(`flow-calibrated-${user?.id}`, JSON.stringify(updated));
            }}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Content card */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-lg">
          <AnimatePresence mode="wait">
            {currentItem ? (
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, x: direction * 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 100 }}
                transition={{ duration: 0.3 }}
                className="surface-card overflow-hidden"
              >
                {/* Content area */}
                <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 via-muted to-accent/10 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-4 capitalize">
                      {currentItem.category}
                    </Badge>
                    <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                      {currentItem.title}
                    </h2>
                    {currentItem.description && (
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        {currentItem.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Creator info */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {((currentItem as any).profiles?.display_name ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {(currentItem as any).profiles?.display_name ?? "Creator"}
                      </span>
                    </div>
                    {currentItem.link_url && (
                      <a href={currentItem.link_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Swipe actions */}
                  <div className="grid grid-cols-4 gap-2">
                    <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => swipe("up")}>
                      <ChevronUp className="h-5 w-5" />
                      <span className="text-[10px]">Learn More</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => swipe("down")}>
                      <Bookmark className="h-5 w-5" />
                      <span className="text-[10px]">Save</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => swipe("left")}>
                      <Share2 className="h-5 w-5" />
                      <span className="text-[10px]">Share</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => swipe("right")}>
                      <ChevronRight className="h-5 w-5" />
                      <span className="text-[10px]">Next</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="surface-card flex flex-col items-center justify-center py-20 text-center"
              >
                <Sparkles className="mb-4 h-12 w-12 text-primary" />
                <h2 className="font-display text-xl font-bold text-foreground mb-2">
                  You're all caught up!
                </h2>
                <p className="text-muted-foreground mb-4 max-w-xs">
                  Share your own content or check back later for new discoveries.
                </p>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Share Your Work
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add content dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share to Flow</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim()) createFlowItem.mutate();
            }}
            className="space-y-4"
          >
            <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Textarea placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Link URL (optional)" value={newLink} onChange={(e) => setNewLink(e.target.value)} />
            <Button type="submit" className="w-full" disabled={!newTitle.trim()}>
              Share to Flow
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlowModePage;
