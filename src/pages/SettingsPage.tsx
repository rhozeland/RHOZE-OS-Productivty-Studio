import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, Upload, Eye, EyeOff, X, Camera } from "lucide-react";
import { toast } from "sonner";

const PRESET_AVATARS = [
  "🎨", "🎵", "📸", "🎬", "✍️", "🎤", "💡", "🖌️",
  "🎸", "🎹", "📐", "🎭", "🌟", "🔥", "💎", "🦋",
];

const BANNER_GRADIENTS = [
  { label: "Mint Fade", value: "linear-gradient(135deg, hsl(175,60%,80%), hsl(200,40%,90%), hsl(330,30%,92%))" },
  { label: "Sunset", value: "linear-gradient(135deg, hsl(15,80%,65%), hsl(40,90%,70%), hsl(50,95%,80%))" },
  { label: "Ocean", value: "linear-gradient(135deg, hsl(200,70%,60%), hsl(220,60%,70%), hsl(190,50%,85%))" },
  { label: "Lavender", value: "linear-gradient(135deg, hsl(270,50%,70%), hsl(290,40%,80%), hsl(320,30%,90%))" },
  { label: "Forest", value: "linear-gradient(135deg, hsl(140,40%,55%), hsl(160,50%,65%), hsl(175,60%,80%))" },
  { label: "Rose", value: "linear-gradient(135deg, hsl(340,60%,65%), hsl(350,50%,75%), hsl(20,40%,85%))" },
  { label: "Charcoal", value: "linear-gradient(135deg, hsl(220,15%,30%), hsl(220,10%,45%), hsl(220,8%,60%))" },
  { label: "Golden", value: "linear-gradient(135deg, hsl(40,80%,55%), hsl(45,90%,65%), hsl(50,70%,80%))" },
  { label: "Berry", value: "linear-gradient(135deg, hsl(280,50%,45%), hsl(320,50%,60%), hsl(350,60%,75%))" },
  { label: "Arctic", value: "linear-gradient(135deg, hsl(195,60%,85%), hsl(210,50%,90%), hsl(230,40%,95%))" },
];

