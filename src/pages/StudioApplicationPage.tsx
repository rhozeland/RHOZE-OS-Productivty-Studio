import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, ArrowRight, CheckCircle, ImagePlus, X, MapPin, Mail } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STEPS = ["Photos", "Details", "Location & Contact"];

const StudioApplicationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [form, setForm] = useState({
    studio_name: "",
    description: "",
    location: "",
    contact_email: user?.email || "",
  });

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.slice(0, 5 - photos.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const photo of photos) {
      const ext = safeFileExt(photo.file);
      const path = `studio-applications/${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listing-media").upload(path, photo.file, { contentType: safeContentType(photo.file) });
      if (!error) {
        const { data } = supabase.storage.from("listing-media").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const canAdvance = () => {
    if (step === 0) return photos.length >= 1;
    if (step === 1) return form.studio_name.trim() && form.description.trim();
    if (step === 2) return form.location.trim() && form.contact_email.trim();
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const photoUrls = await uploadPhotos();

      const { error } = await supabase.from("studio_applications").insert({
        user_id: user.id,
        studio_name: form.studio_name,
        description: form.description,
        location: form.location,
        contact_email: form.contact_email,
        portfolio_url: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Application submitted! We'll review it shortly.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Application Received!</h2>
          <p className="text-muted-foreground mb-6">
            We'll review your studio application and get back to you. Once approved, you'll be able to manage your listing and start accepting bookings.
          </p>
          <Link to="/studios">
            <Button variant="outline" className="rounded-full">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Studios
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <Link to="/studios" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Studios
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">List Your Studio</h1>
          <p className="text-sm text-muted-foreground">It's easy to get started on Rhozeland</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            className="flex items-center gap-2 group"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="surface-card p-6 rounded-xl space-y-5"
        >
          {step === 0 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Add some photos of your studio</h2>
                <p className="text-sm text-muted-foreground">
                  You'll need at least 1 photo to get started. You can add up to 12. Show off your space, equipment, and vibe.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotos}
              />

              {photos.length === 0 ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors group cursor-pointer"
                >
                  <ImagePlus className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="text-center">
                    <p className="font-medium text-foreground">Upload photos</p>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden group">
                        <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                            Cover photo
                          </span>
                        )}
                      </div>
                    ))}
                    {photos.length < 12 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                      >
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Add more</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Tell guests about your studio</h2>
                <p className="text-sm text-muted-foreground">
                  Share what makes your space special — the equipment, the vibe, and what creators can expect.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Studio Name *</Label>
                <Input
                  placeholder="e.g. Sunset Sound Studios"
                  value={form.studio_name}
                  onChange={(e) => setForm({ ...form, studio_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe your space — room size, acoustics, gear available, what genres/projects it's ideal for..."
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Mention specific equipment, room dimensions, and what sets you apart.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Where's your studio located?</h2>
                <p className="text-sm text-muted-foreground">
                  Help creators find you. Your exact address won't be shared until a booking is confirmed.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Location *
                </Label>
                <Input
                  placeholder="City, State/Province"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Contact Email *
                </Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  We'll use this to communicate about your application and booking inquiries.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="rounded-full px-6"
          >
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canAdvance() || loading}
            className="rounded-full px-6"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Applications are typically reviewed within 48 hours.
      </p>
    </div>
  );
};

export default StudioApplicationPage;
