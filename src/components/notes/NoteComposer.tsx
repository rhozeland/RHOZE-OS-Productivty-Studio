/**
 * NoteComposer — modal that lets the current user post / replace / clear
 * their 60-word, 24h-expiring status note. Routed from the Stream
 * composer's "Update" pill and from the "Your note" tile in the DM inbox.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  NOTE_MAX_CHARS,
  NOTE_MAX_WORDS,
  useMyNote,
} from "@/hooks/useNotes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const wordCount = (s: string) =>
  s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;

export const NoteComposer = ({ open, onOpenChange }: Props) => {
  const { note, post, clear } = useMyNote();
  const [text, setText] = useState("");

  // Reset to current note whenever the modal reopens.
  useEffect(() => {
    if (open) setText(note?.body ?? "");
  }, [open, note?.body]);

  const words = wordCount(text);
  const overWord = words > NOTE_MAX_WORDS;
  const overChar = text.length > NOTE_MAX_CHARS;
  const disabled = !text.trim() || overChar || overWord || post.isPending;

  const handlePost = async () => {
    try {
      await post.mutateAsync(text);
      toast.success("Note posted · disappears in 24h");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't post note");
    }
  };

  const handleClear = async () => {
    try {
      await clear.mutateAsync();
      toast.success("Note cleared");
      setText("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't clear note");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {note ? "Update your note" : "Leave a note"}
          </DialogTitle>
          <DialogDescription>
            A short thought — up to {NOTE_MAX_WORDS} words. Disappears in 24
            hours. Visible on your profile and to your buddies in DMs.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          maxLength={NOTE_MAX_CHARS + 50 /* let trigger validation, not hard cut */}
          className="rounded-xl resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between text-[11px] -mt-1 px-1">
          <span
            className={
              overWord || overChar ? "text-destructive" : "text-muted-foreground"
            }
          >
            {words}/{NOTE_MAX_WORDS} words
          </span>
          <span className="text-muted-foreground">expires in 24h</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {note && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              disabled={clear.isPending}
              onClick={handleClear}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
          <Button
            type="button"
            className="flex-1 rounded-full"
            disabled={disabled}
            onClick={handlePost}
          >
            {post.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : note ? (
              "Update note"
            ) : (
              "Post note"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NoteComposer;