const PAGE_BACKGROUNDS = [
  { label: "Default", value: "" },
  { label: "Warm Paper", value: "linear-gradient(180deg, hsl(35,30%,95%) 0%, hsl(30,20%,92%) 100%)" },
  { label: "Cool Slate", value: "linear-gradient(180deg, hsl(215,20%,93%) 0%, hsl(220,15%,88%) 100%)" },
  { label: "Blush", value: "linear-gradient(180deg, hsl(340,25%,95%) 0%, hsl(350,20%,91%) 100%)" },
  { label: "Mint", value: "linear-gradient(180deg, hsl(165,25%,93%) 0%, hsl(175,20%,89%) 100%)" },
  { label: "Dusk", value: "linear-gradient(180deg, hsl(250,20%,20%) 0%, hsl(240,15%,15%) 100%)" },
  { label: "Midnight", value: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(230,20%,8%) 100%)" },
  { label: "Noir", value: "linear-gradient(180deg, hsl(0,0%,8%) 0%, hsl(0,0%,4%) 100%)" },
  { label: "Sunset Glow", value: "linear-gradient(135deg, hsl(20,50%,90%) 0%, hsl(40,40%,88%) 50%, hsl(350,30%,92%) 100%)" },
  { label: "Deep Ocean", value: "linear-gradient(180deg, hsl(200,40%,18%) 0%, hsl(210,35%,12%) 100%)" },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState("");
  const [mediums, setMediums] = useState("");
  const [location, setLocation] = useState("");
  const [available, setAvailable] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [bannerGradient, setBannerGradient] = useState("");
  const [profileBackground, setProfileBackground] = useState("");
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setHeadline((profile as any).headline ?? "");
      setBio(profile.bio ?? "");
      setPortfolioUrl(profile.portfolio_url ?? "");
      setSkills(profile.skills?.join(", ") ?? "");
      setMediums((profile as any).mediums?.join(", ") ?? "");
      setLocation((profile as any).location ?? "");
      setAvailable(profile.available ?? true);
      setIsPublic((profile as any).is_public !== false);
      setAvatarUrl(profile.avatar_url ?? "");
      setBannerGradient((profile as any).banner_gradient ?? "");
    }
  }, [profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatar-uploads")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatar-uploads")
        .getPublicUrl(path);

      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);

      // Update profile immediately
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", user.id);

      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Avatar updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleEmojiAvatar = async (emoji: string) => {
    if (!user) return;
    // Create an emoji-based avatar using a data URL with SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="200" height="200" fill="hsl(175,60%,92%)" rx="100"/>
      <text x="100" y="130" font-size="100" text-anchor="middle">${emoji}</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    setAvatarUrl(dataUrl);

    await supabase
      .from("profiles")
      .update({ avatar_url: dataUrl })
      .eq("user_id", user.id);

    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    setShowAvatarPicker(false);
    toast.success("Avatar updated!");
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          headline,
          bio,
          portfolio_url: portfolioUrl || null,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          mediums: mediums
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          location: location || null,
          available,
          is_public: isPublic,
          banner_gradient: bannerGradient || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const initials = (displayName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Appearance */}
      <div className="surface-card max-w-2xl p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "light" ? (
              <Sun className="h-5 w-5 text-warm" />
            ) : (
              <Moon className="h-5 w-5 text-primary" />
            )}
            <div>
              <Label className="text-sm font-medium">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
      </div>

      {/* Avatar */}
      <div className="surface-card max-w-2xl p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Display Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-muted overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-xl font-bold text-muted-foreground">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="h-6 w-6 text-background" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              >
                Pick Avatar
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setAvatarUrl("");
                    await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user!.id);
                    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                    toast.success("Avatar removed");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
              e.target.value = "";
            }}
          />
      </div>

      {/* Banner Gradient */}
      <div className="surface-card max-w-2xl p-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-foreground">Banner Gradient</h2>
        <p className="text-xs text-muted-foreground mb-4">Choose a gradient for your profile banner</p>

        {/* Preview */}
        <div
          className="h-20 rounded-xl mb-4 border border-border"
          style={{
            background: bannerGradient || "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.2), hsl(var(--primary) / 0.1))",
          }}
        />

        {/* Gradient presets */}
        <div className="grid grid-cols-5 gap-2">
          {BANNER_GRADIENTS.map((g) => (
            <button
              key={g.label}
              onClick={async () => {
                setBannerGradient(g.value);
                await supabase.from("profiles").update({ banner_gradient: g.value } as any).eq("user_id", user!.id);
                queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                toast.success(`Banner set to ${g.label}`);
              }}
              className={`group relative rounded-lg overflow-hidden border-2 transition-all h-10 ${
                bannerGradient === g.value ? "border-primary shadow-md" : "border-border hover:border-primary/40"
              }`}
              style={{ background: g.value }}
              title={g.label}
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20 text-[9px] font-semibold text-card tracking-wide">
                {g.label}
              </span>
            </button>
          ))}
        </div>

        {bannerGradient && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-xs"
            onClick={async () => {
              setBannerGradient("");
              await supabase.from("profiles").update({ banner_gradient: null } as any).eq("user_id", user!.id);
              queryClient.invalidateQueries({ queryKey: ["my-profile"] });
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              toast.success("Reset to default gradient");
            }}
          >
            <X className="mr-1 h-3 w-3" /> Reset to default
          </Button>
        )}
      </div>

        {showAvatarPicker && (
          <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground mb-3">Choose an avatar</p>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiAvatar(emoji)}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card hover:bg-primary/10 hover:border-primary transition-colors text-2xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="surface-card max-w-2xl p-6">
        <h2 className="mb-6 font-display text-lg font-semibold text-foreground">Profile</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProfile.mutate();
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Music Producer & Visual Artist"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world about your creative journey..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Skills (comma-separated)</Label>
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Illustration, 3D, Motion Design"
              />
            </div>
            <div className="space-y-2">
              <Label>Mediums (comma-separated)</Label>
              <Input
                value={mediums}
                onChange={(e) => setMediums(e.target.value)}
                placeholder="Digital, Oil, Acrylic, Photography"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State or Country"
              />
            </div>
            <div className="space-y-2">
              <Label>Portfolio URL</Label>
              <Input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <Switch checked={available} onCheckedChange={setAvailable} />
              <Label>Available for collaboration</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <div className="flex items-center gap-1.5">
                {isPublic ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                <Label>{isPublic ? "Public Profile" : "Private Profile"}</Label>
              </div>
            </div>
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
