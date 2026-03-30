import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Settings, Wrench, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudioServiceManagerProps {
  studioId: string;
}

const StudioServiceManager = ({ studioId }: StudioServiceManagerProps) => {
  const queryClient = useQueryClient();

  // Custom studio services
  const { data: studioServices, refetch: refetchCustom } = useQuery({
    queryKey: ["studio-custom-services", studioId],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_services")
        .select("*")
        .eq("studio_id", studioId)
        .order("sort_order");
      return (data as any[]) ?? [];
    },
  });

  // Global services available to link
  const { data: globalServices } = useQuery({
    queryKey: ["global-services-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("title");
      return data ?? [];
    },
  });

  // Linked global services
  const { data: linkedServices, refetch: refetchLinked } = useQuery({
    queryKey: ["studio-linked-services", studioId],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_global_services")
        .select("*, service:services(*)")
        .eq("studio_id", studioId);
      return (data as any[]) ?? [];
    },
  });

  const linkedServiceIds = new Set(
    (linkedServices || []).map((l: any) => l.service_id)
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    price: 0,
    duration_hours: 1,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "general", price: 0, duration_hours: 1, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      title: s.title,
      description: s.description || "",
      category: s.category,
      price: s.price,
      duration_hours: s.duration_hours,
      is_active: s.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      studio_id: studioId,
      title: form.title,
      description: form.description || null,
      category: form.category,
      price: form.price,
      duration_hours: form.duration_hours,
      is_active: form.is_active,
    };
    let error;
    if (editing) {
      ({ error } = await supabase
        .from("studio_services")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("studio_services").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editing ? "Service updated" : "Service created");
      setDialogOpen(false);
      refetchCustom();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("studio_services")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Service removed");
      refetchCustom();
    }
  };

  const linkGlobalService = async (serviceId: string) => {
    const { error } = await supabase
      .from("studio_global_services")
      .insert({ studio_id: studioId, service_id: serviceId });
    if (error) toast.error(error.message);
    else {
      toast.success("Service linked");
      refetchLinked();
    }
  };

  const unlinkGlobalService = async (serviceId: string) => {
    const { error } = await supabase
      .from("studio_global_services")
      .delete()
      .eq("studio_id", studioId)
      .eq("service_id", serviceId);
    if (error) toast.error(error.message);
    else {
      toast.success("Service unlinked");
      refetchLinked();
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom studio services */}
      <div className="surface-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-foreground">
              Custom Services
            </h3>
            <p className="text-sm text-muted-foreground">
              Create services specific to this studio.
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </div>

        <div className="space-y-2">
          {(studioServices || []).map((s: any) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border p-3",
                !s.is_active && "opacity-50"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.title}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {s.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${s.price} • {s.duration_hours}h
                </p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(s)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(studioServices || []).length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">
              No custom services yet.
            </p>
          )}
        </div>
      </div>

      {/* Link global services */}
      <div className="surface-card p-6 space-y-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">
            Platform Services
          </h3>
          <p className="text-sm text-muted-foreground">
            Link global platform services to show on your studio listing.
          </p>
        </div>

        <div className="space-y-2">
          {(globalServices || []).map((s: any) => {
            const isLinked = linkedServiceIds.has(s.id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.title}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {s.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.credits_cost} credits • {s.duration_hours}h
                  </p>
                </div>
                <Button
                  variant={isLinked ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    isLinked
                      ? unlinkGlobalService(s.id)
                      : linkGlobalService(s.id)
                  }
                >
                  {isLinked ? (
                    <>
                      <Unlink className="h-3.5 w-3.5" /> Unlink
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" /> Link
                    </>
                  )}
                </Button>
              </div>
            );
          })}
          {(globalServices || []).length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">
              No platform services available.
            </p>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Service" : "New Studio Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.duration_hours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_hours: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 self-end pb-1">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudioServiceManager;
