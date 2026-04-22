import { useState, useMemo } from "react";
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
} from "@/components/ui/dialog";
import {
  Plus,
  Lock,
  Globe,
  Users,
  Trash2,
  ArrowRight,
  LayoutGrid,
  Compass,
  Sparkles,
} from "lucide-react";
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

type TabKey = "private" | "public" | "shared";

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
  const [activeTab, setActiveTab] = useState<TabKey>("private");

  // All boards owned by user (private + public mixed)
  const { data: ownedBoards } = useQuery({
    queryKey: ["smartboards-owned", user?.id],
    queryFn: async () => {
      if (!user) return [];
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

  // Boards I'm a member of (shared with me) — exclude ones I already own
  const { data: memberBoards } = useQuery({
    queryKey: ["smartboard-memberships", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("smartboard_members")
        .select("smartboard_id, role, smartboards(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      // Filter out boards I already own (would be duplicate)
      return (data ?? []).filter((m: any) => m.smartboards && m.smartboards.user_id !== user.id);
    },
    enabled: !!user,
  });

  const privateBoards = useMemo(
    () => (ownedBoards ?? []).filter((b) => !b.is_public),
    [ownedBoards],
  );
  const publicBoards = useMemo(
    () => (ownedBoards ?? []).filter((b) => b.is_public),
    [ownedBoards],
  );

  const visibleBoardIds = useMemo(() => {
    const ids: string[] = [];
    (ownedBoards ?? []).forEach((b) => ids.push(b.id));
    (memberBoards ?? []).forEach((m: any) => ids.push(m.smartboard_id));
    return ids;
  }, [ownedBoards, memberBoards]);

  // Fetch first items per board for thumbnails (across all visible boards)
  const { data: boardPreviews } = useQuery({
    queryKey: ["smartboard-previews", visibleBoardIds],
    queryFn: async () => {
      if (visibleBoardIds.length === 0) return new Map<string, string[]>();
      const { data } = await supabase
        .from("smartboard_items")
        .select("smartboard_id, file_url, content_type")
        .in("smartboard_id", visibleBoardIds)
        .not("file_url", "is", null)
        .limit(200);
      const map = new Map<string, string[]>();
      (data ?? []).forEach((item) => {
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
    enabled: visibleBoardIds.length > 0,
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
      queryClient.invalidateQueries({ queryKey: ["smartboards-owned"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      // Switch to the tab matching the new board's privacy
      setActiveTab(isPublic ? "public" : "private");
      setIsPublic(false);
      toast.success("Board created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBoard = useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await supabase.from("smartboards").delete().eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboards-owned"] });
      toast.success("Board deleted");
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const deleteSelected = () => {
    selectedIds.forEach((id) => deleteBoard.mutate(id));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const tabs: { key: TabKey; label: string; icon: typeof Lock; count: number; tone: string }[] = [
    {
      key: "private",
      label: "Private",
      icon: Lock,
      count: privateBoards.length,
      tone: "hsl(var(--foreground))",
    },
    {
      key: "public",
      label: "Public",
      icon: Globe,
      count: publicBoards.length,
      tone: "hsl(160, 70%, 45%)",
    },
    {
      key: "shared",
      label: "Shared with Me",
      icon: Users,
      count: memberBoards?.length ?? 0,
      tone: "hsl(280, 60%, 55%)",
    },
  ];

  const renderEmpty = (tab: TabKey) => {
    if (tab === "private") {
      return (
        <div className="surface-card flex flex-col items-center justify-center py-14 rounded-2xl text-center">
          <Lock className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-display text-base font-semibold text-foreground">No private boards yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Private boards are just for you. Mood boards, reference dumps, secret WIPs — none of it shows up in the Hub.
          </p>
          <Button onClick={() => { setIsPublic(false); setOpen(true); }} className="mt-4 rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New Private Board
          </Button>
        </div>
      );
    }
    if (tab === "public") {
      return (
        <div className="surface-card flex flex-col items-center justify-center py-14 rounded-2xl text-center">
          <Globe className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-display text-base font-semibold text-foreground">No public boards yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Public boards appear in the Hub for other creators to discover. Great for portfolio walls and shared inspiration.
          </p>
          <Button onClick={() => { setIsPublic(true); setOpen(true); }} className="mt-4 rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New Public Board
          </Button>
        </div>
      );
    }
    return (
      <div className="surface-card flex flex-col items-center justify-center py-14 rounded-2xl text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="font-display text-base font-semibold text-foreground">Nothing shared with you yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          When other creators invite you to collaborate on a board, it'll show up here.
        </p>
        <Link to="/creators" className="mt-4">
          <Button variant="outline" className="rounded-full">
            <Compass className="mr-2 h-4 w-4" /> Browse the Hub
          </Button>
        </Link>
      </div>
    );
  };

  const renderBoardGrid = (
    items: { id: string; board: any; role?: string; readonly?: boolean }[],
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const previews = boardPreviews?.get(item.id) || [];
          const isSelected = selectedIds.has(item.id);
          const canSelect = selectMode && !item.readonly;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              {canSelect ? (
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={`block w-full text-left rounded-2xl overflow-hidden border-2 transition-all ${
                    isSelected ? "border-primary shadow-md" : "border-border"
                  }`}
                >
                  <BoardCard board={item.board} previews={previews} role={item.role} />
                </button>
              ) : (
                <Link to={`/smartboards/${item.id}`} className="block">
                  <div className="rounded-2xl overflow-hidden border border-border hover:shadow-md transition-all group">
                    <BoardCard board={item.board} previews={previews} role={item.role} />
                  </div>
                </Link>
              )}
            </motion.div>
          );
        })}

        {/* New board card — only on owned tabs and outside select mode */}
        {!selectMode && (activeTab === "private" || activeTab === "public") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: items.length * 0.04 }}
          >
            <button
              onClick={() => { setIsPublic(activeTab === "public"); setOpen(true); }}
              className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-border hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">New {activeTab === "public" ? "Public" : "Private"} Board</span>
            </button>
          </motion.div>
        )}
      </div>
    );
  };

  // What to show in active tab
  const activeContent = (() => {
    if (activeTab === "private") {
      if (privateBoards.length === 0) return renderEmpty("private");
      return renderBoardGrid(privateBoards.map((b) => ({ id: b.id, board: b })));
    }
    if (activeTab === "public") {
      if (publicBoards.length === 0) return renderEmpty("public");
      return renderBoardGrid(publicBoards.map((b) => ({ id: b.id, board: b })));
    }
    if (!memberBoards || memberBoards.length === 0) return renderEmpty("shared");
    return renderBoardGrid(
      memberBoards.map((m: any) => ({
        id: m.smartboard_id,
        board: m.smartboards,
        role: m.role,
        readonly: true,
      })),
    );
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Boards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual mood &amp; curation. Discover what other creators are sharing in the{" "}
            <Link to="/creators" className="underline hover:text-foreground inline-flex items-center gap-1">
              Hub <Compass className="h-3 w-3" />
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === "private" || activeTab === "public") && (ownedBoards?.length ?? 0) > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
                selectMode ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Select</span>
            </button>
          )}
          <Button onClick={() => setOpen(true)} size="sm" className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New Board
          </Button>
        </div>
      </div>

      {/* Tab pills with counts */}
      <div className="flex gap-1.5 flex-wrap" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveTab(t.key); setSelectMode(false); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span
                className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-background/20 text-background" : "bg-foreground/10 text-foreground/70"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Context-aware tip strip */}
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
        {activeTab === "private" && (
          <>
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Private boards</strong> are visible only to you. Switch a board to public to feature it in the Hub.
            </span>
          </>
        )}
        {activeTab === "public" && (
          <>
            <Globe className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Public boards</strong> are listed for everyone in the{" "}
              <Link to="/creators" className="underline hover:text-foreground">Hub</Link>. They still live here so you can manage them.
            </span>
          </>
        )}
        {activeTab === "shared" && (
          <>
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Shared with you</strong> — boards other creators added you to. Your role is shown on each card.
            </span>
          </>
        )}
      </div>

      {/* Active tab content */}
      {activeContent}

      {/* Select mode bottom bar */}
      {selectMode && selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-card border border-border shadow-xl rounded-full px-5 py-3"
        >
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-border" />
          <button onClick={deleteSelected} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80">
            <Trash2 className="h-4 w-4" />
            Remove
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
            {/* Privacy toggle with helper text */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="public" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
                  {isPublic ? "Public" : "Private"}
                </Label>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} id="public" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isPublic
                  ? "Anyone can find this board in the Hub. You stay in control of who can edit."
                  : "Only you can see this board. Flip to public any time to share it."}
              </p>
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={!title.trim()}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Board card sub-component
const BoardCard = ({
  board,
  previews,
  role,
}: {
  board: any;
  previews: string[];
  role?: string;
}) => (
  <>
    <div
      className="aspect-square relative overflow-hidden"
      style={{ backgroundColor: board?.cover_color || "hsl(var(--muted))" }}
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
      <div className="absolute top-2 right-2 rounded-full bg-background/70 backdrop-blur-sm p-1">
        {board?.is_public ? (
          <Globe className="h-3 w-3 text-foreground/70" />
        ) : (
          <Lock className="h-3 w-3 text-foreground/70" />
        )}
      </div>
      {role && (
        <div className="absolute bottom-2 left-2 rounded-full bg-background/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-foreground capitalize">
          {role}
        </div>
      )}
    </div>
    <div className="p-3">
      <h3 className="font-display font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
        {board?.title ?? "Board"}
      </h3>
      {board?.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{board.description}</p>
      )}
    </div>
  </>
);

export default SmartboardsPage;
