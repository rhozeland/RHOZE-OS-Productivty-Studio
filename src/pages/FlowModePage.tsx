import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
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
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
import LinkPreviewCard from "@/components/flow/LinkPreviewCard";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();
  const { isAdmin } = useAdminCheck();
  const queryClient = useQueryClient();
  const [calibrated, setCalibrated] = useState(false);
  const [showIdleHints, setShowIdleHints] = useState(false);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowContentRef = useRef<HTMLDivElement | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"swipe" | "browse">("swipe");
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("design");
  const [newLink, setNewLink] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null); // legacy single-file (unused, kept for type-stability if any)
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Multi-file upload state — each file tracks its own progress, xhr, and error.
  type PendingFile = {
    id: string;
    file: File;
    previewUrl: string;
    status: "ready" | "uploading" | "stalled" | "done" | "error";
    progress: number;
    error: string | null;
    uploadedUrl: string | null;
  };
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  // Map of file id → in-flight XHR + watchdog refs (kept outside state to avoid re-renders).
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const stallTimerMapRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const hardTimeoutMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastProgressMapRef = useRef<Map<string, number>>(new Map());
  // Aggregate publish state used by the action button + confirm step.
  const [publishingIndex, setPublishingIndex] = useState<{ current: number; total: number } | null>(null);

  // Legacy single-upload state retained only for safe cleanup of old refs (no longer rendered).
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "uploading" | "saving" | "stalled" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressAtRef = useRef<number>(0);
  const [newCreatorName, setNewCreatorName] = useState("");
  const [shareStep, setShareStep] = useState<"compose" | "confirm">("compose");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("flow-sound-enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [swipeMap] = useState({
    up: "save",
    down: "share",
    left: "dislike",
    right: "skip",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Validate one file against the current category's accept rules. Returns null if OK,
  // otherwise a human-readable reason.
  const validateAgainstCategory = (file: File): string | null => {
    const acceptStr = CATEGORY_UPLOAD_HINTS[newCategory]?.accept || "*/*";
    const accepts = acceptStr.split(",").map((s) => s.trim()).filter(Boolean);
    const fileName = file.name.toLowerCase();
    const fileType = (file.type || "").toLowerCase();
    const matches = accepts.some((rule) => {
      if (rule === "*/*") return true;
      if (rule.startsWith(".")) return fileName.endsWith(rule.toLowerCase());
      if (rule.endsWith("/*")) return fileType.startsWith(rule.slice(0, -1).toLowerCase());
      return fileType === rule.toLowerCase();
    });
    return matches
      ? null
      : `${file.name}: type not allowed for ${newCategory}. Try: ${CATEGORY_UPLOAD_HINTS[newCategory]?.hint}`;
  };

  // Add files to the pending list. Invalid files surface a single combined error message
  // (older error is replaced) but do not block previously-validated entries.
  const addPendingFiles = (incoming: FileList | File[] | null | undefined) => {
    if (!incoming) return;
    const arr = Array.from(incoming as ArrayLike<File>);
    if (arr.length === 0) return;
    const accepted: PendingFile[] = [];
    const rejections: string[] = [];
    for (const file of arr) {
      const reason = validateAgainstCategory(file);
      if (reason) {
        rejections.push(reason);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "ready",
        progress: 0,
        error: null,
        uploadedUrl: null,
      });
    }
    if (accepted.length) setPendingFiles((prev) => [...prev, ...accepted]);
    if (rejections.length) {
      setFileError(rejections.length === 1 ? rejections[0] : `${rejections.length} files rejected. ${rejections[0]}`);
    } else {
      setFileError(null);
    }
  };

  // Legacy single-file selector kept for backward-compat call sites; routes through addPendingFiles.
  const selectFile = (file: File | null | undefined) => {
    if (!file) return;
    addPendingFiles([file]);
  };

  // Remove a pending file: abort any in-flight xhr, revoke its blob URL, drop from list.
  const removePendingFile = (id: string) => {
    const xhr = xhrMapRef.current.get(id);
    if (xhr) { try { xhr.abort(); } catch {} xhrMapRef.current.delete(id); }
    const stall = stallTimerMapRef.current.get(id);
    if (stall) { clearInterval(stall); stallTimerMapRef.current.delete(id); }
    const hard = hardTimeoutMapRef.current.get(id);
    if (hard) { clearTimeout(hard); hardTimeoutMapRef.current.delete(id); }
    lastProgressMapRef.current.delete(id);
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) { try { URL.revokeObjectURL(target.previewUrl); } catch {} }
      return prev.filter((p) => p.id !== id);
    });
  };

  // Reset everything related to the current pending file batch (used on dialog close & after success).
  const resetPendingFiles = () => {
    pendingFiles.forEach((p) => { try { URL.revokeObjectURL(p.previewUrl); } catch {} });
    xhrMapRef.current.forEach((xhr) => { try { xhr.abort(); } catch {} });
    xhrMapRef.current.clear();
    stallTimerMapRef.current.forEach((t) => clearInterval(t));
    stallTimerMapRef.current.clear();
    hardTimeoutMapRef.current.forEach((t) => clearTimeout(t));
    hardTimeoutMapRef.current.clear();
    lastProgressMapRef.current.clear();
    setPendingFiles([]);
    setFileError(null);
    setPublishingIndex(null);
  };

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

  // Load calibration & check if tutorial was seen
  useEffect(() => {
    const saved = localStorage.getItem(`flow-calibrated-${user?.id}`);
    if (saved) {
      setCalibrated(true);
      setSelectedCategories(JSON.parse(saved));

      // Show tutorial overlay for first-time users
      const tutorialSeen = localStorage.getItem(`flow-tutorial-seen-${user?.id}`);
      if (!tutorialSeen) {
        setShowTutorialOverlay(true);
        tutorialTimerRef.current = setTimeout(() => {
          setShowTutorialOverlay(false);
          localStorage.setItem(`flow-tutorial-seen-${user?.id}`, "true");
        }, 8000);
      }
    }
    return () => {
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
    };
  }, [user]);

  const { data: flowItems } = useQuery({
    queryKey: ["flow-items", selectedCategories],
    queryFn: async () => {
      let items: any[] = [];

      // First try with selected categories
      if (selectedCategories.length > 0 && selectedCategories.length < CATEGORIES.length) {
        const { data, error } = await supabase.from("flow_items").select("*")
          .in("category", selectedCategories)
          .order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        if (data && data.length > 0) items = data;
      }

      // Fallback: fetch all items
      if (items.length === 0) {
        const { data, error } = await supabase.from("flow_items").select("*")
          .order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        items = data ?? [];
      }

      // Batch-fetch uploader profiles
      const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        items = items.map((i) => ({ ...i, profiles: profileMap.get(i.user_id) || null }));
      }

      return items;
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
      let query = supabase.from("flow_items").delete().eq("id", itemId);
      if (!isAdmin) query = query.eq("user_id", user!.id);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cleanup any in-flight upload trackers
  const clearUploadTimers = () => {
    if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }
    if (hardTimeoutRef.current) { clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null; }
  };

  // Cancel every in-flight per-file upload + clear watchdogs. Used on dialog close.
  const cancelUpload = () => {
    xhrMapRef.current.forEach((xhr) => { try { xhr.abort(); } catch {} });
    xhrMapRef.current.clear();
    stallTimerMapRef.current.forEach((t) => clearInterval(t));
    stallTimerMapRef.current.clear();
    hardTimeoutMapRef.current.forEach((t) => clearTimeout(t));
    hardTimeoutMapRef.current.clear();
    lastProgressMapRef.current.clear();
    // Mark any in-flight files as cancelled (visually).
    setPendingFiles((prev) =>
      prev.map((f) =>
        f.status === "uploading" || f.status === "stalled"
          ? { ...f, status: "ready", progress: 0 }
          : f,
      ),
    );
    setPublishingIndex(null);
    // Legacy single-upload cleanup (defensive — UI no longer uses it).
    if (xhrRef.current) { try { xhrRef.current.abort(); } catch {} xhrRef.current = null; }
    clearUploadTimers();
    setUploadStage("idle");
    setUploadProgress(0);
    setUploadError(null);
  };

  // Helper: patch a single pending file by id without touching others.
  const patchPendingFile = (id: string, patch: Partial<PendingFile>) => {
    setPendingFiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  // Upload one pending file with real progress/stall/timeout tracking.
  // Updates `pendingFiles[id]` directly. Resolves with the public URL.
  const uploadPendingFile = (pf: PendingFile, path: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        patchPendingFile(pf.id, { status: "error", error: "Not authenticated" });
        reject(new Error("Not authenticated"));
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = `${supabaseUrl}/storage/v1/object/flow-uploads/${encodeURI(path)}`;
      const xhr = new XMLHttpRequest();
      xhrMapRef.current.set(pf.id, xhr);

      const STALL_MS = 15000;
      const HARD_TIMEOUT_MS = 120000;

      lastProgressMapRef.current.set(pf.id, Date.now());
      patchPendingFile(pf.id, { status: "uploading", progress: 0, error: null });

      const stallTimer = setInterval(() => {
        const last = lastProgressMapRef.current.get(pf.id) || Date.now();
        if (Date.now() - last > STALL_MS) {
          patchPendingFile(pf.id, { status: "stalled" });
        }
      }, 1000);
      stallTimerMapRef.current.set(pf.id, stallTimer);

      const hardTimer = setTimeout(() => {
        try { xhr.abort(); } catch {}
        clearInterval(stallTimer);
        stallTimerMapRef.current.delete(pf.id);
        hardTimeoutMapRef.current.delete(pf.id);
        patchPendingFile(pf.id, { status: "error", error: "Upload timed out. Check your connection." });
        reject(new Error("Upload timed out"));
      }, HARD_TIMEOUT_MS);
      hardTimeoutMapRef.current.set(pf.id, hardTimer);

      const cleanupTimers = () => {
        clearInterval(stallTimer);
        clearTimeout(hardTimer);
        stallTimerMapRef.current.delete(pf.id);
        hardTimeoutMapRef.current.delete(pf.id);
        xhrMapRef.current.delete(pf.id);
      };

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        lastProgressMapRef.current.set(pf.id, Date.now());
        const pct = Math.round((evt.loaded / evt.total) * 100);
        // Recover from stalled if data started flowing again.
        setPendingFiles((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? { ...p, progress: pct, status: p.status === "stalled" ? "uploading" : p.status }
              : p,
          ),
        );
      };

      xhr.onload = () => {
        cleanupTimers();
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data: urlData } = supabase.storage.from("flow-uploads").getPublicUrl(path);
          patchPendingFile(pf.id, { status: "done", progress: 100, uploadedUrl: urlData.publicUrl, error: null });
          resolve(urlData.publicUrl);
        } else {
          let msg = `Upload failed (${xhr.status})`;
          try { const body = JSON.parse(xhr.responseText); if (body?.message) msg = body.message; } catch {}
          patchPendingFile(pf.id, { status: "error", error: msg });
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => {
        cleanupTimers();
        patchPendingFile(pf.id, { status: "error", error: "Network error during upload." });
        reject(new Error("Network error"));
      };

      xhr.onabort = () => {
        cleanupTimers();
        // Don't overwrite a status the caller may have set; just resolve as cancelled.
        reject(new Error("Upload cancelled"));
      };

      xhr.open("POST", url, true);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader("x-upsert", "false");
      if (pf.file.type) xhr.setRequestHeader("Content-Type", pf.file.type);
      xhr.send(pf.file);
    });
  };

  // Retry a single failed/cancelled file. Independent of the publish loop so the user
  // can re-upload before the final publish step.
  const retryPendingFile = async (id: string) => {
    const target = pendingFiles.find((p) => p.id === id);
    if (!target) return;
    const ext = target.file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    try {
      await uploadPendingFile(target, path);
    } catch {
      // Error already captured into pendingFiles state by uploadPendingFile.
    }
  };

  const createFlowItem = useMutation({
    mutationFn: async () => {
      // Upload any pending files that haven't completed yet (sequential to keep the UI
      // honest about progress and to avoid hammering Storage).
      const filesToProcess = pendingFiles;
      const total = filesToProcess.length;

      for (let i = 0; i < filesToProcess.length; i++) {
        const pf = filesToProcess[i];
        setPublishingIndex({ current: i + 1, total: Math.max(total, 1) });
        if (!pf.uploadedUrl) {
          const ext = pf.file.name.split(".").pop();
          const path = `${user!.id}/${Date.now()}-${i}.${ext}`;
          try {
            await uploadPendingFile(pf, path);
          } catch (err: any) {
            // Surface the failing file by name so the user knows which row to retry.
            throw new Error(`${pf.file.name}: ${err?.message || "upload failed"}`);
          }
        }
      }

      setPublishingIndex(null);
      // Re-read latest pendingFiles via a functional setter trick (state may have been
      // mutated by uploadPendingFile callbacks). Capture from xhrMap-aware closure:
      const latest = await new Promise<PendingFile[]>((res) => {
        setPendingFiles((cur) => { res(cur); return cur; });
      });

      // Build one flow_items row per file. If there are no files, still publish a single
      // row carrying just the link/text content (preserves prior behavior).
      const baseRow = {
        user_id: user!.id,
        title: newTitle,
        description: newDesc || null,
        category: newCategory,
        link_url: newLink || null,
        creator_name: newCreatorName || null,
      };

      const rows = latest.length === 0
        ? [{ ...baseRow, file_url: null, content_type: newLink ? "link" : "text" }]
        : latest.map((pf) => ({
            ...baseRow,
            file_url: pf.uploadedUrl,
            content_type: pf.file.type.startsWith("image")
              ? "image"
              : pf.file.type.startsWith("video")
              ? "video"
              : pf.file.type.startsWith("audio")
              ? "audio"
              : "file",
          }));

      const { error } = await supabase.from("flow_items").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      setAddOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewLink("");
      setNewCreatorName("");
      setShareStep("compose");
      resetPendingFiles();
      toast.success(pendingFiles.length > 1 ? `Shared ${pendingFiles.length} items to Flow!` : "Content shared to Flow!");
    },
    onError: (e: any) => {
      setPublishingIndex(null);
      if (e?.message !== "Upload cancelled") {
        toast.error(e?.message || "Failed to share");
      }
    },
  });


  // Cleanup on unmount
  useEffect(() => {
    return () => { cancelUpload(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

    // Show tutorial for first-time users after calibration
    const tutorialSeen = localStorage.getItem(`flow-tutorial-seen-${user?.id}`);
    if (!tutorialSeen) {
      setShowTutorialOverlay(true);
      tutorialTimerRef.current = setTimeout(() => {
        setShowTutorialOverlay(false);
        localStorage.setItem(`flow-tutorial-seen-${user?.id}`, "true");
      }, 8000);
    }
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
    if (soundEnabled) playSwipeSound(action === "save" ? "up" : action === "dislike" ? "left" : action === "share" ? "down" : "right");

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

  // Idle hint timer — show corner hints after 4s of no interaction, hide on any activity
  const resetIdleTimer = useCallback(() => {
    setShowIdleHints(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setShowIdleHints(true), 4000);
  }, []);

  useEffect(() => {
    if (!calibrated || !currentItem || viewMode !== "swipe") return;
    resetIdleTimer();
    const events = ["pointerdown", "pointermove", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [calibrated, currentItem, viewMode, resetIdleTimer]);

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
    <div ref={flowContentRef} className="relative flex flex-col min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8">
      {/* Dynamic background */}
      <FlowCardBackground
        fileUrl={currentItem?.file_url}
        category={currentItem?.category || "design"}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-0.5 rounded-full bg-card/60 backdrop-blur-sm border border-border/30 p-0.5">
          <button
            onClick={() => setViewMode("swipe")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "swipe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Swipe
          </button>
          <button
            onClick={() => setViewMode("browse")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "browse" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Browse
          </button>
        </div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg text-xs mt-2"
                    onClick={() => {
                      setSettingsOpen(false);
                      setShowTutorialOverlay(true);
                      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
                      tutorialTimerRef.current = setTimeout(() => {
                        setShowTutorialOverlay(false);
                      }, 8000);
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5 mr-2" />
                    Show Swipe Tutorial
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
            aria-label="Add to Flow"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9"
            onClick={() => navigate("/dashboard")}
            aria-label="Exit Flow Mode"
            title="Exit Flow Mode"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ═══ SWIPE VIEW ═══ */}
      {viewMode === "swipe" && (
        <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-36 pt-2 md:pb-40">
          <AnimatePresence mode="wait">
            {currentItem ? (
              <motion.div
                key={`${currentItem.id}-${currentIndex}`}
                className="w-full max-w-xs md:max-w-sm cursor-grab active:cursor-grabbing will-change-transform"
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.5}
                dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
                onDragEnd={handleDragEnd}
                style={{ x, y, rotateZ, opacity: cardOpacity, scale: cardScale, boxShadow: shadowIntensity }}
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: "easeOut" } }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                whileTap={{ scale: 0.99 }}
              >
                <FlowCard
                  item={currentItem}
                  expanded={expandedCard}
                  onToggleExpand={() => setExpandedCard(!expandedCard)}
                  onSave={() => performAction("save")}
                  onShare={() => performAction("share")}
                  onDelete={() => deleteFlowItem.mutate(currentItem.id)}
                  isOwner={currentItem.user_id === user?.id}
                  isAdmin={isAdmin}
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
      )}

      {/* ═══ BROWSE VIEW ═══ */}
      {viewMode === "browse" && (
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28 pt-2 md:px-8">
          {allItems.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {allItems.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <FlowCard
                    item={item}
                    expanded={false}
                    onToggleExpand={() => {}}
                    onSave={() => performAction("save", undefined, item)}
                    onShare={() => performAction("share", undefined, item)}
                    onDelete={() => deleteFlowItem.mutate(item.id)}
                    isOwner={item.user_id === user?.id}
                    isAdmin={isAdmin}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <Sparkles className="h-8 w-8 text-primary mb-4" />
              <h2 className="mb-2 font-display text-xl font-bold text-foreground">Nothing here yet</h2>
              <p className="mx-auto mb-6 max-w-xs text-sm text-muted-foreground">Be the first to share your work.</p>
              <Button onClick={() => setAddOpen(true)} className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" />
                Share Your Work
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══ FULL SWIPE TUTORIAL OVERLAY — first-time or on-demand ═══ */}
      <AnimatePresence>
        {currentItem && viewMode === "swipe" && showTutorialOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto"
            onClick={() => {
              setShowTutorialOverlay(false);
              localStorage.setItem(`flow-tutorial-seen-${user?.id}`, "true");
              if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
            }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative flex flex-col items-center gap-8">
              {/* Up */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <span className="flex flex-col items-center gap-1 text-white/90">
                  <ChevronUp className="h-6 w-6" />
                  <span className="text-sm font-medium">Save</span>
                </span>
              </motion.div>
              {/* Middle row: Left + Center + Right */}
              <div className="flex items-center gap-16">
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                  <span className="flex items-center gap-1 text-white/90">
                    <ChevronLeft className="h-6 w-6" />
                    <span className="text-sm font-medium">Pass</span>
                  </span>
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
                  <div className="h-16 w-16 rounded-2xl border-2 border-white/30 flex items-center justify-center">
                    <span className="text-white/50 text-xs">Swipe</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <span className="flex items-center gap-1 text-white/90">
                    <span className="text-sm font-medium">Next</span>
                    <ChevronRight className="h-6 w-6" />
                  </span>
                </motion.div>
              </div>
              {/* Down */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <span className="flex flex-col items-center gap-1 text-white/90">
                  <span className="text-sm font-medium">Share</span>
                  <ChevronDown className="h-6 w-6" />
                </span>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/50 text-xs mt-2"
              >
                Tap anywhere to dismiss
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CORNER SWIPE HINTS — appear on idle (only when tutorial not showing) ═══ */}
      <AnimatePresence>
        {currentItem && viewMode === "swipe" && showIdleHints && !showTutorialOverlay && (
          <>
            {/* Top — Save (centered in the card area) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="pointer-events-none absolute left-0 right-0 top-16 z-40 flex justify-center"
            >
              <span className="flex items-center gap-1 rounded-full bg-card/80 border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm" style={{ textShadow: "0 1px 2px hsl(var(--background) / 0.5)" }}>
                <ChevronUp className="h-3 w-3" /> Save
              </span>
            </motion.div>
            {/* Bottom — Share (centered in the card area, above dock) */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="pointer-events-none absolute left-0 right-0 bottom-28 z-40 flex justify-center md:bottom-32"
            >
              <span className="flex items-center gap-1 rounded-full bg-card/80 border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm" style={{ textShadow: "0 1px 2px hsl(var(--background) / 0.5)" }}>
                <ChevronDown className="h-3 w-3" /> Share
              </span>
            </motion.div>
            {/* Left — Pass (constrained inside content, not overlapping sidebar) */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-40 md:left-8"
            >
              <span className="flex items-center gap-1 rounded-full bg-card/80 border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm" style={{ textShadow: "0 1px 2px hsl(var(--background) / 0.5)" }}>
                <ChevronLeft className="h-3 w-3" /> Pass
              </span>
            </motion.div>
            {/* Right — Next */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-40 md:right-8"
            >
              <span className="flex items-center gap-1 rounded-full bg-card/80 border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm" style={{ textShadow: "0 1px 2px hsl(var(--background) / 0.5)" }}>
                Next <ChevronRight className="h-3 w-3" />
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { cancelUpload(); resetPendingFiles(); setShareStep("compose"); } setAddOpen(open); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{shareStep === "confirm" ? "Confirm & publish" : "Share to Flow"}</DialogTitle>
            <DialogDescription>
              {shareStep === "confirm"
                ? "Review your post below. Once everything looks right, publish it to the Flow."
                : "Upload one or more files for others to discover."}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            // ---- Validation summary ----
            const trimmedTitle = newTitle.trim();
            const trimmedLinkRaw = newLink.trim();
            const linkProvided = trimmedLinkRaw.length > 0;
            let linkValid = true;
            if (linkProvided) {
              try {
                const u = new URL(/^https?:\/\//i.test(trimmedLinkRaw) ? trimmedLinkRaw : `https://${trimmedLinkRaw}`);
                linkValid = !!u.hostname && u.hostname.includes(".");
              } catch {
                linkValid = false;
              }
            }
            const fileCount = pendingFiles.length;
            const hasMedia = fileCount > 0 || linkProvided;
            const filesUploading = pendingFiles.some((f) => f.status === "uploading" || f.status === "stalled");
            const filesErrored = pendingFiles.filter((f) => f.status === "error");
            const noFileErrors = filesErrored.length === 0;
            const checks = [
              { ok: !!trimmedTitle, label: "Title added" },
              { ok: hasMedia, label: fileCount > 1 ? `${fileCount} files attached` : "File or link attached" },
              { ok: noFileErrors, label: filesErrored.length > 0 ? `Resolve ${filesErrored.length} file error${filesErrored.length > 1 ? "s" : ""}` : "All files uploaded cleanly" },
              { ok: !linkProvided || linkValid, label: linkProvided ? "Link looks valid" : "Link looks valid (optional)" },
              { ok: !filesUploading, label: "No active uploads" },
            ];
            const allValid = checks.every((c) => c.ok);
            const canPublish = allValid && !createFlowItem.isPending;

            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (shareStep === "compose") {
                    if (allValid) setShareStep("confirm");
                    return;
                  }
                  if (canPublish) createFlowItem.mutate();
                }}
                className="space-y-4"
              >
                {shareStep === "confirm" && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pre-publish checks</p>
                    <ul className="space-y-1.5">
                      {checks.map((c) => (
                        <li key={c.label} className="flex items-center gap-2 text-sm">
                          <span className={cn(
                            "h-4 w-4 rounded-full flex items-center justify-center shrink-0",
                            c.ok ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {c.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <X className="h-2.5 w-2.5" strokeWidth={3} />}
                          </span>
                          <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                        </li>
                      ))}
                    </ul>
                    {!allValid && (
                      <p className="text-[11px] text-muted-foreground pt-1">Go back to fix the items above before publishing.</p>
                    )}
                  </div>
                )}

                {/* Link/text live preview (only when no files attached, to keep the dialog scannable). */}
                {fileCount === 0 && (() => {
                  const trimmedLink = newLink.trim();
                  const linkLooksImage = /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(trimmedLink);
                  const ytMatch = trimmedLink.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
                  const vimeoMatch = trimmedLink.match(/vimeo\.com\/(\d+)/);

                  if (!trimmedLink) {
                    return (
                      <div className="aspect-video rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
                        <Upload className="h-7 w-7 mb-1.5 opacity-40" />
                        <p className="text-xs font-body">Preview will appear here</p>
                      </div>
                    );
                  }
                  return (
                    <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
                      {linkLooksImage && (
                        <img src={trimmedLink} alt="link preview" className="w-full max-h-72 object-contain bg-background" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      {!linkLooksImage && ytMatch && (
                        <div className="aspect-video bg-background">
                          <iframe
                            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                            title="YouTube preview"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {!linkLooksImage && !ytMatch && vimeoMatch && (
                        <div className="aspect-video bg-background">
                          <iframe
                            src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                            title="Vimeo preview"
                            className="w-full h-full"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {!linkLooksImage && !ytMatch && !vimeoMatch && (
                        <LinkPreviewCard url={trimmedLink} />
                      )}
                    </div>
                  );
                })()}

                {/* Per-file preview list — visible in BOTH compose and confirm steps */}
                {fileCount > 0 && (
                  <div className="space-y-2" role="list" aria-label="Files to share">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        {fileCount} file{fileCount > 1 ? "s" : ""}
                      </p>
                      {shareStep === "compose" && filesErrored.length > 0 && (
                        <span className="text-[11px] text-destructive">{filesErrored.length} failed</span>
                      )}
                    </div>
                    {pendingFiles.map((pf) => {
                      const isImg = pf.file.type.startsWith("image/");
                      const isVid = pf.file.type.startsWith("video/");
                      const isAud = pf.file.type.startsWith("audio/");
                      const showProgress = pf.status === "uploading" || pf.status === "stalled" || (pf.status === "done" && pf.progress > 0 && pf.progress < 100);
                      return (
                        <div
                          key={pf.id}
                          role="listitem"
                          className={cn(
                            "rounded-xl border bg-background/40 p-2.5 flex gap-3 items-start transition-colors",
                            pf.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border",
                          )}
                        >
                          {/* Thumbnail */}
                          <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                            {isImg ? (
                              <img src={pf.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : isVid ? (
                              <video src={pf.previewUrl} className="h-full w-full object-cover" muted playsInline />
                            ) : isAud ? (
                              <div className="text-muted-foreground text-[10px] font-medium">AUDIO</div>
                            ) : (
                              <div className="text-muted-foreground text-[10px] font-medium uppercase">
                                {pf.file.name.split(".").pop()?.slice(0, 4) || "FILE"}
                              </div>
                            )}
                          </div>

                          {/* Meta + progress + actions */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate" title={pf.file.name}>{pf.file.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {(pf.file.size / 1024).toFixed(0)} KB
                                  {pf.status === "done" && <span className="text-primary"> · Uploaded</span>}
                                  {pf.status === "uploading" && <span> · Uploading {pf.progress}%</span>}
                                  {pf.status === "stalled" && <span className="text-foreground/70"> · Stalled — retrying</span>}
                                  {pf.status === "error" && <span className="text-destructive"> · Failed</span>}
                                  {pf.status === "ready" && <span> · Ready</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(pf.status === "error" || pf.status === "stalled") && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    aria-label={`Retry ${pf.file.name}`}
                                    onClick={() => retryPendingFile(pf.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label={`Remove ${pf.file.name}`}
                                  disabled={createFlowItem.isPending}
                                  onClick={() => removePendingFile(pf.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {showProgress && (
                              <Progress value={pf.progress} className="h-1" />
                            )}
                            {pf.status === "stalled" && (
                              <div className="flex items-center gap-1.5 text-[11px] text-foreground/70">
                                <AlertTriangle className="h-3 w-3" />
                                <span>No data has moved in 15s.</span>
                              </div>
                            )}
                            {pf.status === "error" && pf.error && (
                              <p className="text-[11px] text-destructive break-words" role="alert">{pf.error}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {shareStep === "compose" && (
                  <>
                    <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <Input placeholder="Creator / Artist name (optional)" value={newCreatorName} onChange={(e) => setNewCreatorName(e.target.value)} />
                    <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
                    <Select value={newCategory} onValueChange={(val) => { setNewCategory(val); resetPendingFiles(); }}>
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
                        multiple
                        accept={CATEGORY_UPLOAD_HINTS[newCategory]?.accept || "*/*"}
                        className="hidden"
                        onChange={(e) => { addPendingFiles(e.target.files); e.target.value = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current += 1;
                          if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current -= 1;
                          if (dragCounterRef.current <= 0) {
                            dragCounterRef.current = 0;
                            setIsDragging(false);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragCounterRef.current = 0;
                          setIsDragging(false);
                          addPendingFiles(e.dataTransfer.files);
                        }}
                        aria-label="Upload files or drop here"
                        className={cn(
                          "w-full border-2 border-dashed rounded-xl p-4 text-center transition-all",
                          isDragging
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : fileError
                            ? "border-destructive/60 hover:border-destructive"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        {isDragging ? (
                          <>
                            <Upload className="h-5 w-5 text-primary mx-auto mb-1 animate-pulse" />
                            <p className="text-sm text-primary font-medium">Drop files to upload</p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                            <p className="text-sm text-muted-foreground">
                              {fileCount > 0 ? "Add more files" : (CATEGORY_UPLOAD_HINTS[newCategory]?.hint || "Upload files")}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1">Click or drag &amp; drop · multiple allowed</p>
                          </>
                        )}
                      </button>
                      {fileError && (
                        <p className="text-xs text-destructive mt-1.5 px-1" role="alert">{fileError}</p>
                      )}
                    </div>

                    <Input
                      placeholder={CATEGORY_UPLOAD_HINTS[newCategory]?.linkHint || "Link URL (optional)"}
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                    />
                  </>
                )}

                {shareStep === "confirm" && (
                  <div className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Post details</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="text-muted-foreground text-xs w-20 shrink-0">Title</span>
                        <span className="text-foreground font-medium break-words">{newTitle.trim() || <span className="text-muted-foreground italic">—</span>}</span>
                      </div>
                      {newCreatorName.trim() && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-muted-foreground text-xs w-20 shrink-0">Creator</span>
                          <span className="text-foreground break-words">{newCreatorName.trim()}</span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-2">
                        <span className="text-muted-foreground text-xs w-20 shrink-0">Category</span>
                        <span className="text-foreground capitalize">{newCategory}</span>
                      </div>
                      {newDesc.trim() && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-muted-foreground text-xs w-20 shrink-0">Description</span>
                          <span className="text-foreground break-words">{newDesc.trim()}</span>
                        </div>
                      )}
                      {fileCount > 0 && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-muted-foreground text-xs w-20 shrink-0">Files</span>
                          <span className="text-foreground">
                            {fileCount} item{fileCount > 1 ? "s" : ""} · publishes one Flow card per file
                          </span>
                        </div>
                      )}
                      {newLink.trim() && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-muted-foreground text-xs w-20 shrink-0">Link</span>
                          <span className="text-foreground break-all">{newLink.trim()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Aggregate publish progress (visible during the publish loop) */}
                {publishingIndex && (
                  <div className="rounded-xl border border-border bg-muted/40 p-3" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Publishing file {publishingIndex.current} of {publishingIndex.total}…</span>
                    </div>
                  </div>
                )}

                {shareStep === "compose" ? (
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    disabled={!allValid || createFlowItem.isPending}
                  >
                    Review &amp; confirm
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={createFlowItem.isPending}
                      onClick={() => setShareStep("compose")}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 rounded-full"
                      disabled={!canPublish}
                      aria-disabled={!canPublish}
                    >
                      {createFlowItem.isPending
                        ? (publishingIndex
                            ? `Publishing ${publishingIndex.current}/${publishingIndex.total}…`
                            : "Publishing…")
                        : fileCount > 1
                        ? `Publish ${fileCount} items`
                        : "Publish to Flow"}
                    </Button>
                  </div>
                )}
              </form>
            );
          })()}
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
