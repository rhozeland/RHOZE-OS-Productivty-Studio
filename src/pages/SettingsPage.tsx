import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeFileExt, safeContentType } from "@/lib/file-ext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Moon, Sun, Upload, X, Camera, Lock, Bell,
  Trash2, AlertTriangle, Download, User, Box, Wallet,
  ChevronRight, BadgeCheck, Instagram, Music2, Twitter, Youtube, Globe,
  Truck, IdCard, Image as ImageIcon, CalendarSync,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useArtistVerification } from "@/hooks/useArtistVerification";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import LogoCustomizer from "@/components/onboarding/LogoCustomizer";
import ClaimLimitsControl from "@/components/settings/ClaimLimitsControl";
import SettingsSubNav, {
  useActiveSettingsSection,
} from "@/components/settings/SettingsSubNav";
import WorksPage from "@/pages/WorksPage";
import MyVerificationRequests from "@/components/works/MyVerificationRequests";
import IcsImportCard from "@/components/settings/IcsImportCard";
import LaunchpadIdlSettings from "@/components/launchpad/LaunchpadIdlSettings";
import LaunchpadIdlVersions from "@/components/launchpad/LaunchpadIdlVersions";
import CreatorReadinessCard from "@/components/profile/CreatorReadinessCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { REGIONS } from "@/lib/regions";
import { RolePicker } from "@/components/profile/RolePicker";
import ArchetypePicker from "@/components/profile/ArchetypePicker";
import type { Archetype } from "@/lib/archetypes";

/** Broad creator categories — replaces the granular role/specialty grid. */
const CATEGORY_OPTIONS = [
  { id: "music", label: "Music", emoji: "🎧" },
  { id: "video", label: "Video", emoji: "🎬" },
  { id: "photo", label: "Photo", emoji: "📷" },
  { id: "design", label: "Design", emoji: "🎨" },
  { id: "writing", label: "Writing", emoji: "✍️" },
  { id: "development", label: "Development", emoji: "💻" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "performance", label: "Performance", emoji: "🎭" },
];

