import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Check,
  Upload,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { toast } from "sonner";
import { playSwipeSound } from "@/lib/swipe-sound";
import FlowCard from "@/components/flow/FlowCard";
import FlowCardBackground from "@/components/flow/FlowCardBackground";
import FlowShareDialog from "@/components/flow/FlowShareDialog";

const CATEGORIES = ["design", "music", "photo", "video", "writing"];

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("design");
  const [newLink, setNewLink] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("flow-sound-enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [swipeMap] = useState({
    up: "save",
    down: "dislike",
    left: "share",
    right: "skip",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateZ = useTransform(x, [-200, 200], [-8, 8]);
  const cardOpacity = useTransform(x, [-200, -100, 0, 100, 200], [0.8, 0.95, 1, 0.95, 0.8]);
  const cardScale = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    [0.97, 0.99, 1, 0.99, 0.97]
  );
  const shadowIntensity = useTransform(
    x,
    [-150, 0, 150],
    ["0 8px 30px -8px hsl(var(--foreground) / 0.15)", "0 20px 40px -12px hsl(var(--foreground) / 0.08)", "0 8px 30px -8px hsl(var(--foreground) / 0.15)"]
  );

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
      let query = supabase.from("flow_items").select("*").order("created_at", { ascending: false }).limit(100);
      if (selectedCategories.length > 0) {
        query = query.in("category", selectedCategories);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
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
  });

  const deleteFlowItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("flow_items").delete().eq("id", itemId).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      toast.success("Deleted");
      // Don't advance — the list will re-render and currentIndex stays, pointing to the next item
    },
    onError: (e: any) => toast.error(e.message),
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

  // All items — loop through them endlessly
  const allItems = flowItems ?? [];
  const currentItem = allItems.length > 0 ? allItems[currentIndex % allItems.length] : null;

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
      setCurrentIndex((i) => i + 1); // No cap — modulo handles looping
      setExpandedCard(false);
    }, 200);
  }, []);

  const performAction = useCallback((action: string, smartboardId?: string, item?: any) => {
    const targetItem = item || currentItem;
    if (!targetItem) return;
    if (navigator.vibrate) navigator.vibrate(20);
    if (soundEnabled) playSwipeSound(action === "save" ? "up" : action === "dislike" ? "down" : action === "share" ? "left" : "right");

    if (action === "save") {
      if (smartboardId) {
        interact.mutate({ itemId: targetItem.id, action, smartboardId });
        toast.success("Saved to board!");
        setSavePickerOpen(false);
        advanceCard();
      } else {
        setShareItem(targetItem);
        setSavePickerOpen(true);
        return;
      }
    } else if (action === "share") {
      setShareItem(targetItem);
      setShareDialogOpen(true);
      return;
    } else {
      interact.mutate({ itemId: targetItem.id, action });
      advanceCard();
    }
  }, [currentItem, interact, advanceCard, soundEnabled]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset } = info;
    const threshold = 80;

    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      if (offset.x > threshold) performAction(swipeMap.right);
      else if (offset.x < -threshold) performAction(swipeMap.left);
    } else {
      if (offset.y < -threshold) performAction(swipeMap.up);
      else if (offset.y > threshold) performAction(swipeMap.down);
    }
  }, [performAction, swipeMap]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!calibrated || !currentItem) return;
      if (e.key === "ArrowUp") performAction(swipeMap.up);
      if (e.key === "ArrowDown") performAction(swipeMap.down);
      if (e.key === "ArrowLeft") performAction(swipeMap.left);
      if (e.key === "ArrowRight") performAction(swipeMap.right);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [calibrated, currentItem, performAction, swipeMap]);

  // ──── ONBOARDING ────
  if (!calibrated) {
    return (
      <div className="relative flex items-center justify-center min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 overflow-hidden bg-gradient-to-br from-muted via-background to-muted/50">
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center px-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center"
          >
            <Sparkles className="h-8 w-8 text-primary" />
          </motion.div>

          <h2 className="font-display text-xl font-bold text-foreground mb-2">What are you into?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs mx-auto">
            Calibrate your feed. Pick what inspires you.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
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

          <Button onClick={finishCalibration} className="rounded-full px-8">
            Enter Flow
          </Button>
        </motion.div>
      </div>
    );
  }

  // ──── MAIN SWIPE VIEW ────
  return (
    <div className="relative flex flex-col min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8">
      {/* Dynamic background */}
      <FlowCardBackground
        fileUrl={currentItem?.file_url}
        category={currentItem?.category || "design"}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <p className="text-sm text-muted-foreground">
          Swipe or browse
        </p>

        <div className="flex items-center gap-1.5 shrink-0">
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9">
                <Settings2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[340px] flex flex-col">
              <SheetHeader>
                <SheetTitle className="font-display">Flow Settings</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto space-y-6 pt-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Content Types</h3>
                  <div className="space-y-2.5">
                    {CATEGORIES.map((cat) => (
                      <div key={cat} className="flex items-center justify-between">
                        <Label htmlFor={`cat-${cat}`} className="capitalize text-sm cursor-pointer">{cat}</Label>
                        <Switch
                          id={`cat-${cat}`}
                          checked={selectedCategories.includes(cat)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...selectedCategories, cat]
                              : selectedCategories.filter((c) => c !== cat);
                            const final = updated.length === 0 ? CATEGORIES : updated;
                            setSelectedCategories(final);
                            localStorage.setItem(`flow-calibrated-${user?.id}`, JSON.stringify(final));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other</h3>
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="sound-toggle" className="text-sm cursor-pointer">Swipe sounds</Label>
                    <Switch
                      id="sound-toggle"
                      checked={soundEnabled}
                      onCheckedChange={(checked) => {
                        setSoundEnabled(checked);
                        localStorage.setItem("flow-sound-enabled", String(checked));
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg text-xs"
                    onClick={() => {
                      setSettingsOpen(false);
                      setCalibrated(false);
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                    Recalibrate
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Card area — centered */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-40 pt-2 md:pb-44">
        <AnimatePresence mode="wait">
          {currentItem ? (
            <motion.div
              key={`${currentItem.id}-${currentIndex}`}
              className="w-full max-w-xs md:max-w-sm cursor-grab active:cursor-grabbing"
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.6}
              dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
              onDragEnd={handleDragEnd}
              style={{ x, y, rotateZ, opacity: cardOpacity, scale: cardScale, boxShadow: shadowIntensity }}
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              whileTap={{ scale: 0.98 }}
            >
            >
              <FlowCard
                item={currentItem}
                expanded={expandedCard}
                onToggleExpand={() => setExpandedCard(!expandedCard)}
                onSave={() => performAction("save")}
                onShare={() => performAction("share")}
                onDelete={() => deleteFlowItem.mutate(currentItem.id)}
                isOwner={currentItem.user_id === user?.id}
              />
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center px-4">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-card/60 backdrop-blur-sm">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 font-display text-xl font-bold text-foreground">Nothing here yet</h2>
              <p className="mx-auto mb-6 max-w-xs text-sm text-muted-foreground">Be the first to share your work.</p>
              <Button onClick={() => setAddOpen(true)} className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" />
                Share Your Work
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentItem && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 w-full -translate-x-1/2 px-4 md:bottom-28">
          <div className="mx-auto inline-flex max-w-fit items-center gap-4 rounded-full border border-border/30 bg-card/70 px-4 py-2 backdrop-blur-sm md:gap-6 md:px-5 md:py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
              <ChevronUp className="h-3.5 w-3.5" /> Save
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
              <ChevronDown className="h-3.5 w-3.5" /> Pass
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
              <ChevronLeft className="h-3.5 w-3.5" /> Share
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
              <ChevronRight className="h-3.5 w-3.5" /> Next
            </span>
          </div>
        </div>
      )}

      {/* Save to Board picker */}
      <Dialog open={savePickerOpen} onOpenChange={setSavePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Save to board</DialogTitle>
            <DialogDescription>Choose a Smartboard to save this content to.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
            {smartboards?.map((board) => (
              <button
                key={board.id}
                onClick={() => performAction("save", board.id, shareItem)}
                className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="h-16 rounded-lg mb-2" style={{ backgroundColor: board.cover_color || "hsl(var(--muted))" }} />
                <h4 className="font-display font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                  {board.title}
                </h4>
              </button>
            ))}
            {(!smartboards || smartboards.length === 0) && (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-6">No boards yet. Create one first!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add content dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share to Flow</DialogTitle>
            <DialogDescription>Upload your work for others to discover.</DialogDescription>
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

            <div>
              <input
                ref={fileInputRef}
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
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setNewFile(null); }}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
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

      {/* Share to user dialog */}
      <FlowShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        item={shareItem}
      />
    </div>
  );
};

export default FlowModePage;
