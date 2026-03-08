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
import { Plus, Lock, Globe, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const SmartboardsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const { data: boards } = useQuery({
    queryKey: ["smartboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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

  const createBoard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboards").insert({
        title,
        description: description || null,
        is_public: isPublic,
        user_id: user!.id,
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

  const COLORS = ["#2dd4a8", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6", "#ef4444"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Smartboards</h1>
          <p className="text-muted-foreground">Curate, collaborate, and brainstorm</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Board
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Smartboard</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) createBoard.mutate();
              }}
              className="space-y-4"
            >
              <Input
                placeholder="Board title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="flex items-center gap-3">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} id="public" />
                <Label htmlFor="public" className="flex items-center gap-2">
                  {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {isPublic ? "Public — anyone can view" : "Private — invite only"}
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={!title.trim()}>
                Create Board
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* My Boards */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">My Boards</h2>
        {(!boards || boards.length === 0) ? (
          <div className="surface-card flex flex-col items-center justify-center py-16">
            <Plus className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No smartboards yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board, i) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/smartboards/${board.id}`} className="block">
                  <div className="surface-card group cursor-pointer overflow-hidden transition-all hover:shadow-md">
                    <div
                      className="h-2"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <div className="p-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                          {board.title}
                        </h3>
                        {board.is_public ? (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {board.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {board.description}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {new Date(board.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Shared with me */}
      {memberBoards && memberBoards.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" /> Shared with Me
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberBoards.map((membership: any, i: number) => (
              <motion.div
                key={membership.smartboard_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/smartboards/${membership.smartboard_id}`} className="block">
                  <div className="surface-card group cursor-pointer overflow-hidden transition-all hover:shadow-md">
                    <div className="h-2 bg-primary/50" />
                    <div className="p-5">
                      <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                        {membership.smartboards?.title ?? "Board"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">
                        Role: {membership.role}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartboardsPage;