/* ─── Section nav items ─── */
const SECTIONS = [
  // Avatar + banner now folded into Profile (one identity surface).
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet", icon: Wallet },
  // Verified IP vault + Verified Artist identity merged into one "Verification" surface.
  // id stays "provenance" so existing /settings#provenance links keep working.
  { id: "provenance", label: "Verification", icon: BadgeCheck },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "calendar", label: "Calendar Sync", icon: CalendarSync },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "account", label: "Account", icon: AlertTriangle },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── Gradient / background presets ─── */
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
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // Active sub-section is driven by the URL hash (e.g. /settings#wallet) via
  // a tiny hook that defaults safely when the hash is missing or unknown.
  // This makes every section deep-linkable and lets the shared nav resolver
  // decide which link is "active", just like the dock and header do.
  const SECTION_IDS = SECTIONS.map((s) => s.id) as readonly SectionId[];
  const activeSection = useActiveSettingsSection<SectionId>(
    SECTION_IDS,
    "profile",
  );

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [headline, setHeadline] = useState(""); // Slogan / ethos one-liner
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [creatorRoles, setCreatorRoles] = useState<string[]>([]);
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [skillsList, setSkillsList] = useState<string[]>([]);
  const [mediumsList, setMediumsList] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [regionCode, setRegionCode] = useState<string>("");
  const [available, setAvailable] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState<false | "toybox">(false);
  const [bannerGradient, setBannerGradient] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
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

  // Password + email change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

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
      setUsername(p.username ?? "");
      setHeadline(p.headline ?? "");
      setBio(p.bio ?? "");
      setPortfolioUrl(p.portfolio_url ?? "");
      setCreatorRoles(Array.isArray(p.creator_roles) ? p.creator_roles : []);
      setArchetype((p.archetype as Archetype | null) ?? null);
      setSkillsList(Array.isArray(p.skills) ? p.skills : []);
      setMediumsList(Array.isArray(p.mediums) ? p.mediums : []);
      setLocation(p.location ?? "");
      setRegionCode(p.region_code ?? "");
      setAvailable(p.available ?? true);
      setIsPublic(p.is_public !== false);
      setAvatarUrl(p.avatar_url ?? "");
      setBannerGradient(p.banner_gradient ?? "");
      setBannerImageUrl(p.banner_url ?? "");
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

  /* ─── Handlers ─── */
  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const ext = safeFileExt(file);
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatar-uploads").upload(path, file, { upsert: true, contentType: safeContentType(file) });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatar-uploads").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Avatar updated!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleBannerUpload = async (file: File) => {
    if (!user) return;
    if (!(profile as any)?.verified_pro_at) { toast.error("Verified Pro required for custom banner uploads."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Banner image must be under 10MB"); return; }
    setUploadingBanner(true);
    try {
      const ext = safeFileExt(file);
      const path = `${user.id}/banner.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatar-uploads").upload(path, file, { upsert: true, contentType: safeContentType(file) });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatar-uploads").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      setBannerImageUrl(url);
      await supabase.from("profiles").update({ banner_url: url } as any).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Banner image updated!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingBanner(false); }
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!archetype) {
        throw new Error("Pick a creator type — Artist, Builder, or Influencer.");
      }
      if (!bio || bio.trim().length < 40) {
        throw new Error("About needs at least 40 characters — give fans something to read.");
      }
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
        username: username.toLowerCase() || null,
        headline, bio,
        portfolio_url: portfolioUrl || null,
        creator_roles: creatorRoles,
        archetype,
        skills: skillsList,
        mediums: mediumsList,
        location: location || null,
        region_code: regionCode || null,
        available, is_public: isPublic,
        banner_gradient: bannerGradient || null,
        profile_background: profileBackground || null,
        instagram_url: instagramUrl || null,
        tiktok_url: tiktokUrl || null,
        twitter_url: twitterUrl || null,
        youtube_url: youtubeUrl || null,
      } as any).eq("user_id", user!.id);
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
      const { error } = await supabase.from("profiles").update({
        shipping_address_line1: addressLine1 || null,
        shipping_address_line2: addressLine2 || null,
        shipping_city: city || null,
        shipping_state: state || null,
        shipping_zip: zip || null,
        shipping_country: country || null,
      } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-profile"] }); toast.success("Shipping address saved!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateNotifications = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        email_notif_messages: notifMessages,
        email_notif_inquiries: notifInquiries,
        email_notif_purchases: notifPurchases,
        email_notif_reviews: notifReviews,
      } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-profile"] }); toast.success("Notification preferences saved!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      if (newPassword !== confirmPassword) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => { setNewPassword(""); setConfirmPassword(""); toast.success("Password changed successfully!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const changeEmail = useMutation({
    mutationFn: async () => {
      const trimmed = newEmail.trim().toLowerCase();
      if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
        throw new Error("Enter a valid email address");
      }
      if (trimmed === user?.email) throw new Error("That's already your email");
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confirmation sent", {
        description: "Check both your old and new inbox to confirm the change.",
      });
      setNewEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { toast.error("Type DELETE to confirm"); return; }
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
    const a = document.createElement("a"); a.href = url;
    a.download = `rhozeland-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Data exported!");
  };

  const initials = (displayName || username || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  /* ─── Section renderers ─── */
  /**
   * Social platforms — handle-only entry. We store the full URL in the DB
   * but the user only types their `@handle`; the prefix is appended.
   * Website is the lone exception: free-form URL.
   */
  const SOCIAL_PLATFORMS = [
    { id: "ig",  label: "Instagram",   prefix: "https://instagram.com/", Icon: Instagram, value: instagramUrl, set: setInstagramUrl },
    { id: "tt",  label: "TikTok",      prefix: "https://tiktok.com/@",   Icon: Music2,    value: tiktokUrl,    set: setTiktokUrl },
    { id: "tw",  label: "X / Twitter", prefix: "https://x.com/",         Icon: Twitter,   value: twitterUrl,   set: setTwitterUrl },
    { id: "yt",  label: "YouTube",     prefix: "https://youtube.com/@",  Icon: Youtube,   value: youtubeUrl,   set: setYoutubeUrl },
  ];

  const handleFromUrl = (url: string, prefix: string) => {
    if (!url) return "";
    const stripped = prefix.replace(/^https?:\/\//, "");
    return url.replace(/^https?:\/\//, "").replace(stripped, "").replace(/^@/, "");
  };

  const renderProfile = () => (
    <form onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(); }} className="space-y-6">
      {/* 1. Display name + Username */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Display Name <span className="text-destructive">*</span></Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="your_username" className="pl-8" maxLength={20} />
          </div>
        </div>
      </div>

      {/* 2. Creator type */}
      <div className="space-y-2">
        <Label>Creator type <span className="text-destructive">*</span></Label>
        <ArchetypePicker value={archetype} onChange={setArchetype} />
      </div>

      {/* 3. Location + Region */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State or Country" />
        </div>
        <div className="space-y-2">
          <Label>Region</Label>
          <select
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">— Pick your market —</option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.flag} {r.label} ({r.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. About You — required */}
      <div className="space-y-2">
        <Label>About You <span className="text-destructive">*</span></Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A few sentences — your background, what you're working on, who you collaborate with…"
          rows={4}
          maxLength={500}
        />
        <p className="text-[10px] text-muted-foreground">{bio.length}/500 — at least 40 characters</p>
      </div>

      {/* 5. Social links — icon row + popover for handle. Website = free URL. */}
      <div className="space-y-2">
        <Label>Social links</Label>
        <p className="text-[11px] text-muted-foreground">Click an icon and just drop your handle — we'll build the link.</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {SOCIAL_PLATFORMS.map((p) => {
            const filled = !!p.value;
            const handle = handleFromUrl(p.value, p.prefix);
            return (
              <Popover key={p.id}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title={p.label}
                    aria-label={p.label}
                    className={cn(
                      "relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                      filled
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    <p.Icon className="h-4 w-4" />
                    {filled && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">{p.label} handle</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      value={handle}
                      onChange={(e) => {
                        const h = e.target.value.replace(/^@/, "").replace(/\s/g, "");
                        p.set(h ? `${p.prefix}${h}` : "");
                      }}
                      placeholder="your_handle"
                      className="pl-8 h-9 text-sm"
                      maxLength={50}
                    />
                  </div>
                  {handle && (
                    <p className="text-[10px] text-muted-foreground truncate">{p.prefix}{handle}</p>
                  )}
                </PopoverContent>
              </Popover>
            );
          })}

          {/* Website — full URL exception */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Website / Portfolio"
                aria-label="Website / Portfolio"
                className={cn(
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                  portfolioUrl
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <Globe className="h-4 w-4" />
                {portfolioUrl && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Website / Portfolio</p>
              <Input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="h-9 text-sm"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button type="submit" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );

  // Appearance, Dock Menu, and Flow Cards customizers were retired in the
  // v7 settings cleanup. Theme toggle lives in the global header; the dock
  // is hidden globally; Flow Cards customization will return alongside the
  // Hub view toggle if user demand re-emerges.

  const renderAvatar = () => (
    <div className="space-y-4">
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
            <Button
              variant={showAvatarPicker === "toybox" ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAvatarPicker(showAvatarPicker === "toybox" ? false : "toybox")}
            >
              <Box className="mr-2 h-4 w-4" />
              ToyBox Logo
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
      {showAvatarPicker === "toybox" && (
        <div className="p-4 rounded-lg border border-border bg-muted/30">
          <p className="text-sm font-medium text-foreground mb-3">Customize your ToyBox mark</p>
          <p className="text-xs text-muted-foreground mb-4">
            Click a section, pick a color, then export to set it as your display picture.
          </p>
          <LogoCustomizer
            compact
            onSave={async (dataUrl) => {
              if (!user) return;
              try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const path = `${user.id}/toybox-logo.png`;
                await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/png" });
                const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                const url = `${urlData.publicUrl}?t=${Date.now()}`;
                setAvatarUrl(url);
                await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
                queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                queryClient.invalidateQueries({ queryKey: ["my-profile-sidebar"] });
                toast.success("ToyBox logo set as your display picture!");
              } catch (err: any) { toast.error(err.message || "Failed to save logo"); }
            }}
          />
        </div>
      )}
    </div>
  );

  const isVerifiedPro = !!(profile as any)?.verified_pro_at;

  const renderBanner = () => (
    <Tabs defaultValue="banner" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="banner">Profile Banner</TabsTrigger>
        <TabsTrigger value="background">Page Background</TabsTrigger>
      </TabsList>

      <TabsContent value="banner" className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">Pick a gradient, or upgrade to Verified Pro to upload a custom image. Recommended: 1200×400px.</p>
        <div
          className="h-20 rounded-xl border border-border overflow-hidden"
          style={{ background: bannerGradient || "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.2), hsl(var(--primary) / 0.1))" }}
        >
          {bannerImageUrl && <img src={bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!isVerifiedPro) { toast.error("Custom banner uploads are a Verified Pro perk. Upgrade from your profile."); return; }
              bannerFileRef.current?.click();
            }}
            disabled={uploadingBanner}
            className={!isVerifiedPro ? "opacity-60" : ""}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadingBanner ? "Uploading..." : isVerifiedPro ? "Upload Image" : "Upload Image (Pro)"}
          </Button>
          {!isVerifiedPro && (
            <span className="text-[11px] text-muted-foreground">Verified Pro unlocks custom banners.</span>
          )}
          {bannerImageUrl && isVerifiedPro && (
            <Button variant="ghost" size="sm" onClick={async () => {
              setBannerImageUrl("");
              await supabase.from("profiles").update({ banner_url: null } as any).eq("user_id", user!.id);
              queryClient.invalidateQueries({ queryKey: ["my-profile"] });
              toast.success("Banner image removed");
            }}>
              <X className="mr-1 h-3 w-3" /> Remove Image
            </Button>
          )}
          <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBannerUpload(file);
            e.target.value = "";
          }} />
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">Or pick a gradient (used when no image is set)</p>
        <div className="grid grid-cols-5 gap-2">
          {BANNER_GRADIENTS.map((g) => (
            <button
              key={g.label}
              onClick={async () => {
                setBannerGradient(g.value);
                await supabase.from("profiles").update({ banner_gradient: g.value } as any).eq("user_id", user!.id);
                queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                toast.success(`Banner set to ${g.label}`);
              }}
              className={cn(
                "group relative rounded-lg overflow-hidden border-2 transition-all h-10",
                bannerGradient === g.value ? "border-primary shadow-md" : "border-border hover:border-primary/40"
              )}
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
          <Button variant="ghost" size="sm" className="text-xs" onClick={async () => {
            setBannerGradient("");
            await supabase.from("profiles").update({ banner_gradient: null } as any).eq("user_id", user!.id);
            queryClient.invalidateQueries({ queryKey: ["my-profile"] });
            toast.success("Reset to default gradient");
          }}>
            <X className="mr-1 h-3 w-3" /> Reset to default
          </Button>
        )}
      </TabsContent>

      <TabsContent value="background" className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">Set a full-page background for your public profile</p>
        <div
          className="h-16 rounded-xl border border-border flex items-center justify-center"
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
                toast.success(`Page background: ${bg.label}`);
              }}
              className={cn(
                "group relative rounded-lg overflow-hidden border-2 transition-all h-10",
                profileBackground === bg.value ? "border-primary shadow-md" : "border-border hover:border-primary/40"
              )}
              style={{ background: bg.value || "hsl(var(--background))" }}
              title={bg.label}
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/20 text-[9px] font-semibold text-card tracking-wide">
                {bg.label}
              </span>
            </button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );

  const renderWallet = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Your connected Solana wallet address is stored here for on-chain features.</p>
        {(profile as any)?.wallet_address ? (
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono bg-muted px-3 py-2 rounded-lg flex-1 truncate">
              {(profile as any).wallet_address}
            </code>
            <Button variant="outline" size="sm" onClick={async () => {
              await supabase.from("profiles").update({ wallet_address: null } as any).eq("user_id", user!.id);
              queryClient.invalidateQueries({ queryKey: ["my-profile"] });
              toast.success("Wallet disconnected");
            }}>Disconnect</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No wallet connected. Connect your wallet using the button in the header to link it to your profile.</p>
        )}
      </div>

      <Separator />

      <ClaimLimitsControl />
    </div>
  );

  const renderShipping = () => (
    <form onSubmit={(e) => { e.preventDefault(); updateShipping.mutate(); }} className="space-y-4">
      <p className="text-xs text-muted-foreground mb-2">Used for physical product deliveries from the marketplace</p>
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
  );

  const renderNotifications = () => {
    const allOff = !notifMessages && !notifInquiries && !notifPurchases && !notifReviews;
    const setAll = (on: boolean) => {
      setNotifMessages(on); setNotifInquiries(on); setNotifPurchases(on); setNotifReviews(on);
      // Persist immediately — no save button needed for toggles.
      supabase.from("profiles").update({
        email_notif_messages: on,
        email_notif_inquiries: on,
        email_notif_purchases: on,
        email_notif_reviews: on,
      } as any).eq("user_id", user!.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
        toast.success(on ? "All emails on" : "All emails paused");
      });
    };
    const persist = (patch: Record<string, boolean>) => {
      supabase.from("profiles").update(patch as any).eq("user_id", user!.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      });
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Pause all email</p>
            <p className="text-xs text-muted-foreground">Master switch — flips every email off in one tap.</p>
          </div>
          <Switch checked={allOff} onCheckedChange={(checked) => setAll(!checked)} />
        </div>
        {[
          { label: "New Messages",  desc: "When someone sends you a message",            value: notifMessages,  set: setNotifMessages,  col: "email_notif_messages" },
          { label: "Inquiries",     desc: "When you receive a new inquiry on a listing", value: notifInquiries, set: setNotifInquiries, col: "email_notif_inquiries" },
          { label: "Purchases",     desc: "When someone buys your listing",              value: notifPurchases, set: setNotifPurchases, col: "email_notif_purchases" },
          { label: "Reviews",       desc: "When someone leaves a review",                value: notifReviews,   set: setNotifReviews,   col: "email_notif_reviews" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={item.value}
              onCheckedChange={(v) => { item.set(v); persist({ [item.col]: v }); }}
            />
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground pt-1">Changes save automatically.</p>
      </div>
    );
  };

  const renderSecurity = () => (
    <div className="space-y-8">
      {/* Change email */}
      <form onSubmit={(e) => { e.preventDefault(); changeEmail.mutate(); }} className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Email address</p>
          <p className="text-xs text-muted-foreground">
            Currently <span className="font-mono">{user?.email}</span>. We'll send a confirmation
            link to both addresses before the change takes effect.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@email.com"
            className="sm:max-w-sm"
          />
          <Button type="submit" variant="outline" disabled={changeEmail.isPending || !newEmail.trim()}>
            {changeEmail.isPending ? "Sending…" : "Update email"}
          </Button>
        </div>
      </form>

      <Separator />

      {/* Change password */}
      <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Password</p>
          <p className="text-xs text-muted-foreground">Choose a strong password — at least 6 characters.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
          </div>
        </div>
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );

  const renderAccount = () => (
    <div className="space-y-5">
      {/* Appearance — moved out of the top bar (v8.7) */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Appearance</p>
          <p className="text-xs text-muted-foreground">Switch between light and dark mode.</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
      </div>
      <Separator />
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
          <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete Account
          </Button>
        </div>
      </div>
    </div>
  );

  const renderProvenance = () => (
    <div className="space-y-6">
      {/* Top: status of any pending verification requests (only shows when present) */}
      <MyVerificationRequests />

      {/* Verified IP vault — collapsed by default to keep this surface short.
          Open to manage / hash / anchor your works. */}
      <details className="group rounded-xl border border-border/60 bg-muted/20 overflow-hidden" open>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Your Verified IP vault
          </span>
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 text-muted-foreground" />
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-border/40">
          <WorksPage embedded />
        </div>
      </details>

      {/* Developer tools — collapsed by default so the page stays focused.
          Only relevant for users who deploy their own Launchpad program. */}
      <details className="group rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Developer tools — Launchpad IDL
          </span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Advanced. Paste a deployed Anchor IDL to switch the Launchpad to
            real on-chain trading instead of the simulation.
          </p>
          <LaunchpadIdlVersions />
          <LaunchpadIdlSettings />
        </div>
      </details>
    </div>
  );

  const { data: verifData } = useArtistVerification(user?.id);
  const renderVerification = () => {
    const status = verifData?.status ?? "none";
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Verified Artist</p>
            <p className="text-xs text-muted-foreground">
              Identity verification unlocks Verified IP, coin launches, paid services, and paid Spaces.
            </p>
          </div>
          {status === "verified" ? (
            <VerifiedArtistBadge status="verified" size="md" />
          ) : (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{status}</span>
          )}
        </div>
        <Link
          to="/settings/verification"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {status === "verified"
            ? "View submission"
            : status === "pending"
            ? "View pending review"
            : "Start verification"}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>

        {/* Investor signal — why verification matters + how it's coming along */}
        {user && (
          <div className="pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Investor signal
            </p>
            <CreatorReadinessCard creatorId={user.id} />
          </div>
        )}
      </div>
    );
  };

  const sectionRenderers: Record<SectionId, () => JSX.Element> = {
    profile: () => (
      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs mb-5">
          <TabsTrigger value="basics" className="gap-1.5"><IdCard className="h-3.5 w-3.5" /> Basics</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="basics" className="space-y-6 mt-0">
          {renderAvatar()}
          <Separator />
          {renderProfile()}
        </TabsContent>
        <TabsContent value="appearance" className="mt-0">
          {renderBanner()}
        </TabsContent>
      </Tabs>
    ),
    wallet: renderWallet,
    provenance: () => (
      <div className="space-y-8">
        {renderVerification()}
        <Separator />
        {renderProvenance()}
      </div>
    ),
    shipping: renderShipping,
    calendar: () => <IcsImportCard />,
    notifications: renderNotifications,
    security: renderSecurity,
    account: renderAccount,
  };

  const activeItem = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, profile, and preferences</p>
        <p className="text-xs text-muted-foreground mt-0.5">Signed in as {user?.email}</p>
      </div>

      <div className="flex gap-6">
        {/* Sub-nav (desktop sidebar + mobile pills) — uses the shared
            `resolveNavLink` resolver so active styling matches the dock
            and header. Active section is read from the URL hash. */}
        <SettingsSubNav sections={SECTIONS} defaultId="profile" />

        {/* Content */}
        <div className="flex-1 min-w-0 md:pt-0 pt-12">
          <div className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-5">
              <activeItem.icon className="h-5 w-5 text-primary" />
              {activeItem.label}
            </h2>
            {sectionRenderers[activeSection]()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
