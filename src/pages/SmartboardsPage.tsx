import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Lock, Globe, Users, Trash2, ArrowRight, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const COVER_COLORS = [
  "hsl(175 50% 85%)",
  "hsl(310 50% 88%)",
  "hsl(45 80% 85%)",
  "hsl(210 60% 85%)",
  "hsl(280 40% 88%)",
  "hsl(0 60% 88%)",
];

const SmartboardsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COVER_COLORS[0]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: boards } = useQuery({
    queryKey: ["smartboards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Only the user's OWN boards. Public boards belong in the Hub for discovery,
      // not on personal "My Boards". Invited/collab boards appear in "Shared with Me" below.
      const { data, error } = await supabase
        .from("smartboards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: memberBoards } = useQuery({
    queryKey: ["smartboard-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_members")
        .select("smartboard_id, role, smartboards(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch first items per board for thumbnails
  const { data: boardPreviews } = useQuery({
    queryKey: ["smartboard-previews"],
    queryFn: async () => {
      if (!boards || boards.length === 0) return new Map();
      const { data } = await supabase
        .from("smartboard_items")
        .select("smartboard_id, file_url, content_type")
        .in("smartboard_id", boards.map(b => b.id))
        .not("file_url", "is", null)
        .limit(50);
      const map = new Map<string, string[]>();
      (data ?? []).forEach(item => {
        if (item.file_url) {
          const existing = map.get(item.smartboard_id) || [];
          if (existing.length < 4) {
            existing.push(item.file_url);
            map.set(item.smartboard_id, existing);
          }
        }
      });
      return map;
    },
    enabled: !!boards && boards.length > 0,
  });

  const createBoard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboards").insert({
        title,
        description: description || null,
        is_public: isPublic,
        user_id: user!.id,
        cover_color: selectedColor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboards"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setIsPublic(false);
      toast.success("Smartboard created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBoard = useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await supabase.from("smartboards").delete().eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboards"] });
      toast.success("Smartboard deleted");
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const deleteSelected = () => {
    selectedIds.forEach(id => deleteBoard.mutate(id));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            My Boards
            <span className="ml-2 text-xs font-normal text-muted-foreground align-middle">· Visual Mood & Curation</span>
          </h1>
          <p className="text-muted-foreground text-sm">Your private + public boards. Discover others in the <Link to="/creators" className="underline hover:text-foreground">Hub</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${selectMode ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-5 w-5" />
            <span>Select</span>
          </button>
        </div>
      </div>

      {/* Board grid — visual cards with thumbnails */}
      {(!boards || boards.length === 0) ? (
        <div className="surface-card flex flex-col items-center justify-center py-16 rounded-2xl">
          <Plus className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No boards yet. Create your first one!</p>
          <Button onClick={() => setOpen(true)} className="mt-4 rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New Board
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {boards.map((board, i) => {
            const previews = boardPreviews?.get(board.id) || [];
            const isSelected = selectedIds.has(board.id);
            return (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {selectMode ? (
                  <button
                    onClick={() => toggleSelect(board.id)}
                    className={`block w-full text-left rounded-2xl overflow-hidden border-2 transition-all ${
                      isSelected ? "border-primary shadow-md" : "border-border"
                    }`}
                  >
                    <BoardCard board={board} previews={previews} />
                  </button>
                ) : (
                  <Link to={`/smartboards/${board.id}`} className="block">
                    <div className="rounded-2xl overflow-hidden border border-border hover:shadow-md transition-all group">
                      <BoardCard board={board} previews={previews} />
                    </div>
                  </Link>
                )}
              </motion.div>
            );
          })}

          {/* New board card */}
          {!selectMode && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: boards.length * 0.04 }}
            >
              <button
                onClick={() => setOpen(true)}
                className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-border hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">New Board</span>
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Shared with me */}
      {memberBoards && memberBoards.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" /> Shared with Me
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {memberBoards.map((membership: any, i: number) => (
              <motion.div
                key={membership.smartboard_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/smartboards/${membership.smartboard_id}`} className="block">
                  <div className="rounded-2xl overflow-hidden border border-border hover:shadow-md transition-all">
                    <div className="aspect-square bg-primary/10 flex items-center justify-center">
                      <Users className="h-8 w-8 text-primary/40" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-display font-semibold text-foreground text-sm truncate">
                        {membership.smartboards?.title ?? "Board"}
                      </h3>
                      <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{membership.role}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Select mode bottom bar */}
      {selectMode && selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-card border border-border shadow-xl rounded-full px-5 py-3"
        >
          <button onClick={deleteSelected} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80">
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
          <div className="w-px h-5 bg-border" />
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
            Create
          </button>
        </motion.div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) createBoard.mutate();
            }}
            className="space-y-4"
          >
            <Input
              placeholder="Name your concept"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            {/* Color picker */}
            <div className="flex gap-2">
              {COVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full transition-all ${selectedColor === color ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} id="public" />
              <Label htmlFor="public" className="flex items-center gap-2 text-sm">
                {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {isPublic ? "Public" : "Private"}
              </Label>
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={!title.trim()}>
              Done
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Board card sub-component
const BoardCard = ({ board, previews }: { board: any; previews: string[] }) => (
  <>
    <div
      className="aspect-square relative overflow-hidden"
      style={{ backgroundColor: board.cover_color || "hsl(var(--muted))" }}
    >
      {previews.length > 0 ? (
        <div className={`w-full h-full grid ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-0.5`}>
          {previews.slice(0, 4).map((url, j) => (
            <img
              key={j}
              src={url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <LayoutGrid className="h-8 w-8 text-foreground/10" />
        </div>
      )}
      {/* Privacy badge */}
      <div className="absolute top-2 right-2">
        {board.is_public ? (
          <Globe className="h-3.5 w-3.5 text-foreground/40" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-foreground/40" />
        )}
      </div>
    </div>
    <div className="p-3">
      <h3 className="font-display font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
        {board.title}
      </h3>
      {board.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{board.description}</p>
      )}
    </div>
  </>
);

export default SmartboardsPage;
