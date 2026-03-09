import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Service = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  credits_cost: number;
  duration_hours: number;
  non_member_rate: number | null;
  is_active: boolean;
  revisions_info: string | null;
};

const emptyService = {
  title: "",
  description: "",
  category: "audio",
  credits_cost: 1,
  duration_hours: 2,
  non_member_rate: null as number | null,
  is_active: true,
  revisions_info: "",
};

const AdminServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyService);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    const { data } = await supabase.from("services").select("*").order("category").order("title");
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyService);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      title: s.title,
      description: s.description || "",
      category: s.category,
      credits_cost: s.credits_cost,
      duration_hours: s.duration_hours,
      non_member_rate: s.non_member_rate,
      is_active: s.is_active,
      revisions_info: s.revisions_info || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      credits_cost: form.credits_cost,
      duration_hours: form.duration_hours,
      non_member_rate: form.non_member_rate,
      is_active: form.is_active,
      revisions_info: form.revisions_info || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("services").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("services").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Service updated" : "Service created" });
      setDialogOpen(false);
      fetchServices();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Service deleted" });
      fetchServices();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const categoryColors: Record<string, string> = {
    audio: "bg-purple-500/10 text-purple-600",
    design: "bg-primary/10 text-primary",
    video: "bg-orange-500/10 text-orange-600",
    studio: "bg-blue-500/10 text-blue-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Services ({services.length})</h2>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <div className="grid gap-3">
        {services.map((s) => (
          <Card key={s.id} className={`bg-card ${!s.is_active ? "opacity-50" : ""}`}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-foreground truncate">{s.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[s.category] || "bg-muted text-muted-foreground"}`}>
                    {s.category}
                  </span>
                  {!s.is_active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Inactive</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.credits_cost} cr • ${s.credits_cost * 75} USD • {s.duration_hours}h
                  {s.non_member_rate ? ` • Non-member: $${s.non_member_rate}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
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
              <div>
                <Label>Credits Cost</Label>
                <Input type="number" min={1} value={form.credits_cost} onChange={(e) => setForm({ ...form, credits_cost: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration (hours)</Label>
                <Input type="number" min={0.5} step={0.5} value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Non-member Rate ($)</Label>
                <Input type="number" min={0} value={form.non_member_rate || ""} onChange={(e) => setForm({ ...form, non_member_rate: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <Label>Revisions Info</Label>
              <Input value={form.revisions_info} onChange={(e) => setForm({ ...form, revisions_info: e.target.value })} placeholder="e.g. 2 included" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServices;
