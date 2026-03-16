import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CollaboratorsProps {
  projectId: string;
}

const Collaborators = ({ projectId }: CollaboratorsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [projectRole, setProjectRole] = useState("client");

  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get profiles for collaborator user_ids
  const { data: collabProfiles } = useQuery({
    queryKey: ["collab-profiles", collaborators?.map((c) => c.user_id)],
    enabled: !!collaborators && collaborators.length > 0,
    queryFn: async () => {
      const ids = collaborators!.map((c) => c.user_id);
      const { data, error } = await supabase.from("profiles").select("*").in("user_id", ids);
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      // Find user by looking up profiles with display_name matching email (simplified)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("display_name", email)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile) throw new Error("User not found. They must have a profile on the platform.");

      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        user_id: profile.user_id,
        invited_by: user!.id,
        role,
        project_role: projectRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      setOpen(false);
      setEmail("");
      toast.success("Collaborator invited!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      toast.success("Collaborator removed");
    },
  });

  const profileMap = new Map(collabProfiles?.map((p) => [p.user_id, p]) ?? []);

  const roleColors: Record<string, string> = {
    viewer: "bg-secondary text-secondary-foreground",
    editor: "bg-primary/10 text-primary",
    admin: "bg-amber-500/10 text-amber-600",
  };

  const projectRoleColors: Record<string, string> = {
    client: "bg-blue-500/10 text-blue-600",
    specialist: "bg-emerald-500/10 text-emerald-600",
  };

  return (
    <div className="surface-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Invite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="space-y-4">
              <Input placeholder="Display name" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Select value={projectRole} onValueChange={setProjectRole}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="specialist">Specialist</SelectItem>
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Permission" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={invite.isPending}>
                {invite.isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Owner */}
      <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          You
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">You</p>
          <p className="text-xs text-muted-foreground">Owner</p>
        </div>
      </div>

      {collaborators?.map((collab, i) => {
        const profile = profileMap.get(collab.user_id);
        return (
          <motion.div
            key={collab.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 mt-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
              {(profile?.display_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.display_name ?? "User"}</p>
              <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${roleColors[collab.role] ?? roleColors.viewer}`}>
                {collab.role}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(collab.id)}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </motion.div>
        );
      })}

      {(!collaborators || collaborators.length === 0) && (
        <p className="mt-2 text-xs text-muted-foreground">No collaborators yet.</p>
      )}
    </div>
  );
};

export default Collaborators;
