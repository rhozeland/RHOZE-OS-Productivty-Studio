import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Camera, Check, Copy, Music4, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const POPULAR_CITIES = [
  "Toronto", "New York", "London", "Los Angeles", "Lagos", "Montreal", "Vancouver",
];

const ROLES = [
  { id: "musician", label: "Musician", emoji: "🎤" },
  { id: "producer", label: "Producer", emoji: "🎛️" },
  { id: "engineer", label: "Engineer/Mixer", emoji: "🎚️" },
  { id: "visual", label: "Visual (video/photo)", emoji: "🎥" },
  { id: "promoter", label: "Promoter/Manager", emoji: "📣" },
];

const SOCIALS = [
  { id: "spotify", label: "Spotify", col: "spotify_url" },
  { id: "soundcloud", label: "SoundCloud", col: "soundcloud_url" },
  { id: "instagram", label: "Instagram", col: "instagram_url" },
  { id: "bandcamp", label: "Bandcamp", col: "bandcamp_url" },
  { id: "twitter", label: "X / Twitter", col: "twitter_url" },
] as const;

const BIO_MAX = 160;

const MusicianOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  // Step 1
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // Step 2
  const [roles, setRoles] = useState<string[]>(["musician"]);

  // Step 3
  const [socials, setSocials] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const percent = useMemo(() => {
    let filled = 0;
    const total = 8;
    if (avatarPreview) filled++;
    if (displayName.trim()) filled++;
    if (city) filled++;
    if (bio.trim()) filled++;
    if (roles.length > 0) filled++;
    if (step >= 1) filled++;
    if (step >= 2) filled++;
    if (step >= 3) filled++;
    return Math.round((filled / total) * 100);
  }, [avatarPreview, displayName, city, bio, roles, step]);

  const handleAvatar = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleRole = (id: string) => {
    setRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const profileUrl = useMemo(() => {
    const slug = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `rhozeland.app/${slug || "you"}`;
  }, [displayName]);

  const saveStep1 = async () => {
    if (!user) return;
    if (avatarFile) {
      const filePath = `${user.id}/avatar.png`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type || "image/png" });
      if (!error) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
        await supabase
          .from("profiles")
          .update({ avatar_url: pub.publicUrl } as any)
          .eq("user_id", user.id);
      }
    }
    await supabase
      .from("profiles")
      .update({
        ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        ...(city ? { location: city } : {}),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
      } as any)
      .eq("user_id", user.id);
  };

  const saveStep2 = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        creator_roles: roles,
        archetype: roles[0] || "musician",
      } as any)
      .eq("user_id", user.id);
  };

  const saveStep3 = async () => {
    if (!user) return;
    const patch: Record<string, any> = {};
    for (const s of SOCIALS) {
      const v = (socials[s.id] || "").trim();
      if (v) patch[s.col] = v;
    }
    if (Object.keys(patch).length === 0) return;
    await supabase.from("profiles").update(patch as any).eq("user_id", user.id);
  };

  const finish = async (dest: "studio" | "dashboard") => {
    if (!user) return;
    setSaving(true);
    try {
      await saveStep3();
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      toast.success("You're live on Rhozeland 🎉");
      navigate(dest === "studio" ? "/my-projects" : "/dashboard", { replace: true });
    } catch (err: any) {
      console.error(err);
      navigate("/dashboard", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 0) await saveStep1();
    if (step === 1) await saveStep2();
    if (step === 2) await saveStep3();
    setStep((s) => Math.min(3, s + 1));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      {/* Progress bar */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-20 w-[min(90vw,420px)]">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span>Step {step + 1} of 4</span>
          <span>{percent}% complete</span>
        </div>
        <Progress value={percent} className="h-1.5" />
      </div>

      <div className="relative z-10 w-full max-w-3xl mt-12">
        <AnimatePresence mode="wait">
          {/* STEP 1 — Profile */}
          {step === 0 && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8"
            >
              <div className="text-center mb-6">
                <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                  Set up your profile
                </h2>
                <p className="text-sm text-muted-foreground">
                  This is what fans see when they land on your page.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form side */}
                <div className="space-y-5">
                  {/* Avatar */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Profile photo
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-20 h-20 rounded-full border border-border/60 overflow-hidden bg-muted/40 shrink-0">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-background transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAvatar(f);
                          }}
                        />
                        {avatarPreview ? "Change photo" : "Upload photo"}
                      </label>
                    </div>
                  </div>

                  {/* Display name */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Display name
                    </label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="What should fans call you?"
                      className="rounded-xl h-11"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      City
                    </label>
                    <Input
                      list="onboarding-cities"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Toronto, New York…"
                      className="rounded-xl h-11"
                    />
                    <datalist id="onboarding-cities">
                      {POPULAR_CITIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  {/* Bio */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Short bio
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {bio.length}/{BIO_MAX}
                      </span>
                    </div>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                      placeholder="A line or two on what you make."
                      rows={3}
                      className="rounded-xl resize-none"
                    />
                  </div>
                </div>

                {/* Live preview side */}
                <div className="hidden lg:block">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
                    Fan preview
                  </p>
                  <div className="rounded-3xl border border-border/60 bg-background/70 backdrop-blur-md p-5 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full border border-border/60 overflow-hidden bg-muted/40 shrink-0">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Music4 className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold text-foreground truncate">
                          {displayName || "Your name"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {city ? `${city} · ` : ""}Musician
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mt-4 min-h-[2.5rem]">
                      {bio || "Your bio will show up here as fans land on your profile."}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <div className="h-9 flex-1 rounded-xl bg-foreground text-background flex items-center justify-center text-xs font-semibold">
                        Back
                      </div>
                      <div className="h-9 flex-1 rounded-xl border border-border bg-background/60 flex items-center justify-center text-xs font-semibold">
                        Message
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <Button
                  onClick={next}
                  disabled={!displayName.trim()}
                  className="rounded-xl gap-1.5"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Role */}
          {step === 1 && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10 max-w-xl mx-auto"
            >
              <div className="text-center mb-6">
                <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                  What's your role?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pick all that apply. You can re-pick this in settings anytime.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ROLES.map((r) => {
                  const active = roles.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-medium transition-all ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background/60 text-foreground hover:bg-background"
                      }`}
                    >
                      <span className="text-xl leading-none">{r.emoji}</span>
                      <span className="text-xs sm:text-sm text-center">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-8">
                <Button variant="ghost" onClick={() => setStep(0)} className="rounded-xl gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  onClick={next}
                  disabled={roles.length === 0}
                  className="rounded-xl gap-1.5"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — Socials */}
          {step === 2 && (
            <motion.div
              key="socials"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10 max-w-xl mx-auto"
            >
              <div className="text-center mb-6">
                <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                  Connect your socials
                </h2>
                <p className="text-sm text-muted-foreground">
                  Optional — fans use these to follow your work everywhere.
                </p>
              </div>

              <div className="space-y-3">
                {SOCIALS.map((s) => (
                  <div key={s.id}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {s.label}
                    </label>
                    <Input
                      value={socials[s.id] || ""}
                      onChange={(e) =>
                        setSocials((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder={`Paste your ${s.label} link`}
                      className="rounded-xl h-11"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-8">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={next}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Skip for now
                  </button>
                  <Button onClick={next} className="rounded-xl gap-1.5">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4 — Live */}
          {step === 3 && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10 max-w-xl mx-auto text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/5 border border-border/50 mb-4">
                <Sparkles className="h-5 w-5 text-foreground/70" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                Your profile is live on Rhozeland.
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Share it to start building your fanbase.
              </p>

              {/* Profile preview card */}
              <div className="rounded-3xl border border-border/60 bg-background/70 backdrop-blur-md p-5 shadow-lg text-left max-w-sm mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full border border-border/60 overflow-hidden bg-muted/40 shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Music4 className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-foreground truncate">
                      {displayName || "Your name"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {city ? `${city} · ` : ""}{roles.map((r) => ROLES.find((x) => x.id === r)?.label).filter(Boolean).join(" · ") || "Musician"}
                    </p>
                  </div>
                </div>
                {bio && (
                  <p className="text-sm text-foreground/80 leading-relaxed mt-3">{bio}</p>
                )}
              </div>

              {/* Share URL */}
              <div className="mt-5 mx-auto max-w-sm flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5">
                <span className="text-xs text-foreground/80 truncate flex-1 text-left">
                  {profileUrl}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${profileUrl}`);
                    toast.success("Link copied");
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>

              <div className="mt-8 space-y-3">
                <Button
                  onClick={() => finish("studio")}
                  disabled={saving}
                  className="rounded-xl h-11 w-full font-semibold gap-1.5"
                >
                  {saving ? "Setting up…" : "Go to Studio"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => finish("dashboard")}
                  disabled={saving}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Take me to my dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MusicianOnboardingPage;
