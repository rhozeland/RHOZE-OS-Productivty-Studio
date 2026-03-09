import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const SETTING_LABELS: Record<string, string> = {
  studio_name: "Studio Name",
  credit_rate_usd: "Credit Rate (USD)",
  booking_lead_time_hours: "Min Booking Lead Time (hours)",
  max_booking_duration_hours: "Max Booking Duration (hours)",
  studio_address: "Studio Address",
  studio_phone: "Studio Phone",
  studio_email: "Studio Email",
};

const HOUR_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const AdminSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("studio_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value || ""; });

      if (map.studio_hours) {
        try { setHours(JSON.parse(map.studio_hours)); } catch { /* ignore */ }
      }

      setSettings(map);
      setLoading(false);
    };

    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    const updatedSettings = {
      ...settings,
      studio_hours: JSON.stringify(hours),
    };

    const promises = Object.entries(updatedSettings).map(([key, value]) =>
      supabase.from("studio_settings").update({ value }).eq("key", key)
    );

    const results = await Promise.all(promises);
    const hasError = results.some((r) => r.error);

    setSaving(false);
    if (hasError) {
      toast({ title: "Error saving some settings", variant: "destructive" });
    } else {
      toast({ title: "Settings saved" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">General Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Object.entries(SETTING_LABELS).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                value={settings[key] || ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Studio Hours</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {HOUR_DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="w-10 text-sm font-medium text-foreground uppercase">{day}</span>
              <Input
                value={hours[day] || ""}
                onChange={(e) => setHours({ ...hours, [day]: e.target.value })}
                placeholder="e.g. 10:00-22:00 or closed"
                className="flex-1"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All Settings"}
      </Button>
    </div>
  );
};

export default AdminSettings;
