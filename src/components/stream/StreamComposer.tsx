/**
 * StreamComposer — the v7 "Drop" composer at the top of /stream.
 *
 * One inline surface offering all post types. Text-style posts (a quick
 * thought + optional link/image) submit inline against `flow_items` so
 * they appear immediately in the Conversations lane. Richer types
 * (offering, opportunity, event, space, work, project) navigate to their
 * existing canonical creation surfaces — we don't re-implement those
 * flows here, we just put a single front door on top of them.
 *
 * Lane-aware: the active lane sets the default selected type, so the
 * primary action button reads naturally ("Drop" on Conversations,
 * "Post Offering" on Offerings, etc.).
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Flame,
  Briefcase,
  CalendarDays,
  Building2,
  Shield,
  Send,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type StreamPostType =
  | "text"
  | "offering"
  | "event"
  | "space"
  | "work";

interface TypeMeta {
  key: StreamPostType;
  label: string;
  icon: typeof Flame;
  /** Inline composer (text) vs. navigates to canonical creation page */
  inline: boolean;
  /** Where to navigate for non-inline types */
  href?: string;
  /** CTA copy when this type is selected */
  cta: string;
}

const TYPES: TypeMeta[] = [
  { key: "text",     label: "Update",   icon: Flame,         inline: true,  cta: "Post Update" },
  { key: "offering", label: "Offering", icon: Briefcase,     inline: false, href: "/marketplace?compose=service", cta: "Post Offering" },
  { key: "event",    label: "Event",    icon: CalendarDays,  inline: false, href: "/spaces/events/new",           cta: "Host Event" },
  { key: "space",    label: "Space",    icon: Building2,     inline: false, href: "/studios/apply",               cta: "List Space" },
  { key: "work",     label: "Work",     icon: Shield,        inline: false, href: "/works",                       cta: "Anchor Work" },
];

interface Props {
  /** Active lane in Stream — drives the default selected type. */
  defaultType?: StreamPostType;
  /** Optional category to tag inline posts with (e.g. "music"). */
  defaultCategory?: string;
}

const StreamComposer = ({ defaultType = "text", defaultCategory }: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [type, setType] = useState<StreamPostType>(defaultType);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Re-sync default when lane changes (HubPage drives this).
  useEffect(() => setType(defaultType), [defaultType]);

  const meta = TYPES.find((t) => t.key === type)!;
  const Icon = meta.icon;

  const createDrop = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to drop a post.");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Say something first.");
      const { error } = await supabase.from("flow_items").insert({
        user_id: user.id,
        title: trimmed.slice(0, 80),
        description: trimmed,
        category: defaultCategory ?? "general",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["hub-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["stream-conversations"] });
      toast.success("Dropped to the Stream.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePrimary = () => {
    if (!requireAuth("Sign up to drop posts to the Stream.")) return;
    if (meta.inline) {
      if (!expanded) {
        setExpanded(true);
        // focus on next tick so the textarea exists
        setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }
      createDrop.mutate();
    } else if (meta.href) {
      navigate(meta.href);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-sm p-4 sm:p-5 space-y-3">
      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {TYPES.map((t) => {
          const active = type === t.key;
          const TIcon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setType(t.key);
                if (t.inline) {
                  setExpanded(true);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                } else {
                  setExpanded(false);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-pressed={active}
            >
              <TIcon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Inline textarea (text type only, when expanded) */}
      <AnimatePresence initial={false}>
        {meta.inline && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What are you working on? Drop a thought, link, or update…"
              className="min-h-[88px] resize-none border-0 bg-muted/40 focus-visible:ring-1"
              maxLength={500}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (text.trim()) createDrop.mutate();
                }
                if (e.key === "Escape") {
                  setExpanded(false);
                  setText("");
                }
              }}
            />
            <div className="mt-1.5 text-[10px] text-muted-foreground/60 px-1">
              {text.length}/500 · ⌘↵ to drop · Esc to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary action row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground hidden sm:block">
          {meta.inline
            ? expanded
              ? "Drops show up immediately in Conversations."
              : "Quick text drop — link or image goes a long way."
            : `Opens the full ${meta.label.toLowerCase()} flow.`}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          {meta.inline && expanded && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setExpanded(false);
                setText("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            onClick={handlePrimary}
            disabled={createDrop.isPending}
            className="rounded-full gap-1.5"
            size="sm"
          >
            {createDrop.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : meta.inline && expanded ? (
              <Send className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {meta.cta}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StreamComposer;
