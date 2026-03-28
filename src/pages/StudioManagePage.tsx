import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Building2,
  ArrowLeft,
  Save,
  Users,
  Settings,
  Calendar,
  Plus,
  Trash2,
  Clock,
  UserCheck,
  UserX,
  X,
  Loader2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const StudioManagePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: studio, isLoading } = useQuery({
    queryKey: ["studio-manage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studios")
        .select("*")
        .eq("id", id!)
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const [form, setForm] = useState<Record<string, any>>({});

  // Staff management state
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffUsername, setStaffUsername] = useState("");
  const [staffSearchResults, setStaffSearchResults] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserName, setSelectedUserName] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [searching, setSearching] = useState(false);

  // Initialize form when studio loads
  const studioForm = {
    name: form.name ?? studio?.name ?? "",
    description: form.description ?? studio?.description ?? "",
    short_description: form.short_description ?? studio?.short_description ?? "",
    hourly_rate: form.hourly_rate ?? studio?.hourly_rate ?? 0,
    daily_rate: form.daily_rate ?? studio?.daily_rate ?? null,
    max_guests: form.max_guests ?? studio?.max_guests ?? 10,
    rules: form.rules ?? studio?.rules ?? "",
    amenities: form.amenities ?? studio?.amenities ?? [],
    equipment: form.equipment ?? studio?.equipment ?? [],
    city: form.city ?? studio?.city ?? "",
    state: form.state ?? studio?.state ?? "",
    address: form.address ?? studio?.address ?? "",
  };

  const updateStudio = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("studios")
        .update({
          name: studioForm.name,
          description: studioForm.description,
          short_description: studioForm.short_description,
          hourly_rate: Number(studioForm.hourly_rate),
          daily_rate: studioForm.daily_rate ? Number(studioForm.daily_rate) : null,
          max_guests: Number(studioForm.max_guests),
          rules: studioForm.rules || null,
          amenities: studioForm.amenities,
          equipment: studioForm.equipment,
          city: studioForm.city || null,
          state: studioForm.state || null,
          address: studioForm.address || null,
        })
        .eq("id", id!)
        .eq("owner_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-manage", id] });
      queryClient.invalidateQueries({ queryKey: ["studio", id] });
      toast.success("Studio updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Staff members query
  const { data: staffMembers, refetch: refetchStaff } = useQuery({
    queryKey: ["studio-staff", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("*")
        .eq("studio_id", id!);
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  // Hard-coded specialty options
  const SPECIALTIES = ["audio", "design", "photo", "video", "writing", "other"];

  // Search profiles by display_name
  const searchUsers = async (query: string) => {
    if (query.length < 2) { setStaffSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .ilike("display_name", `%${query}%`)
      .limit(8);
    const existing = new Set((staffMembers || []).map((s: any) => s.user_id));
    setStaffSearchResults((data || []).filter((p) => !existing.has(p.user_id) && p.user_id !== user?.id));
    setSearching(false);
  };

  // Studio bookings
  const { data: bookings } = useQuery({
    queryKey: ["studio-owner-bookings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_bookings")
        .select("*")
        .eq("studio_id", id!)
        .order("start_time", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Studio availability
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const { data: availability } = useQuery({
    queryKey: ["studio-availability-manage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_availability")
        .select("*")
        .eq("studio_id", id!)
        .order("day_of_week");
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateAvailability = useMutation({
    mutationFn: async (slot: { id: string; is_available?: boolean; start_time?: string; end_time?: string }) => {
      const { error } = await supabase
        .from("studio_availability")
        .update({ is_available: slot.is_available, start_time: slot.start_time, end_time: slot.end_time })
        .eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-availability-manage", id] });
      queryClient.invalidateQueries({ queryKey: ["studio-availability", id] });
      toast.success("Hours updated");
    },
  });

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleSpecialty = (cat: string) => {
    if (cat === "other") {
      setShowCustomInput((prev) => !prev);
      return;
    }
    setSelectedSpecialties((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addCustomSpecialty = () => {
    const trimmed = customSpecialty.trim().toLowerCase();
    if (trimmed && !selectedSpecialties.includes(trimmed)) {
      setSelectedSpecialties((prev) => [...prev, trimmed]);
    }
    setCustomSpecialty("");
    setShowCustomInput(false);
  };

  const handleAddStaff = async () => {
    if (!selectedUserId) return;
    setSavingStaff(true);

    // Add them as staff with pending status
    const { data: staffData, error } = await supabase.from("staff_members").insert({
      user_id: selectedUserId,
      display_name: selectedUserName || "Staff Member",
      specialties: selectedSpecialties,
      is_available: false,
      status: "pending",
      studio_id: id,
    } as any).select().single();

    if (error) {
      toast.error(error.message);
      setSavingStaff(false);
      return;
    }

    // Send a structured invitation message
    const invitePayload = JSON.stringify({
      studio_id: id,
      studio_name: studio?.name,
      specialties: selectedSpecialties,
      staff_member_id: (staffData as any)?.id,
    });
    const { error: msgError } = await supabase.from("messages").insert({
      sender_id: user!.id,
      receiver_id: selectedUserId,
      content: `[STAFF_INVITE:${invitePayload}]`,
    });

    if (msgError) {
      toast.error("Staff added but invitation message failed to send");
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Staff invitation sent & member added!");
      setAddStaffOpen(false);
      setSelectedUserId("");
      setSelectedUserName("");
      setStaffUsername("");
      setStaffSearchResults([]);
      setSelectedSpecialties([]);
      setShowCustomInput(false);
      refetchStaff();
    }
    setSavingStaff(false);
  };

  const toggleStaffAvailability = async (member: any) => {
    const { error } = await supabase
      .from("staff_members")
      .update({ is_available: !member.is_available } as any)
      .eq("id", member.id);
    if (error) toast.error(error.message);
    else refetchStaff();
  };

  const removeStaffMember = async (memberId: string) => {
    const { error } = await supabase.from("staff_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Staff member removed"); refetchStaff(); }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!studio) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">Studio not found or not yours</h3>
        <Link to="/studios" className="mt-4">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Studios
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/studios/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Manage Studio</h1>
            <p className="text-sm text-muted-foreground">{studio.name}</p>
          </div>
        </div>
        <Button onClick={() => updateStudio.mutate()} disabled={updateStudio.isPending} className="gap-1.5">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Details</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Hours</TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Staff</TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Services</TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Bookings</TabsTrigger>
        </TabsList>

        {/* Details */}
        <TabsContent value="details" className="space-y-6 mt-4">
          <div className="surface-card p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Studio Name</Label>
                <Input value={studioForm.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Short Description</Label>
                <Input value={studioForm.short_description} onChange={(e) => updateField("short_description", e.target.value)} placeholder="One-liner for cards" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Full Description</Label>
              <Textarea value={studioForm.description} onChange={(e) => updateField("description", e.target.value)} rows={4} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input type="number" value={studioForm.hourly_rate} onChange={(e) => updateField("hourly_rate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Daily Rate ($)</Label>
                <Input type="number" value={studioForm.daily_rate ?? ""} onChange={(e) => updateField("daily_rate", e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Guests</Label>
                <Input type="number" value={studioForm.max_guests} onChange={(e) => updateField("max_guests", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={studioForm.city} onChange={(e) => updateField("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={studioForm.state} onChange={(e) => updateField("state", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={studioForm.address} onChange={(e) => updateField("address", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Studio Rules</Label>
              <Textarea value={studioForm.rules} onChange={(e) => updateField("rules", e.target.value)} rows={3} placeholder="Any rules or guidelines guests should know about..." />
            </div>

            <div className="space-y-2">
              <Label>Amenities (comma-separated)</Label>
              <Input
                value={(studioForm.amenities ?? []).join(", ")}
                onChange={(e) => updateField("amenities", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                placeholder="WiFi, Parking, AC, Kitchen..."
              />
            </div>

            <div className="space-y-2">
              <Label>Equipment (comma-separated)</Label>
              <Input
                value={(studioForm.equipment ?? []).join(", ")}
                onChange={(e) => updateField("equipment", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                placeholder="Monitors, Microphone, Camera..."
              />
            </div>
          </div>
        </TabsContent>

        {/* Hours */}
        <TabsContent value="hours" className="space-y-4 mt-4">
          <div className="surface-card p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Operating Hours</h3>
            <p className="text-sm text-muted-foreground">Set when your studio is open for bookings.</p>

            {availability && availability.length > 0 ? (
              <div className="space-y-3">
                {availability.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-4 rounded-xl border border-border p-3">
                    <div className="w-28">
                      <p className="text-sm font-medium text-foreground">{DAY_NAMES[slot.day_of_week]}</p>
                    </div>
                    <Switch
                      checked={slot.is_available}
                      onCheckedChange={(checked) => updateAvailability.mutate({ id: slot.id, is_available: checked, start_time: slot.start_time, end_time: slot.end_time })}
                    />
                    {slot.is_available ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={slot.start_time}
                          className="w-32"
                          onChange={(e) => updateAvailability.mutate({ id: slot.id, is_available: slot.is_available, start_time: e.target.value, end_time: slot.end_time })}
                        />
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input
                          type="time"
                          value={slot.end_time}
                          className="w-32"
                          onChange={(e) => updateAvailability.mutate({ id: slot.id, is_available: slot.is_available, start_time: slot.start_time, end_time: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/50 italic">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No availability configured yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Staff */}
        <TabsContent value="staff" className="space-y-4 mt-4">
          <div className="surface-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground">Staff Members</h3>
                <p className="text-sm text-muted-foreground">Manage your team who can be assigned to bookings.</p>
              </div>
              <Button size="sm" onClick={() => setAddStaffOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Staff
              </Button>
            </div>

            {staffMembers && staffMembers.length > 0 ? (
              <div className="space-y-2">
                {staffMembers.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {member.display_name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.display_name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {member.specialties?.map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === "pending" ? (
                        <Badge variant="outline" className="text-xs text-warning border-warning/30 bg-warning/10">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      ) : member.status === "declined" ? (
                        <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10">
                          <UserX className="h-3 w-3 mr-1" /> Declined
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStaffAvailability(member)}
                            className={member.is_available ? "text-primary" : "text-muted-foreground"}
                          >
                            {member.is_available ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                          </Button>
                          <Badge variant={member.is_available ? "default" : "secondary"} className="text-xs">
                            {member.is_available ? "Available" : "Unavailable"}
                          </Badge>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeStaffMember(member.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No staff members yet. Add your team above.</p>
              </div>
            )}
          </div>

          <Dialog open={addStaffOpen} onOpenChange={(o) => { setAddStaffOpen(o); if (!o) { setSelectedUserId(""); setSelectedUserName(""); setStaffUsername(""); setStaffSearchResults([]); setSelectedSpecialties([]); setShowCustomInput(false); setCustomSpecialty(""); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Search by Name</label>
                  <Input
                    value={staffUsername}
                    onChange={(e) => { setStaffUsername(e.target.value); searchUsers(e.target.value); }}
                    placeholder="Type a username to search..."
                  />
                  {searching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
                  {staffSearchResults.length > 0 && !selectedUserId && (
                    <div className="mt-2 border border-border rounded-xl overflow-hidden divide-y divide-border">
                      {staffSearchResults.map((p) => (
                        <button
                          key={p.user_id}
                          type="button"
                          onClick={() => { setSelectedUserId(p.user_id); setSelectedUserName(p.display_name || ""); setStaffUsername(p.display_name || ""); setStaffSearchResults([]); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{(p.display_name || "?")[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{p.display_name || "Unnamed"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUserId && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm text-foreground font-medium">{selectedUserName}</span>
                      <button type="button" onClick={() => { setSelectedUserId(""); setSelectedUserName(""); setStaffUsername(""); }} className="ml-auto text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Specialties</label>
                  {selectedSpecialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedSpecialties.map((s) => (
                        <Badge key={s} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setSelectedSpecialties((prev) => prev.filter((c) => c !== s))}>
                          {s} <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map((cat) => {
                      const active = cat === "other" ? showCustomInput : selectedSpecialties.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleSpecialty(cat)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all capitalize",
                            active
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  {showCustomInput && (
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                        placeholder="Enter custom specialty..."
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSpecialty(); } }}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={addCustomSpecialty} disabled={!customSpecialty.trim()}>Add</Button>
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={handleAddStaff} disabled={!selectedUserId || savingStaff}>
                  {savingStaff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Send Invitation & Add
                </Button>
                <p className="text-xs text-muted-foreground text-center">They'll receive a message invitation to join your studio staff.</p>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services" className="space-y-4 mt-4">
          <StudioServices />
        </TabsContent>

        {/* Bookings */}
        <TabsContent value="bookings" className="space-y-4 mt-4">
          <div className="surface-card p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Recent Bookings</h3>

            {bookings && bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(booking.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(booking.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {" — "}
                        {new Date(booking.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.guest_count} guest(s) • ${booking.total_price}
                        {booking.notes && ` • ${booking.notes}`}
                      </p>
                    </div>
                    <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="capitalize">
                      {booking.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No bookings yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Inline Services management component for studio owners
const StudioServices = () => {
  const { data: services, refetch } = useQuery({
    queryKey: ["studio-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").order("category").order("title");
      return data ?? [];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "audio", credits_cost: 1, duration_hours: 2,
    non_member_rate: null as number | null, is_active: true, revisions_info: "",
  });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "audio", credits_cost: 1, duration_hours: 2, non_member_rate: null, is_active: true, revisions_info: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      title: s.title, description: s.description || "", category: s.category, credits_cost: s.credits_cost,
      duration_hours: s.duration_hours, non_member_rate: s.non_member_rate, is_active: s.is_active, revisions_info: s.revisions_info || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title, description: form.description || null, category: form.category,
      credits_cost: form.credits_cost, duration_hours: form.duration_hours,
      non_member_rate: form.non_member_rate, is_active: form.is_active, revisions_info: form.revisions_info || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("services").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("services").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); } else {
      toast.success(editing ? "Service updated" : "Service created");
      setDialogOpen(false);
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Service deleted"); refetch(); }
  };

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-foreground">Services</h3>
          <p className="text-sm text-muted-foreground">Manage the services offered at your studio.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <div className="space-y-2">
        {(services || []).map((s: any) => (
          <div key={s.id} className={cn("flex items-center justify-between rounded-xl border border-border p-3", !s.is_active && "opacity-50")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                {!s.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {s.credits_cost} credits • {s.duration_hours}h
                {s.non_member_rate ? ` • Non-member: $${s.non_member_rate}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {(services || []).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No services yet. Add your first service above.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credits Cost</Label>
                <Input type="number" min={1} value={form.credits_cost} onChange={(e) => setForm({ ...form, credits_cost: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (hours)</Label>
                <Input type="number" min={0.5} step={0.5} value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Non-member Rate ($)</Label>
                <Input type="number" min={0} value={form.non_member_rate || ""} onChange={(e) => setForm({ ...form, non_member_rate: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Revisions Info</Label>
              <Input value={form.revisions_info} onChange={(e) => setForm({ ...form, revisions_info: e.target.value })} placeholder="e.g. 2 included" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudioManagePage;
