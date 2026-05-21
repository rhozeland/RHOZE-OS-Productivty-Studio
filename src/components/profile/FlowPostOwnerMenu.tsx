/**
 * FlowPostOwnerMenu — 3-dot owner menu on profile post tiles.
 *
 * Rendered only when the viewer owns the post. Provides:
 *   • Edit    — inline title/description dialog
 *   • Archive — soft-hide (toggles `flow_items.archived_at`)
 *   • Delete  — hard delete (AlertDialog confirm, destructive)
 */
import { useState } from "react";
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  post: {
    id: string;
    title: string;
    description?: string | null;
    archived_at?: string | null;
  };
}

const FlowPostOwnerMenu = ({ post }: Props) => {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(post.title ?? "");
  const [description, setDescription] = useState(post.description ?? "");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["profile-flow-posts"] });
    qc.invalidateQueries({ queryKey: ["flow-items"] });
    qc.invalidateQueries({ queryKey: ["works-lightbox"] });
  };

  const archiveMut = useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from("flow_items")
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: (_d, archive) => {
      toast.success(archive ? "Post archived" : "Post restored");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't archive"),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("flow_items")
        .update({ title: title.trim() || post.title, description: description.trim() || null })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post updated");
      setEditOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't update"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("flow_items").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      setDeleteOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't delete"),
  });

  const isArchived = !!post.archived_at;

  // Stop clicks bubbling up to the parent tile (which navigates to /flow).
  // We only stopPropagation — calling preventDefault on pointerdown would
  // block Radix from opening the dropdown menu.
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={stop}
            onPointerDown={stop}
            aria-label="Post options"
            className="absolute bottom-1.5 right-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={stop}
          onPointerDown={stop}
          className="w-44"
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTitle(post.title ?? "");
              setDescription(post.description ?? "");
              setEditOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              archiveMut.mutate(!isArchived);
            }}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={stop} onPointerDown={stop} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-desc">Description</Label>
              <Textarea
                id="post-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Add a caption…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending || !title.trim()}>
              {editMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={stop} onPointerDown={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post from your profile and the public feed.
              Any on-chain anchor signatures remain a public record. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FlowPostOwnerMenu;
