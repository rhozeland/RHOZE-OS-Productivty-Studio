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
  Plus,
  X,
  Type,
  Video,
  ImageIcon,
  AudioLines,
  Quote,
  Link as LinkIcon,
  Fingerprint,
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
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { toast } from "sonner";

const CATEGORIES = ["design", "music", "photo", "video", "writing"];

const CONTENT_TYPES = [
  { icon: Type, label: "TEXT", angle: -90 },
  { icon: Video, label: "VIDEO", angle: -150 },
  { icon: ImageIcon, label: "IMAGE", angle: -30 },
  { icon: AudioLines, label: "AUDIO", angle: 150 },
  { icon: Quote, label: "QUOTE", angle: 30 },
  { icon: LinkIcon, label: "LINK", angle: 90 },
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  design: "from-teal/20 via-muted to-accent/20",
  music: "from-pink/30 via-muted to-warm/20",
  photo: "from-warm/20 via-muted to-teal/20",
  video: "from-accent/20 via-muted to-pink/20",
  writing: "from-muted via-teal/10 to-accent/10",
};

const FlowModePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [calibrated, setCalibrated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0=types, 1=swipe tutorial, 2=ready
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("design");
  const [newLink, setNewLink] = useState("");

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateZ = useTransform(x, [-200, 200], [-15, 15]);

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-interactions"] }),
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

  const performAction = useCallback((action: string) => {
    if (!currentItem) return;

    if (action === "save" && smartboards && smartboards.length > 0) {
      interact.mutate({ itemId: currentItem.id, action, smartboardId: smartboards[0].id });
      toast.success("Saved to Smartboard!");
    } else if (action === "share") {
      interact.mutate({ itemId: currentItem.id, action });
      toast("Shared!");
    } else if (action === "learn_more" && currentItem.link_url) {
      window.open(currentItem.link_url, "_blank");
      interact.mutate({ itemId: currentItem.id, action });
    } else {
      interact.mutate({ itemId: currentItem.id, action });
    }

    setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, unseenItems.length - 1));
      setExpandedCard(false);
    }, 200);
  }, [currentItem, smartboards, interact, unseenItems.length]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset } = info;
    const threshold = 80;

    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      if (offset.x > threshold) performAction("skip");       // Right = Next
      else if (offset.x < -threshold) performAction("share"); // Left = Back/Share
    } else {
      if (offset.y < -threshold) performAction("save");       // Up = Save
      else if (offset.y > threshold) performAction("dislike"); // Down = Dislike
    }
  }, [performAction]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!calibrated || !currentItem) return;
      if (e.key === "ArrowUp") performAction("save");
      if (e.key === "ArrowDown") performAction("dislike");
      if (e.key === "ArrowLeft") performAction("share");
      if (e.key === "ArrowRight") performAction("skip");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [calibrated, currentItem, performAction]);

  // ──── ONBOARDING ────
  if (!calibrated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {/* Step 0: Content Types */}
          {onboardingStep === 0 && (
            <motion.div
              key="types"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              {/* Content type icons in circular arrangement */}
              <div className="relative mx-auto mb-8 h-48 w-48">
                {CONTENT_TYPES.map((ct, i) => {
                  const rad = (ct.angle * Math.PI) / 180;
                  const radius = 80;
                  const cx = Math.cos(rad) * radius;
                  const cy = Math.sin(rad) * radius;
                  return (
                    <motion.div
                      key={ct.label}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 + 0.2 }}
                      className="absolute flex flex-col items-center gap-1"
                      style={{
                        left: `calc(50% + ${cx}px - 24px)`,
                        top: `calc(50% + ${cy}px - 20px)`,
                      }}
                    >
                      <ct.icon className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium text-muted-foreground/60 tracking-wider">
                        {ct.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <h2 className="font-display text-xl font-bold text-foreground mb-2">What are you into?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
                We're interested in redefining the experience of how you view meaningful content. Let's get to know each other by introducing our Flow Mode.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategories.includes(cat) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCalibrationSelect(cat)}
                    className="capitalize rounded-full"
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <Button onClick={() => setOnboardingStep(1)} className="rounded-full px-8">
                Next
              </Button>
            </motion.div>
          )}

          {/* Step 1: Swipe Tutorial */}
          {onboardingStep === 1 && (
            <motion.div
              key="swipe"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Swipe in the direction shown to interact with content.
              </p>

              {/* Swipe card preview */}
              <div className="relative mx-auto mb-8">
                <div className="relative mx-auto w-56 h-72 rounded-2xl border border-border bg-card shadow-lg flex items-center justify-center">
                  <Fingerprint className="h-10 w-10 text-muted-foreground/30" />

                  {/* Direction labels */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground tracking-wider">SAVE</span>
                  </div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <span className="text-xs font-medium text-muted-foreground tracking-wider">DISLIKE</span>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="absolute top-1/2 -left-16 -translate-y-1/2 flex items-center gap-1">
                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground tracking-wider">BACK</span>
                  </div>
                  <div className="absolute top-1/2 -right-16 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground tracking-wider">NEXT</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setOnboardingStep(0)} className="rounded-full px-6">
                  Back
                </Button>
                <Button onClick={finishCalibration} className="rounded-full px-8">
                  Let's try it
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ──── MAIN FLOW VIEW ────
  return (
    <div className="relative">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => { setCalibrated(false); setOnboardingStep(0); }}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategories.includes(cat) ? "default" : "outline"}
              className="cursor-pointer capitalize text-xs rounded-full"
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
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setAddOpen(true)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Card area */}
      <div className="flex justify-center items-center min-h-[65vh]">
        <AnimatePresence mode="wait">
          {currentItem ? (
            <motion.div
              key={currentItem.id}
              className="w-full max-w-sm cursor-grab active:cursor-grabbing"
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotateZ }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            >
              <div className="rounded-3xl bg-card border border-border shadow-xl overflow-hidden">
                {/* Content visual */}
                <div className={`aspect-square bg-gradient-to-br ${CATEGORY_GRADIENTS[currentItem.category] || CATEGORY_GRADIENTS.design} flex items-center justify-center p-8 relative`}>
                  {currentItem.file_url ? (
                    <img
                      src={currentItem.file_url}
                      alt={currentItem.title}
                      className="w-full h-full object-cover rounded-2xl shadow-lg"
                    />
                  ) : (
                    <div className="text-center">
                      <Badge variant="outline" className="mb-4 capitalize rounded-full bg-card/60 backdrop-blur-sm">
                        {currentItem.category}
                      </Badge>
                      <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
                        {currentItem.title}
                      </h2>
                    </div>
                  )}
                </div>

                {/* Actions & info */}
                <div className="p-5">
                  {/* Action icons */}
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <button
                      onClick={() => performAction("save")}
                      className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Bookmark className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => performAction("share")}
                      className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    {currentItem.link_url && (
                      <a href={currentItem.link_url} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    )}
                  </div>

                  {/* Expandable info */}
                  {currentItem.file_url && (
                    <h3 className="font-display font-semibold text-foreground mb-1">{currentItem.title}</h3>
                  )}
                  {currentItem.description && (
                    <p
                      className={`text-sm text-muted-foreground leading-relaxed ${
                        expandedCard ? "" : "line-clamp-3"
                      }`}
                      onClick={() => setExpandedCard(!expandedCard)}
                    >
                      {currentItem.description}
                    </p>
                  )}
                  {currentItem.description && currentItem.description.length > 120 && (
                    <button
                      onClick={() => setExpandedCard(!expandedCard)}
                      className="mt-1 flex items-center justify-center w-full"
                    >
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedCard ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center px-4"
            >
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">You're all caught up!</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Share your own content or check back later for new discoveries.
              </p>
              <Button onClick={() => setAddOpen(true)} className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" />
                Share Your Work
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop swipe hint */}
      {currentItem && (
        <div className="hidden md:flex justify-center mt-4 gap-8 text-muted-foreground/50">
          <span className="flex items-center gap-1 text-xs"><ChevronUp className="h-3.5 w-3.5" /> Save</span>
          <span className="flex items-center gap-1 text-xs"><ChevronLeft className="h-3.5 w-3.5" /> Share</span>
          <span className="flex items-center gap-1 text-xs"><ChevronRight className="h-3.5 w-3.5" /> Next</span>
          <span className="flex items-center gap-1 text-xs"><ChevronDown className="h-3.5 w-3.5" /> Dislike</span>
        </div>
      )}

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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Link URL (optional)" value={newLink} onChange={(e) => setNewLink(e.target.value)} />
            <Button type="submit" className="w-full rounded-full" disabled={!newTitle.trim()}>Share to Flow</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlowModePage;
