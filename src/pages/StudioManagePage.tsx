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
import {
  Building2,
  ArrowLeft,
  Save,
  Users,
  Settings,
  Calendar,
  UserPlus,
  Trash2,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";

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
  const [staffEmail, setStaffEmail] = useState("");

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
  const { data: staffMembers } = useQuery({
    queryKey: ["studio-staff", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("*")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

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

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

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
        <TabsList>
          <TabsTrigger value="details" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Details</TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Staff</TabsTrigger>
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
              <Textarea value={studioForm.rules} onChange={(e) => updateField("rules", e.target.value)} rows={3} placeholder="Any house rules guests should know about..." />
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

        {/* Staff */}
        <TabsContent value="staff" className="space-y-4 mt-4">
          <div className="surface-card p-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Your Staff Members</h3>
            <p className="text-sm text-muted-foreground">Staff members who can be assigned to bookings at your studio.</p>

            {staffMembers && staffMembers.length > 0 ? (
              <div className="space-y-2">
                {staffMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          member.display_name[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.display_name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {member.specialties?.map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Badge variant={member.is_available ? "default" : "secondary"}>
                      {member.is_available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No staff members yet. Add your team from the admin panel.</p>
              </div>
            )}
          </div>
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

export default StudioManagePage;
