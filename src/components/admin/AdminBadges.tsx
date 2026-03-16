import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Award, Plus, Trash2, Loader2, Building, Star, Users, Heart, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ICON_MAP: Record<string, any> = {
  building: Building,
  star: Star,
  users: Users,
  heart: Heart,
  "check-circle": CheckCircle,
  award: Award,
};

type BadgeDef = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  icon: string;
  color: string;
  badge_type: string;
  sort_order: number;
};

type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const AdminBadges = () => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [{ data: badgeData }, { data: ubData }, { data: profileData }] = await Promise.all([
      supabase.from("badges").select("*").order("sort_order"),
      supabase.from("user_badges").select("*"),
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
    ]);
    setBadges((badgeData as any[]) || []);
    setUserBadges((ubData as any[]) || []);
    setProfiles(profileData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async () => {
    if (!selectedBadgeId || !selectedUserId) return;
    setSaving(true);
    const { error } = await supabase.from("user_badges").insert({
      user_id: selectedUserId,
      badge_id: selectedBadgeId,
      awarded_by: user?.id,
    } as any);
    if (error) {
      if (error.code === "23505") toast.error("User already has this badge");
      else toast.error(error.message);
    } else {
      toast.success("Badge assigned!");
      setAssignOpen(false);
      setSelectedBadgeId("");
      setSelectedUserId("");
      fetchData();
    }
    setSaving(false);
  };

  const handleRevoke = async (ubId: string) => {
    const { error } = await supabase.from("user_badges").delete().eq("id", ubId);
    if (error) toast.error(error.message);
    else { toast.success("Badge revoked"); fetchData(); }
  };

  const getProfile = (userId: string) => profiles.find((p) => p.user_id === userId);
  const getBadge = (badgeId: string) => badges.find((b) => b.id === badgeId);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Badge types */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Badge Types</h2>
        <div className="flex flex-wrap gap-3">
          {badges.map((badge) => {
            const IconComp = ICON_MAP[badge.icon] || Award;
            return (
              <div
                key={badge.id}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2"
              >
                <IconComp className="h-4 w-4" style={{ color: badge.color }} />
                <span className="text-sm font-medium text-foreground">{badge.label}</span>
                <span className="text-[10px] text-muted-foreground capitalize">({badge.badge_type})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assigned badges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Assigned Badges ({userBadges.length})</h2>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Assign Badge
          </Button>
        </div>

        <div className="grid gap-3">
          {userBadges.map((ub) => {
            const profile = getProfile(ub.user_id);
            const badge = getBadge(ub.badge_id);
            if (!badge) return null;
            const IconComp = ICON_MAP[badge.icon] || Award;
            return (
              <Card key={ub.id} className="bg-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(profile?.display_name || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile?.display_name || "Unknown"}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: badge.color }}
                  >
                    <IconComp className="h-3 w-3" />
                    {badge.label}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(ub.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {userBadges.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No badges assigned yet.</p>
          )}
        </div>
      </div>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.display_name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Select Badge</label>
              <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a badge..." />
                </SelectTrigger>
                <SelectContent>
                  {badges.map((b) => {
                    const IconComp = ICON_MAP[b.icon] || Award;
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="flex items-center gap-2">
                          <IconComp className="h-3.5 w-3.5" style={{ color: b.color }} />
                          {b.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAssign} disabled={!selectedUserId || !selectedBadgeId || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
              Assign Badge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBadges;
