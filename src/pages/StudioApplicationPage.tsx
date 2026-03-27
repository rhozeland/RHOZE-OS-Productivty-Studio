import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const StudioApplicationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studio_name: "",
    description: "",
    location: "",
    website_url: "",
    portfolio_url: "",
    contact_email: user?.email || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("studio_applications").insert({
        user_id: user.id,
        studio_name: form.studio_name,
        description: form.description,
        location: form.location,
        website_url: form.website_url || null,
        portfolio_url: form.portfolio_url || null,
        contact_email: form.contact_email,
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
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Application Received!</h2>
          <p className="text-muted-foreground mb-6">
            We'll review your studio application and get back to you. Once approved, you'll be able to set up your listing, add photos, set rates, and start accepting bookings.
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
    <div className="max-w-lg mx-auto space-y-6">
      <Link to="/studios" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Studios
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">List Your Studio</h1>
            <p className="text-sm text-muted-foreground">Apply to join the Rhozeland studio marketplace</p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5 surface-card p-6">
        <div className="space-y-1.5">
          <Label>Studio Name *</Label>
          <Input
            required
            placeholder="e.g. Sunset Sound Studios"
            value={form.studio_name}
            onChange={(e) => setForm({ ...form, studio_name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Description *</Label>
          <Textarea
            required
            placeholder="Tell us about your space — what type of studio, what equipment you have, what makes it unique..."
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Location *</Label>
          <Input
            required
            placeholder="City, State/Province"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              placeholder="https://..."
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Portfolio</Label>
            <Input
              placeholder="https://..."
              value={form.portfolio_url}
              onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Contact Email *</Label>
          <Input
            required
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full rounded-full h-11 gap-2">
          <Send className="h-4 w-4" />
          {loading ? "Submitting..." : "Submit Application"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Applications are reviewed within 48 hours. We'll notify you once approved.
        </p>
      </form>
    </div>
  );
};

export default StudioApplicationPage;
