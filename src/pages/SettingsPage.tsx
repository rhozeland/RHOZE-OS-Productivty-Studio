import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const SettingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState("");
  const [available, setAvailable] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setPortfolioUrl(profile.portfolio_url ?? "");
      setSkills(profile.skills?.join(", ") ?? "");
      setAvailable(profile.available ?? true);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        bio,
        portfolio_url: portfolioUrl || null,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        available,
      }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      <div className="surface-card max-w-2xl p-6">
        <h2 className="mb-6 font-display text-lg font-semibold text-foreground">Profile</h2>
        <form onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(); }} className="space-y-5">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the world about your creative journey..." />
          </div>
          <div className="space-y-2">
            <Label>Skills (comma-separated)</Label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Illustration, 3D, Motion Design" />
          </div>
          <div className="space-y-2">
            <Label>Portfolio URL</Label>
            <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://yourportfolio.com" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={available} onCheckedChange={setAvailable} />
            <Label>Available for collaboration</Label>
          </div>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
