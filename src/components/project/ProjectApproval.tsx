import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  PenLine,
  CheckCircle2,
  Clock,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Approval {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  printed_name: string;
  signed_at: string;
}

interface ProjectApprovalProps {
  projectId: string;
  projectTitle: string;
  clientName?: string | null;
}

const ProjectApproval = ({ projectId, projectTitle, clientName }: ProjectApprovalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [printedName, setPrintedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Fetch approvals
  const { data: approvals, isLoading } = useQuery({
    queryKey: ["project-approvals", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Approval[];
    },
  });

  // Fetch profiles for display names
  const approvalUserIds = approvals?.map((a) => a.user_id) ?? [];
  const { data: profiles } = useQuery({
    queryKey: ["approval-profiles", approvalUserIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", approvalUserIds);
      if (error) throw error;
      return data;
    },
    enabled: approvalUserIds.length > 0,
  });

  // Check if user already signed
  const userApproval = approvals?.find((a) => a.user_id === user?.id);
  const hasUserSigned = !!userApproval;

  // Fetch user's collaborator role
  const { data: collaborator } = useQuery({
    queryKey: ["project-collab-role", projectId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("project_role")
        .eq("project_id", projectId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Check if user is the project owner
  const { data: project } = useQuery({
    queryKey: ["project-owner-check", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = project?.user_id === user?.id;
  const userRole = isOwner ? "specialist" : (collaborator?.project_role || "client");

  const signApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_approvals" as any).insert({
        project_id: projectId,
        user_id: user!.id,
        role: userRole,
        printed_name: printedName.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-approvals", projectId] });
      setSignDialogOpen(false);
      setPrintedName("");
      setAgreed(false);
      toast.success("Project roadmap signed!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_approvals" as any)
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-approvals", projectId] });
      toast.success("Approval revoked");
    },
  });

  const getProfile = (userId: string) =>
    profiles?.find((p) => p.user_id === userId);

  const roleColors: Record<string, string> = {
    client: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    specialist: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  if (isLoading) return null;

  const clientApprovals = approvals?.filter((a) => a.role === "client") ?? [];
  const specialistApprovals = approvals?.filter((a) => a.role === "specialist") ?? [];
  const allSigned = clientApprovals.length > 0 && specialistApprovals.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            Approval & Sign-Off
          </h2>
        </div>
        {allSigned && (
          <Badge
            variant="outline"
            className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            Fully Approved
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Both parties must digitally sign to approve the project roadmap, scope of work, and budget.
      </p>

      {/* Sign-off cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Client side */}
        <SignatureCard
          title="Client Approval"
          role="client"
          approvals={clientApprovals}
          getProfile={getProfile}
          roleColors={roleColors}
          isCurrentUserRole={userRole === "client"}
          hasUserSigned={hasUserSigned}
          onSign={() => setSignDialogOpen(true)}
          onRevoke={() => revokeApproval.mutate()}
          currentUserId={user?.id}
        />

        {/* Specialist side */}
        <SignatureCard
          title="Administered By"
          role="specialist"
          approvals={specialistApprovals}
          getProfile={getProfile}
          roleColors={roleColors}
          isCurrentUserRole={userRole === "specialist"}
          hasUserSigned={hasUserSigned}
          onSign={() => setSignDialogOpen(true)}
          onRevoke={() => revokeApproval.mutate()}
          currentUserId={user?.id}
        />
      </div>

      {/* Sign Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Sign Project Roadmap</DialogTitle>
            <DialogDescription>
              By signing below, you approve the project roadmap, scope of work, deliverables, and
              budget for <strong>{projectTitle}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (printedName.trim() && agreed) signApproval.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Print Name
              </label>
              <Input
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                placeholder="Your full name"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Signing As
              </label>
              <Badge variant="outline" className={cn("capitalize", roleColors[userRole])}>
                {userRole}
              </Badge>
            </div>

            {/* Signature preview */}
            {printedName.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-muted/20 p-6 text-center"
              >
                <p className="text-xs text-muted-foreground mb-2">Signature Preview</p>
                <p
                  className="text-2xl text-foreground"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}
                >
                  {printedName}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </motion.div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(c) => setAgreed(!!c)}
                className="mt-0.5"
              />
              <label htmlFor="agree" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I confirm that I have reviewed the project roadmap, scope of work, deliverables,
                and budget, and I approve this project to proceed.
              </label>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!printedName.trim() || !agreed || signApproval.isPending}
            >
              <PenLine className="h-4 w-4" />
              {signApproval.isPending ? "Signing..." : "Sign & Approve"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Signature Card ───────────────────────────────────
interface SignatureCardProps {
  title: string;
  role: string;
  approvals: Approval[];
  getProfile: (id: string) => { display_name: string | null; avatar_url: string | null } | undefined;
  roleColors: Record<string, string>;
  isCurrentUserRole: boolean;
  hasUserSigned: boolean;
  onSign: () => void;
  onRevoke: () => void;
  currentUserId?: string;
}

const SignatureCard = ({
  title,
  role,
  approvals,
  getProfile,
  roleColors,
  isCurrentUserRole,
  hasUserSigned,
  onSign,
  onRevoke,
  currentUserId,
}: SignatureCardProps) => {
  const hasSigned = approvals.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-5 transition-all",
        hasSigned
          ? "border-green-500/30 bg-green-500/5"
          : "border-dashed border-border bg-muted/10"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        {hasSigned ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground/40" />
        )}
      </div>

      {hasSigned ? (
        <div className="space-y-3">
          {approvals.map((approval) => {
            const profile = getProfile(approval.user_id);
            const isOwnApproval = approval.user_id === currentUserId;
            return (
              <motion.div
                key={approval.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {approval.printed_name}
                  </span>
                </div>
                <p
                  className="text-xl text-foreground pl-5"
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontStyle: "italic",
                  }}
                >
                  {approval.printed_name}
                </p>
                <p className="text-xs text-muted-foreground pl-5">
                  Signed {format(new Date(approval.signed_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {isOwnApproval && (
                  <button
                    onClick={onRevoke}
                    className="flex items-center gap-1 text-xs text-destructive hover:underline pl-5 mt-1"
                  >
                    <X className="h-3 w-3" />
                    Revoke my approval
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-1">
            Awaiting {role} signature
          </p>
          {isCurrentUserRole && !hasUserSigned && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={onSign}
            >
              <PenLine className="h-3.5 w-3.5" />
              Sign Now
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectApproval;
