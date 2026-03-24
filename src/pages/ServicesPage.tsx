import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Music,
  Palette,
  Camera,
  Video,
  Sparkles,
  Coins,
  DollarSign,
  Info,
  ShoppingCart,
  CalendarDays,
  CreditCard,
  Clock,
  Headphones,
  Mic,
  PenTool,
  Clapperboard,
  ImageIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; gradient: string }> = {
  audio: {
    label: "Audio",
    icon: Headphones,
    color: "hsl(280, 60%, 55%)",
    gradient: "linear-gradient(135deg, hsl(280, 60%, 55%), hsl(310, 50%, 65%))",
  },
  design: {
    label: "Design",
    icon: PenTool,
    color: "hsl(175, 60%, 45%)",
    gradient: "linear-gradient(135deg, hsl(175, 60%, 45%), hsl(190, 50%, 55%))",
  },
  video: {
    label: "Video",
    icon: Clapperboard,
    color: "hsl(340, 70%, 55%)",
    gradient: "linear-gradient(135deg, hsl(340, 70%, 55%), hsl(10, 70%, 60%))",
  },
  photo: {
    label: "Photo",
    icon: ImageIcon,
    color: "hsl(35, 90%, 50%)",
    gradient: "linear-gradient(135deg, hsl(35, 90%, 50%), hsl(45, 80%, 55%))",
  },
};

const ServicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [payMode, setPayMode] = useState<"credits" | "fiat">("credits");
  const [cardProcessing, setCardProcessing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: services, isLoading } = useQuery({
    queryKey: ["rhozeland-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("credits_cost", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Group services by category
  const grouped = (services ?? []).reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  const categoryOrder = ["audio", "design", "video", "photo"];
  const sortedCategories = categoryOrder.filter((c) => grouped[c]);
  const visibleCategories = activeCategory === "all" ? sortedCategories : sortedCategories.filter((c) => c === activeCategory);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Studio Services
          </h1>
          <p className="text-muted-foreground mt-1 max-w-lg">
            We help creators, artists, and brands turn ideas into real growth with custom content, production, and strategic deliverables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-card border border-border px-5 py-2.5 shadow-sm">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">
              {userCredits?.balance ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
          <Link to="/credits">
            <Button size="sm" variant="outline" className="rounded-full">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Get Credits
            </Button>
          </Link>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Not sure where to start?</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Book a free strategy call and we'll help you plan your next creative project.</p>
        </div>
        <Link to="/calendar">
          <Button className="rounded-full shrink-0">
            <CalendarDays className="mr-1.5 h-4 w-4" /> Book a Strategy Call
          </Button>
        </Link>
      </div>

      {/* Category filter tabs */}
      {!isLoading && sortedCategories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-foreground text-background shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            All
          </button>
          {sortedCategories.map((catKey) => {
            const meta = CATEGORY_META[catKey] || { label: catKey, icon: Sparkles, color: "hsl(var(--primary))", gradient: "" };
            const CatIcon = meta.icon;
            const isActive = activeCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setActiveCategory(catKey)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "text-white shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
                style={isActive ? { background: meta.gradient } : undefined}
              >
                <CatIcon className="h-3.5 w-3.5" />
                {meta.label}
                <span className={`text-xs ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                  {grouped[catKey].length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-28 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No services available yet.</p>
        </div>
      )}

      {/* Category sections — studio menu board */}
      {visibleCategories.map((catKey, catIndex) => {
        const meta = CATEGORY_META[catKey] || {
          label: catKey,
          icon: Sparkles,
          color: "hsl(var(--primary))",
          gradient: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
        };
        const CatIcon = meta.icon;
        const items = grouped[catKey];

        return (
          <motion.section
            key={catKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.08 }}
          >
            {/* Category header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md"
                style={{ background: meta.gradient }}
              >
                <CatIcon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
                {meta.label}
              </h2>
              <div
                className="flex-1 h-[2px] rounded-full ml-2"
                style={{ background: `linear-gradient(to right, ${meta.color}, transparent)` }}
              />
            </div>

            {/* Service items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((service: any, i: number) => (
                <motion.button
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIndex * 0.08 + i * 0.03 }}
                  onClick={() => { setSelectedService(service); setPayMode("credits"); }}
                  className="group relative text-left rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-transparent hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{
                    borderTopColor: meta.color,
                    borderTopWidth: "3px",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground leading-snug text-[15px]">
                        {service.title}
                      </h3>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {service.description}
                        </p>
                      )}
                    </div>

                    {/* Credit badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <div
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white text-xs font-bold shadow-sm"
                        style={{ background: meta.gradient }}
                      >
                        <Coins className="h-3 w-3" />
                        {service.credits_cost} cr
                      </div>
                    </div>
                  </div>

                  {/* Footer meta */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      up to {service.duration_hours}h
                    </span>
                    {service.non_member_rate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        ${service.non_member_rate} card
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        );
      })}

      {/* Service detail dialog */}
      <Dialog
        open={!!selectedService}
        onOpenChange={(open) => {
          if (!open) { setSelectedService(null); setPayMode("credits"); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedService && (() => {
            const meta = CATEGORY_META[selectedService.category] || CATEGORY_META.audio;
            return (
              <>
                {/* Color bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-t-lg"
                  style={{ background: meta.gradient }}
                />

                <DialogHeader className="pt-2">
                  <DialogTitle className="font-display text-xl tracking-tight">
                    {selectedService.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <Badge
                    className="capitalize text-white border-0"
                    style={{ background: meta.color }}
                  >
                    {selectedService.category}
                  </Badge>

                  {selectedService.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedService.description}
                    </p>
                  )}

                  {/* Pricing toggle cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPayMode("credits")}
                      className={`rounded-xl p-4 text-center transition-all border-2 ${
                        payMode === "credits"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 font-display text-2xl font-bold" style={{ color: meta.color }}>
                        <Coins className="h-5 w-5" />
                        {selectedService.credits_cost}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        credits · up to {selectedService.duration_hours}h
                      </p>
                    </button>

                    <button
                      onClick={() => setPayMode("fiat")}
                      className={`rounded-xl p-4 text-center transition-all border-2 ${
                        payMode === "fiat"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className="font-display text-2xl font-bold text-foreground">
                        ${selectedService.non_member_rate ?? "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">pay with card</p>
                    </button>
                  </div>

                  {/* Session info */}
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      This session unlocks up to <strong className="text-foreground">{selectedService.duration_hours} hours</strong> of studio time. Drag on the calendar to claim your slot.
                    </p>
                  </div>

                  {selectedService.revisions_info && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Revisions: </span>
                        {selectedService.revisions_info}
                      </p>
                    </div>
                  )}

                  {/* Credits path */}
                  {payMode === "credits" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setSelectedService(null);
                          navigate(`/bookings?service=${selectedService.id}`);
                        }}
                      >
                        <CalendarDays className="mr-1.5 h-4 w-4" />
                        Book on Calendar
                      </Button>
                      <Link to="/credits">
                        <Button variant="outline">
                          <Coins className="mr-1.5 h-4 w-4" />
                          Get Credits
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Fiat path */}
                  {payMode === "fiat" && selectedService.non_member_rate && (
                    <>
                      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
                        <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Pay <strong className="text-foreground">${selectedService.non_member_rate}</strong> with card, then pick your time on the calendar.
                        </p>
                      </div>
                      <SquareCardForm
                        amount={selectedService.non_member_rate}
                        disabled={cardProcessing}
                        onTokenize={async (token) => {
                          setCardProcessing(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("square-payment", {
                              body: {
                                amount_cents: Math.round(selectedService.non_member_rate * 100),
                                currency: "USD",
                                description: `Rhozeland: ${selectedService.title}`,
                                source_id: token,
                                location_id: SQUARE_LOCATION_ID,
                              },
                            });
                            if (error) throw error;
                            if (!data?.success) throw new Error(data?.error || "Payment failed");
                            toast.success("Payment successful! Redirecting to calendar...");
                            const serviceId = selectedService.id;
                            setSelectedService(null);
                            setPayMode("credits");
                            navigate(`/bookings?service=${serviceId}`);
                          } catch (err: any) {
                            toast.error(err.message || "Payment failed");
                          } finally {
                            setCardProcessing(false);
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;
