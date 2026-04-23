import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/storage-utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  StickyNote,
  Link2,
  ImageIcon,
  Video,
  AudioLines,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SmartboardBackground from "@/components/smartboard/SmartboardBackground";

const SmartboardPresentationPage = () => {
  const { id } = useParams<{ id: string }>();
  const [mode, setMode] = useState<"scroll" | "slideshow">("scroll");
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: board } = useQuery({
    queryKey: ["smartboard-public", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboards")
        .select("*")
        .eq("id", id!)
        .eq("is_public", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["smartboard-items-public", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_items")
        .select("*")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Signed URLs expire after 1 hour — re-sign in parallel so the
      // slideshow never shows broken media.
      const rows = data ?? [];
      const resolved = await Promise.all(
        rows.map(async (item) => {
          if (!item.file_url) return item;
          const fresh = await resolveStorageUrl(item.file_url);
          return fresh === item.file_url ? item : { ...item, file_url: fresh };
        }),
      );
      return resolved;
    },
    enabled: !!board,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  // Keyboard navigation for slideshow
  useEffect(() => {
    if (mode !== "slideshow") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(s + 1, (items?.length ?? 1) - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, items?.length]);

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Presentation className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Board not found or is private</p>
        </div>
      </div>
    );
  }

  const renderItem = (item: any, fullSize = false) => {
    const isImage = item.content_type === "image" && item.file_url;
    const isVideo = item.content_type === "video" && item.file_url;
    const isAudio = item.content_type === "audio" && item.file_url;

    return (
      <div
        className={`${
          fullSize
            ? "flex items-center justify-center w-full h-full"
            : "break-inside-avoid"
        }`}
      >
        <div
          className={`rounded-xl overflow-hidden bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg ${
            fullSize ? "max-w-3xl w-full max-h-[85vh]" : ""
          }`}
          style={
            !fullSize && item.item_width && item.item_height
              ? { width: item.item_width, height: item.item_height }
              : undefined
          }
        >
          {isImage && (
            <div className="relative">
              <img
                src={item.file_url}
                alt={item.title || "Image"}
                className={`w-full object-cover ${fullSize ? "max-h-[70vh]" : ""}`}
                loading="lazy"
              />
              {item.title && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <span className="text-white text-base font-medium">{item.title}</span>
                </div>
              )}
            </div>
          )}

          {isVideo && (
            <div>
              <video
                src={item.file_url}
                className={`w-full ${fullSize ? "max-h-[70vh]" : ""}`}
                controls
                preload="metadata"
              />
              {item.title && (
                <div className="p-4">
                  <span className="font-medium text-foreground">{item.title}</span>
                </div>
              )}
            </div>
          )}

          {isAudio && (
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <AudioLines className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {item.title && (
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  )}
                  <span className="text-xs text-muted-foreground">Audio</span>
                </div>
              </div>
              <audio src={item.file_url} controls className="w-full" preload="metadata" />
            </div>
          )}

          {!isImage && !isVideo && !isAudio && (
            <div className={`p-5 ${fullSize ? "text-center" : ""}`}>
              <div
                className={`flex items-center gap-2 mb-3 ${
                  fullSize ? "justify-center" : ""
                }`}
              >
                {item.content_type === "link" ? (
                  <Link2 className="h-4 w-4 text-primary" />
                ) : (
                  <StickyNote className="h-4 w-4 text-primary" />
                )}
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {item.content_type}
                </span>
              </div>
              {item.title && (
                <h3 className={`font-semibold text-foreground mb-2 ${fullSize ? "text-2xl" : "text-sm"}`}>
                  {item.title}
                </h3>
              )}
              {item.content && (
                <p className={`text-muted-foreground leading-relaxed ${fullSize ? "text-lg" : "text-sm line-clamp-6"}`}>
                  {item.content}
                </p>
              )}
              {item.link_url && (
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {item.link_url}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <SmartboardBackground
      color={board.background_color}
      url={board.background_url}
      blur={board.background_blur ?? 0}
      opacity={board.background_opacity ?? 100}
      className="min-h-screen"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/60 backdrop-blur-md border-b border-border/30">
        <h1 className="font-display text-lg font-bold text-foreground truncate">
          {board.title}
        </h1>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "scroll" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => setMode("scroll")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Scroll
          </Button>
          <Button
            variant={mode === "slideshow" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => { setMode("slideshow"); setCurrentSlide(0); }}
          >
            <Presentation className="h-4 w-4 mr-1" /> Slides
          </Button>
        </div>
      </div>

      {/* Scroll mode */}
      {mode === "scroll" && items && (
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="columns-2 md:columns-3 gap-4 space-y-4">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {renderItem(item)}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Slideshow mode */}
      {mode === "slideshow" && items && items.length > 0 && (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 56px)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full px-4"
            >
              {renderItem(items[currentSlide], true)}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/90 backdrop-blur-md border border-border rounded-full px-4 py-2 shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground font-medium min-w-[4rem] text-center">
              {currentSlide + 1} / {items.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() =>
                setCurrentSlide((s) => Math.min(s + 1, items.length - 1))
              }
              disabled={currentSlide === items.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Dot indicators */}
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentSlide
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {items?.length === 0 && (
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
          This board has no items yet
        </div>
      )}
    </SmartboardBackground>
  );
};

export default SmartboardPresentationPage;
