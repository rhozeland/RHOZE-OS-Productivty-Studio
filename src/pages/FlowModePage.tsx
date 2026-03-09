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
  X,
  Type,
  Video,
  ImageIcon,
  AudioLines,
  Quote,
  Link as LinkIcon,
  Fingerprint,
  Sparkles,
  Plus,
  FileText,
  Share2,
  Check,
  Upload,
  Search,
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

const CATEGORY_GRADIENTS: Record<string, { bg: string; blur1: string; blur2: string }> = {
  design: { bg: "from-teal/30 via-accent/20 to-pink/20", blur1: "bg-teal/20", blur2: "bg-accent/20" },
  music: { bg: "from-pink/30 via-accent/20 to-warm/20", blur1: "bg-pink/25", blur2: "bg-warm/15" },
  photo: { bg: "from-warm/25 via-muted to-teal/20", blur1: "bg-warm/20", blur2: "bg-teal/15" },
  video: { bg: "from-accent/25 via-pink/15 to-teal/15", blur1: "bg-accent/20", blur2: "bg-pink/15" },
  writing: { bg: "from-muted via-teal/10 to-accent/15", blur1: "bg-teal/15", blur2: "bg-accent/10" },
};

const CATEGORY_UPLOAD_HINTS: Record<string, { accept: string; hint: string; linkHint: string }> = {
  design: { accept: "image/*,.pdf,.ai,.psd,.fig", hint: "JPG, PNG, PDF, or design files", linkHint: "Behance, Dribbble, Figma link" },
  music: { accept: "audio/*,.mp3,.wav,.flac,.aac", hint: "MP3, WAV, FLAC, or audio files", linkHint: "Spotify, YouTube Music, SoundCloud link" },
  photo: { accept: "image/*,.raw,.cr2,.nef", hint: "JPG, PNG, TIFF, or RAW files", linkHint: "Flickr, 500px, or direct image link" },
  video: { accept: "video/*,.mp4,.mov,.webm", hint: "MP4, MOV, WebM, or video files", linkHint: "YouTube, Vimeo link" },
  writing: { accept: ".txt,.md,.pdf,.doc,.docx", hint: "TXT, PDF, DOC, or text files", linkHint: "Medium, Substack, or blog link" },
};

const FlowModePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [calibrated, setCalibrated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("design");
  const [newLink, setNewLink] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateZ = useTransform(x, [-200, 200], [-12, 12]);
  const cardOpacity = useTransform(x, [-200, -100, 0, 100, 200], [0.7, 0.9, 1, 0.9, 0.7]);

  useEffect(() => {
    const saved = localStorage.getItem(`flow-calibrated-${user?.id}`);
    if (saved) {
      setCalibrated(true);
      setSelectedCategories(JSON.parse(saved));
    }
  }, [user]);

  const { data: flowItems } = useQuery({
    queryKey: ["flow-items", selectedCategories, searchQuery],
    queryFn: async () => {
      let query = supabase.from("flow_items").select("*").order("created_at", { ascending: false }).limit(50);
      if (selectedCategories.length > 0) {
        query = query.in("category", selectedCategories);
      }
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`);
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
      const { data } = await supabase.from("smartboards").select("id, title, cover_color").eq("user_id", user!.id);
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
      let fileUrl: string | null = null;

      if (newFile) {
        const ext = newFile.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("flow-uploads").upload(path, newFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("flow-uploads").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const contentType = newFile
        ? (newFile.type.startsWith("image") ? "image" : newFile.type.startsWith("video") ? "video" : newFile.type.startsWith("audio") ? "audio" : "file")
        : (newLink ? "link" : "text");

      const { error } = await supabase.from("flow_items").insert({
        user_id: user!.id,
        title: newTitle,
        description: newDesc || null,
        category: newCategory,
        link_url: newLink || null,
        file_url: fileUrl,
        content_type: contentType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      setAddOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewLink("");
      setNewFile(null);
      toast.success("Content shared to Flow!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unseenItems = flowItems?.filter((item) => !interactions?.has(item.id)) ?? [];
  const currentItem = unseenItems[currentIndex];
  const gradient = currentItem ? (CATEGORY_GRADIENTS[currentItem.category] || CATEGORY_GRADIENTS.design) : CATEGORY_GRADIENTS.design;

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

  const advanceCard = useCallback(() => {
    setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, unseenItems.length - 1));
      setExpandedCard(false);
    }, 200);
  }, [unseenItems.length]);

  const performAction = useCallback((action: string, smartboardId?: string) => {
    if (!currentItem) return;

    if (action === "save") {
      if (smartboardId) {
        interact.mutate({ itemId: currentItem.id, action, smartboardId });
        toast.success("Saved to board!");
        setSavePickerOpen(false);
        advanceCard();
      } else {
        setSavePickerOpen(true);
        return;
      }
    } else if (action === "share") {
      interact.mutate({ itemId: currentItem.id, action });
      toast("Shared!");
      advanceCard();
    } else {
      interact.mutate({ itemId: currentItem.id, action });
      advanceCard();
    }
  }, [currentItem, interact, advanceCard]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset } = info;
    const threshold = 80;

    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      if (offset.x > threshold) performAction("skip");
      else if (offset.x < -threshold) performAction("share");
    } else {
      if (offset.y < -threshold) performAction("save");
      else if (offset.y > threshold) performAction("dislike");
    }
  }, [performAction]);

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
      <div className="relative flex items-center justify-center min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 overflow-hidden gradient-hero">
        {/* Decorative blurs */}
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-pink/10 rounded-full blur-3xl" />

        <AnimatePresence mode="wait">
          {onboardingStep === 0 && (
            <motion.div
              key="types"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center px-6"
            >
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
                      <ct.icon className="h-7 w-7 text-foreground/40" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium text-foreground/40 tracking-wider">
                        {ct.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <h2 className="font-display text-xl font-bold text-foreground mb-2">What are you into?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
                We're redefining how you discover meaningful content. Let's calibrate your Flow.
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

          {onboardingStep === 1 && (
            <motion.div
              key="swipe"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center px-6"
            >
              <h2 className="font-display text-xl font-bold text-foreground mb-2">How it works</h2>
              <p className="text-sm text-muted-foreground mb-10 max-w-xs mx-auto">
                Swipe or use arrow keys to interact with content.
              </p>

              <div className="relative mx-auto mb-10" style={{ width: 280, height: 340 }}>
                {/* Direction labels — positioned outside card with space */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ top: -36 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <ChevronUp className="h-4 w-4 text-foreground/50" />
                  <span className="text-[11px] font-semibold text-foreground/50 tracking-widest">SAVE</span>
                </motion.div>

                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ bottom: -36 }}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <span className="text-[11px] font-semibold text-foreground/50 tracking-widest">DISLIKE</span>
                  <ChevronDown className="h-4 w-4 text-foreground/50" />
                </motion.div>

                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ left: -72 }}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <ChevronLeft className="h-4 w-4 text-foreground/50" />
                  <span className="text-[11px] font-semibold text-foreground/50 tracking-widest">SHARE</span>
                </motion.div>

                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1"
                  style={{ right: -68 }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <span className="text-[11px] font-semibold text-foreground/50 tracking-widest">NEXT</span>
                  <ChevronRight className="h-4 w-4 text-foreground/50" />
                </motion.div>

                {/* Card */}
                <motion.div
                  className="w-full h-full rounded-3xl bg-card shadow-xl border border-border/40 flex items-center justify-center"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                >
                  <Fingerprint className="h-12 w-12 text-muted-foreground/20" />
                </motion.div>
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

  // ──── MAIN FLOW VIEW — immersive fullscreen ────
  return (
    <div className="relative flex flex-col min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8">
      {/* Dynamic gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient.bg} transition-all duration-700`} />
      <div className={`absolute top-10 left-1/4 w-80 h-80 ${gradient.blur1} rounded-full blur-3xl animate-pulse`} />
      <div className={`absolute bottom-10 right-1/4 w-96 h-96 ${gradient.blur2} rounded-full blur-3xl`} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-4 md:px-6">
        {/* Search toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9 shrink-0"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap justify-center flex-1">
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategories.includes(cat) ? "default" : "outline"}
              className="cursor-pointer capitalize text-xs rounded-full backdrop-blur-sm"
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

        {/* Share button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9 shrink-0"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search bar (expandable) */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 px-4 md:px-6 overflow-hidden"
          >
            <div className="max-w-md mx-auto pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Flow content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentIndex(0);
                  }}
                  className="pl-9 pr-9 rounded-full bg-card/80 backdrop-blur-sm border-border/50"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setCurrentIndex(0); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card area — centered */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {currentItem ? (
            <motion.div
              key={currentItem.id}
              className="w-full max-w-xs md:max-w-sm cursor-grab active:cursor-grabbing"
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotateZ, opacity: cardOpacity }}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            >
              {/* Polaroid card */}
              <div className="rounded-2xl bg-card shadow-2xl overflow-hidden border border-border/50">
                {/* Image / Visual area */}
                <div className="aspect-[4/5] bg-muted/30 relative overflow-hidden">
                  {currentItem.file_url ? (
                    <img
                      src={currentItem.file_url}
                      alt={currentItem.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient.bg} flex items-center justify-center p-8`}>
                      <div className="text-center">
                        <Badge variant="outline" className="mb-4 capitalize rounded-full bg-card/60 backdrop-blur-sm text-xs">
                          {currentItem.category}
                        </Badge>
                        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground leading-tight">
                          {currentItem.title}
                        </h2>
                      </div>
                    </div>
                  )}

                  {/* Category label on images */}
                  {currentItem.file_url && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-medium uppercase tracking-widest text-card bg-foreground/60 backdrop-blur-sm px-2 py-1 rounded-full">
                        {currentItem.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info section */}
                <div className="p-4">
                  {/* Action icons */}
                  <div className="flex items-center gap-4 mb-3">
                    <button
                      onClick={() => performAction("save")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => performAction("share")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>

                  <h3 className="font-display font-bold text-foreground text-sm md:text-base leading-snug">
                    {currentItem.title}
                  </h3>

                  {currentItem.description && (
                    <p
                      className={`text-sm text-muted-foreground leading-relaxed mt-1 ${
                        expandedCard ? "" : "line-clamp-2"
                      }`}
                      onClick={() => setExpandedCard(!expandedCard)}
                    >
                      {currentItem.description}
                    </p>
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
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-card/60 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">You're all caught up!</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Share your own content or check back later.
              </p>
              <Button onClick={() => setAddOpen(true)} className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" />
                Share Your Work
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex justify-center items-center pb-4 gap-6">
        {currentItem && (
          <div className="hidden md:flex items-center gap-8 text-foreground/40">
            <span className="flex items-center gap-1 text-xs"><ChevronUp className="h-3.5 w-3.5" /> Save</span>
            <span className="flex items-center gap-1 text-xs"><ChevronLeft className="h-3.5 w-3.5" /> Share</span>
            <span className="flex items-center gap-1 text-xs"><ChevronRight className="h-3.5 w-3.5" /> Next</span>
            <span className="flex items-center gap-1 text-xs"><ChevronDown className="h-3.5 w-3.5" /> Dislike</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 text-xs gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Share Your Work
        </Button>
      </div>

      {/* Save to Board picker */}
      <Dialog open={savePickerOpen} onOpenChange={setSavePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Add to...
              <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={() => setSavePickerOpen(false)}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
            {smartboards?.map((board) => (
              <button
                key={board.id}
                onClick={() => performAction("save", board.id)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div
                  className="h-16 rounded-lg mb-2"
                  style={{ backgroundColor: board.cover_color || "hsl(var(--muted))" }}
                />
                <h4 className="font-display font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                  {board.title}
                </h4>
              </button>
            ))}
            {(!smartboards || smartboards.length === 0) && (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-6">
                No boards yet. Create one first!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add content dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
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
            <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            <Select value={newCategory} onValueChange={(val) => { setNewCategory(val); setNewFile(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* File upload area */}
            <div>
              <input
                ref={(el) => { fileInputRef.current = el; }}
                type="file"
                accept={CATEGORY_UPLOAD_HINTS[newCategory]?.accept || "*/*"}
                className="hidden"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/30 transition-colors"
              >
                {newFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground truncate max-w-[200px]">{newFile.name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setNewFile(null); }} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-sm text-muted-foreground">{CATEGORY_UPLOAD_HINTS[newCategory]?.hint || "Upload a file"}</p>
                  </>
                )}
              </button>
            </div>

            <Input
              placeholder={CATEGORY_UPLOAD_HINTS[newCategory]?.linkHint || "Link URL (optional)"}
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
            />
            <Button type="submit" className="w-full rounded-full" disabled={!newTitle.trim() || createFlowItem.isPending}>
              {createFlowItem.isPending ? "Sharing..." : "Share to Flow"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlowModePage;
