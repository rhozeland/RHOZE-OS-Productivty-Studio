import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShieldCheck, ShieldOff, Ban, UserCheck, MoreVertical,
  Search, Loader2, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  skills: string[] | null;
  available: boolean | null;
  ban_status: string;
  banned_at: string | null;
  ban_reason: string | null;
  username: string | null;
  created_at: string;
};

type UserCredit = { user_id: string; balance: number; tier: string };

type UserRole = { id: string; user_id: string; role: string };

const AdminUsers = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [credits, setCredits] = useState<Record<string, UserCredit>>({});
  const [roles, setRoles] = useState<Record<string, UserRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned" | "admin">("all");

  // Ban dialog
  const [banTarget, setBanTarget] = useState<Profile | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banProcessing, setBanProcessing] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  // Warning dialog
  const [warnTarget, setWarnTarget] = useState<Profile | null>(null);
  const [warnMessage, setWarnMessage] = useState("");
  const [warnProcessing, setWarnProcessing] = useState(false);

  const handleSendWarning = async () => {
    if (!warnTarget) return;
    setWarnProcessing(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: warnTarget.user_id,
      title: "⚠️ Account Warning",
      body: warnMessage || "Your account has been flagged for violating community guidelines. Please review our terms of service. Continued violations may result in account suspension.",
      type: "warning",
      link: "/settings",
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Warning sent to ${warnTarget.display_name || "user"}`);
      setWarnTarget(null);
      setWarnMessage("");
    }
    setWarnProcessing(false);
  };

  const fetchData = async () => {
    const [{ data: profileData }, { data: creditData }, { data: roleData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_credits").select("user_id, balance, tier"),
      supabase.from("user_roles").select("*"),
    ]);

    setProfiles((profileData as Profile[]) || []);

    const creditMap: Record<string, UserCredit> = {};
    (creditData || []).forEach((c) => { creditMap[c.user_id] = c; });
    setCredits(creditMap);

    const roleMap: Record<string, UserRole[]> = {};
    (roleData || []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r);
    });
    setRoles(roleMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const isUserAdmin = (userId: string) =>
    roles[userId]?.some((r) => r.role === "admin") ?? false;

  const handleGrantAdmin = async (profile: Profile) => {
    const { error } = await supabase.from("user_roles").insert({
      user_id: profile.user_id,
      role: "admin" as any,
    });
    if (error) {
      if (error.code === "23505") toast.error("User is already an admin");
      else toast.error(error.message);
    } else {
      toast.success(`${profile.display_name || "User"} is now an admin`);
      fetchData();
    }
  };

  const handleRevokeAdmin = async (profile: Profile) => {
    if (profile.user_id === user?.id) {
      toast.error("You cannot remove your own admin role");
      return;
    }
    const adminRole = roles[profile.user_id]?.find((r) => r.role === "admin");
    if (!adminRole) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", adminRole.id);
    if (error) toast.error(error.message);
    else { toast.success("Admin role revoked"); fetchData(); }
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanProcessing(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ban_status: "banned",
        banned_at: new Date().toISOString(),
        ban_reason: banReason || null,
      } as any)
      .eq("user_id", banTarget.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${banTarget.display_name || "User"} has been banned`);
      setBanTarget(null);
      setBanReason("");
      fetchData();
    }
    setBanProcessing(false);
  };

  const handleUnban = async (profile: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        ban_status: "active",
        banned_at: null,
        ban_reason: null,
      } as any)
      .eq("user_id", profile.user_id);
    if (error) toast.error(error.message);
    else { toast.success("User unbanned"); fetchData(); }
  };

  const handleDeleteBanned = async () => {
    if (!deleteTarget) return;
    // Remove their profile (cascade handles user_roles etc.)
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", deleteTarget.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success("Banned user removed from platform");
      setDeleteTarget(null);
      fetchData();
    }
  };

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (p.display_name || "").toLowerCase().includes(q) ||
      (p.username || "").toLowerCase().includes(q) ||
      (p.bio || "").toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filter === "active") return (p.ban_status || "active") === "active";
    if (filter === "banned") return p.ban_status === "banned";
    if (filter === "admin") return isUserAdmin(p.user_id);
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Users ({profiles.length})
        </h2>
        <div className="flex items-center gap-2">
          {(["all", "active", "banned", "admin"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize text-xs"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {filtered.map((p) => {
          const credit = credits[p.user_id];
          const admin = isUserAdmin(p.user_id);
          const banned = p.ban_status === "banned";
          const isSelf = p.user_id === user?.id;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`bg-card ${banned ? "border-destructive/30 opacity-70" : ""}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {(p.display_name || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.display_name || "Unnamed"}
                      </p>
                      {p.username && (
                        <span className="text-[10px] text-muted-foreground">@{p.username}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.bio || "No bio"} • Joined {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {admin && (
                      <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Admin
                      </Badge>
                    )}
                    {banned && (
                      <Badge variant="destructive" className="text-[9px]">
                        <Ban className="h-2.5 w-2.5 mr-0.5" /> Banned
                      </Badge>
                    )}
                    {credit && (
                      <Badge variant="outline" className="text-[9px]">
                        {credit.tier} • {credit.balance}◊
                      </Badge>
                    )}
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {!admin && !banned && (
                        <DropdownMenuItem onClick={() => handleGrantAdmin(p)}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Make Admin
                        </DropdownMenuItem>
                      )}
                      {admin && !isSelf && (
                        <DropdownMenuItem onClick={() => handleRevokeAdmin(p)}>
                          <ShieldOff className="h-3.5 w-3.5 mr-2" /> Revoke Admin
                        </DropdownMenuItem>
                      )}
                      {!banned && !isSelf && (
                        <DropdownMenuItem onClick={() => { setWarnTarget(p); setWarnMessage(""); }}>
                          <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Send Warning
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {!banned ? (
                        <DropdownMenuItem
                          onClick={() => setBanTarget(p)}
                          className="text-destructive focus:text-destructive"
                          disabled={isSelf}
                        >
                          <Ban className="h-3.5 w-3.5 mr-2" /> Ban User
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleUnban(p)}>
                            <UserCheck className="h-3.5 w-3.5 mr-2" /> Unban User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(p)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove Permanently
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No users match your search.</p>
        )}
      </div>

      {/* Ban dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Ban User
            </DialogTitle>
            <DialogDescription>
              Ban {banTarget?.display_name || "this user"} from the platform. They will lose access to all features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Reason (optional)</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Why is this user being banned?"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleBan}
                disabled={banProcessing}
              >
                {banProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                Confirm Ban
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Permanently Remove User
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteTarget?.display_name || "this user"}'s profile and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteBanned}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Forever
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning dialog */}
      <Dialog open={!!warnTarget} onOpenChange={(open) => !open && setWarnTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Send Warning
            </DialogTitle>
            <DialogDescription>
              Send a warning notification to {warnTarget?.display_name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Message (optional)</label>
              <Textarea
                value={warnMessage}
                onChange={(e) => setWarnMessage(e.target.value)}
                placeholder="Leave blank for default warning message..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setWarnTarget(null)}>Cancel</Button>
              <Button onClick={handleSendWarning} disabled={warnProcessing} className="gap-1.5">
                {warnProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Send Warning
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
