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
import { Plus, Trash2, UserCheck, UserX, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StaffMember = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  specialties: string[];
  is_available: boolean;
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

const AdminStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [{ data: staffData }, { data: profileData }, { data: servicesData }] = await Promise.all([
      supabase.from("staff_members").select("*").order("created_at"),
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
      supabase.from("services").select("category"),
    ]);
    setStaff((staffData as any[]) || []);
    setProfiles(profileData || []);
    // Extract unique categories from services
    const cats = [...new Set((servicesData || []).map((s: any) => s.category as string))].sort();
    setServiceCategories(cats);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const existingUserIds = new Set(staff.map((s) => s.user_id));
  const availableProfiles = profiles.filter((p) => !existingUserIds.has(p.user_id));

  const toggleSpecialty = (cat: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    const profile = profiles.find((p) => p.user_id === selectedUserId);

    const { error } = await supabase.from("staff_members").insert({
      user_id: selectedUserId,
      display_name: profile?.display_name || "Staff Member",
      avatar_url: profile?.avatar_url || null,
      specialties: selectedSpecialties,
      is_available: true,
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Staff member added");
      setAddOpen(false);
      setSelectedUserId("");
      setSelectedSpecialties([]);
      fetchData();
    }
    setSaving(false);
  };

  const toggleAvailability = async (member: StaffMember) => {
    const { error } = await supabase
      .from("staff_members")
      .update({ is_available: !member.is_available } as any)
      .eq("id", member.id);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("staff_members").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); fetchData(); }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Staff Members ({staff.length})</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="grid gap-3">
        {staff.map((member) => (
          <Card key={member.id} className="bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {member.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{member.display_name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {member.specialties?.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAvailability(member)}
                  className={member.is_available ? "text-emerald-500" : "text-muted-foreground"}
                >
                  {member.is_available ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                </Button>
                <Badge variant={member.is_available ? "default" : "secondary"} className="text-xs">
                  {member.is_available ? "Available" : "Unavailable"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No staff members added yet.</p>
        )}
      </div>

      {/* Add staff dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setSelectedUserId(""); setSelectedSpecialties([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.display_name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Specialties</label>
              {selectedSpecialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedSpecialties.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => toggleSpecialty(s)}
                    >
                      {s}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {serviceCategories.length > 0 ? (
                  serviceCategories.map((cat) => {
                    const active = selectedSpecialties.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleSpecialty(cat)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No service categories found. Add services first.</p>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={!selectedUserId || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add to Staff
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStaff;
