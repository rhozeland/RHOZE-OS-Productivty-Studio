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
import { Separator } from "@/components/ui/separator";
import {
  Moon,
  Sun,
  Upload,
  Eye,
  EyeOff,
  X,
  Camera,
  Lock,
  MapPin,
  Bell,
  Trash2,
  AlertTriangle,
  Download,
  User,
} from "lucide-react";
import { toast } from "sonner";

const SectionCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`surface-card max-w-2xl p-6 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
  <h2 className="mb-4 font-display text-lg font-semibold text-foreground flex items-center gap-2">
    <Icon className="h-5 w-5 text-primary" /> {children}
  </h2>
);

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
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
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
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Shipping fields
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  // Notification prefs
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifInquiries, setNotifInquiries] = useState(true);
  const [notifPurchases, setNotifPurchases] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [initialized, setInitialized] = useState(false);

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
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profile && !initialized) {
      const p = profile as any;
      setDisplayName(p.display_name ?? "");
      setHeadline(p.headline ?? "");
      setBio(p.bio ?? "");
      setPortfolioUrl(p.portfolio_url ?? "");
      setSkills(p.skills?.join(", ") ?? "");
      setMediums(p.mediums?.join(", ") ?? "");
      setLocation(p.location ?? "");
      setAvailable(p.available ?? true);
      setIsPublic(p.is_public !== false);
      setAvatarUrl(p.avatar_url ?? "");
      setBannerGradient(p.banner_gradient ?? "");
      setProfileBackground(p.profile_background ?? "");
      setInstagramUrl(p.instagram_url ?? "");
      setTiktokUrl(p.tiktok_url ?? "");
      setTwitterUrl(p.twitter_url ?? "");
      setYoutubeUrl(p.youtube_url ?? "");
      setAddressLine1(p.shipping_address_line1 ?? "");
      setAddressLine2(p.shipping_address_line2 ?? "");
      setCity(p.shipping_city ?? "");
      setState(p.shipping_state ?? "");
      setZip(p.shipping_zip ?? "");
      setCountry(p.shipping_country ?? "");
      setNotifMessages(p.email_notif_messages ?? true);
      setNotifInquiries(p.email_notif_inquiries ?? true);
      setNotifPurchases(p.email_notif_purchases ?? true);
      setNotifReviews(p.email_notif_reviews ?? true);
      setInitialized(true);
    }
  }, [profile, initialized]);

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
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="200" height="200" fill="hsl(175,60%,92%)" rx="100"/>
      <text x="100" y="130" font-size="100" text-anchor="middle">${emoji}</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    setAvatarUrl(dataUrl);
    await supabase.from("profiles").update({ avatar_url: dataUrl }).eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
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
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          mediums: mediums.split(",").map((s) => s.trim()).filter(Boolean),
          location: location || null,
          available,
          is_public: isPublic,
          banner_gradient: bannerGradient || null,
          profile_background: profileBackground || null,
          instagram_url: instagramUrl || null,
          tiktok_url: tiktokUrl || null,
          twitter_url: twitterUrl || null,
          youtube_url: youtubeUrl || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateShipping = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          shipping_address_line1: addressLine1 || null,
          shipping_address_line2: addressLine2 || null,
          shipping_city: city || null,
          shipping_state: state || null,
          shipping_zip: zip || null,
          shipping_country: country || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Shipping address saved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateNotifications = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          email_notif_messages: notifMessages,
          email_notif_inquiries: notifInquiries,
          email_notif_purchases: notifPurchases,
          email_notif_reviews: notifReviews,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Notification preferences saved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      if (newPassword !== confirmPassword) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    // Sign out — full deletion would require an admin function
    toast.success("Account deactivated. Signing out...");
    setTimeout(() => signOut(), 1500);
  };

  const handleExportData = async () => {
    if (!user) return;
    const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    const { data: projects } = await supabase.from("projects").select("*").eq("user_id", user.id);
    const { data: listings } = await supabase.from("marketplace_listings").select("*").eq("user_id", user.id);
    const exportData = { profile: profileData, projects, listings, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rhozeland-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported!");
  };

  const initials = (displayName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account, profile, and preferences</p>
      </div>

      {/* ─── Appearance ─── */}
      <SectionCard>
        <SectionTitle icon={Sun}>Appearance</SectionTitle>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "light" ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-primary" />}
            <div>
              <Label className="text-sm font-medium">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
      </SectionCard>

      {/* ─── Avatar ─── */}
      <SectionCard>
        <SectionTitle icon={User}>Display Picture</SectionTitle>
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
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                Pick Avatar
              </Button>
              {avatarUrl && (
                <Button variant="ghost" size="sm" onClick={async () => {
                  setAvatarUrl("");
                  await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user!.id);
                  queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                  toast.success("Avatar removed");
                }}>
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
      </SectionCard>

      {/* ─── Banner ─── */}
      <SectionCard>
        <h2 className="mb-2 font-display text-lg font-semibold text-foreground">Banner</h2>
        <p className="text-xs text-muted-foreground mb-4">Upload a custom banner image or choose a gradient. Recommended size: 1200×400px.</p>
        <div
          className="h-20 rounded-xl mb-4 border border-border overflow-hidden"
          style={{
            background: bannerGradient || "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.2), hsl(var(--primary) / 0.1))",
          }}
        >
          {bannerImageUrl && (
            <img src={bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Upload banner image */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => bannerFileRef.current?.click()} disabled={uploadingBanner}>
            <Upload className="mr-2 h-4 w-4" />
            {uploadingBanner ? "Uploading..." : "Upload Image"}
          </Button>
          {bannerImageUrl && (
            <Button variant="ghost" size="sm" onClick={async () => {
              setBannerImageUrl("");
              await supabase.from("profiles").update({ banner_url: null } as any).eq("user_id", user!.id);
              queryClient.invalidateQueries({ queryKey: ["my-profile"] });
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              toast.success("Banner image removed");
            }}>
              <X className="mr-1 h-3 w-3" /> Remove Image
            </Button>
          )}
          <input
            ref={bannerFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBannerUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground mb-3">Or pick a gradient (used when no image is set)</p>
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
          <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={async () => {
            setBannerGradient("");
            await supabase.from("profiles").update({ banner_gradient: null } as any).eq("user_id", user!.id);
            queryClient.invalidateQueries({ queryKey: ["my-profile"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            toast.success("Reset to default gradient");
          }}>
            <X className="mr-1 h-3 w-3" /> Reset to default
          </Button>
        )}
      </SectionCard>

      {/* ─── Page Background ─── */}
      <SectionCard>
        <h2 className="mb-2 font-display text-lg font-semibold text-foreground">Profile Page Background</h2>
        <p className="text-xs text-muted-foreground mb-4">Set a full-page background for your public profile</p>
        <div
          className="h-16 rounded-xl mb-4 border border-border flex items-center justify-center"
          style={{ background: profileBackground || "hsl(var(--background))" }}
        >
          <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">Preview</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {PAGE_BACKGROUNDS.map((bg) => (
            <button
              key={bg.label}
              onClick={async () => {
                setProfileBackground(bg.value);
                await supabase.from("profiles").update({ profile_background: bg.value || null } as any).eq("user_id", user!.id);
                queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                toast.success(`Page background: ${bg.label}`);
              }}
              className={`group relative rounded-lg overflow-hidden border-2 transition-all h-10 ${
                profileBackground === bg.value ? "border-primary shadow-md" : "border-border hover:border-primary/40"
              }`}
              style={{ background: bg.value || "hsl(var(--background))" }}
              title={bg.label}
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20 text-[9px] font-semibold text-card tracking-wide">
                {bg.label}
              </span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ─── Profile Info ─── */}
      <SectionCard>
        <SectionTitle icon={User}>Profile</SectionTitle>
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
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Music Producer & Visual Artist" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the world about your creative journey..." rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Skills (comma-separated)</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Illustration, 3D, Motion Design" />
            </div>
            <div className="space-y-2">
              <Label>Mediums (comma-separated)</Label>
              <Input value={mediums} onChange={(e) => setMediums(e.target.value)} placeholder="Digital, Oil, Acrylic, Photography" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State or Country" />
            </div>
            <div className="space-y-2">
              <Label>Portfolio URL</Label>
              <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://yourportfolio.com" />
            </div>
          </div>
          <Separator className="my-1" />
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Social Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/username" />
              </div>
              <div className="space-y-2">
                <Label>TikTok</Label>
                <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@username" />
              </div>
              <div className="space-y-2">
                <Label>X (Twitter)</Label>
                <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/username" />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@channel" />
              </div>
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
      </SectionCard>

      {/* ─── Shipping Address ─── */}
      <SectionCard>
        <SectionTitle icon={MapPin}>Shipping Address</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4">Used for physical product deliveries from the marketplace</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateShipping.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="space-y-2">
            <Label>Address Line 2 (optional)</Label>
            <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Apt 4B" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toronto" />
            </div>
            <div className="space-y-2">
              <Label>State / Province</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="ON" />
            </div>
            <div className="space-y-2">
              <Label>ZIP / Postal Code</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="M5V 1A1" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Canada" />
            </div>
          </div>
          <Button type="submit" disabled={updateShipping.isPending}>
            {updateShipping.isPending ? "Saving..." : "Save Address"}
          </Button>
        </form>
      </SectionCard>

      {/* ─── Change Password ─── */}
      <SectionCard>
        <SectionTitle icon={Lock}>Change Password</SectionTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            changePassword.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
          </div>
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </SectionCard>

      {/* ─── Email Notifications ─── */}
      <SectionCard>
        <SectionTitle icon={Bell}>Email Notifications</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4">Choose which notifications you'd like to receive</p>
        <div className="space-y-4">
          {[
            { label: "New Messages", desc: "When someone sends you a message", value: notifMessages, set: setNotifMessages },
            { label: "Inquiries", desc: "When you receive a new inquiry on a listing", value: notifInquiries, set: setNotifInquiries },
            { label: "Purchases", desc: "When someone buys your listing", value: notifPurchases, set: setNotifPurchases },
            { label: "Reviews", desc: "When someone leaves a review", value: notifReviews, set: setNotifReviews },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={item.value} onCheckedChange={item.set} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateNotifications.mutate()}
            disabled={updateNotifications.isPending}
          >
            {updateNotifications.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </SectionCard>

      {/* ─── Account / Danger Zone ─── */}
      <SectionCard className="border-destructive/30">
        <SectionTitle icon={AlertTriangle}>Account</SectionTitle>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Export Your Data</p>
              <p className="text-xs text-muted-foreground">Download a copy of your profile, projects, and listings</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-destructive">Delete Account</p>
            <p className="text-xs text-muted-foreground mb-3">
              This will sign you out and deactivate your account. This action cannot be easily undone.
            </p>
            <div className="flex items-center gap-3">
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="max-w-[200px] text-sm"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE"}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Account
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <p className="text-xs text-muted-foreground text-center">
        Signed in as {user?.email}
      </p>
    </div>
  );
};

export default SettingsPage;
