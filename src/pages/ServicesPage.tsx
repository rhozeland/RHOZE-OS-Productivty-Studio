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
  Clock,
  Coins,
  DollarSign,
  Info,
  ShoppingCart,
  CalendarDays,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";

const CATEGORIES = [
  { key: "all", label: "All Services", icon: Sparkles },
  { key: "audio", label: "Audio", icon: Music },
  { key: "design", label: "Design", icon: Palette },
  { key: "video", label: "Video", icon: Video },
  { key: "photo", label: "Photo", icon: Camera },
];

const categoryColors: Record<string, string> = {
  audio: "hsl(280, 60%, 55%)",
  design: "hsl(175, 60%, 50%)",
  video: "hsl(340, 70%, 55%)",
  photo: "hsl(35, 90%, 55%)",
};

const ServicesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [payMode, setPayMode] = useState<"credits" | "fiat">("credits");
  const [cardProcessing, setCardProcessing] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: ["rhozeland-services", activeCategory],
    queryFn: async () => {
      let query = supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("credits_cost", { ascending: true });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }

      const { data, error } = await query;
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

  const creditRatePerHour = (service: any) => {
    if (!service?.duration_hours || service.duration_hours <= 0) return service?.credits_cost ?? 0;
    return Number(service.credits_cost) / Number(service.duration_hours);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Rhozeland Services
          </h1>
          <p className="text-muted-foreground">
            Studio time, production, design & strategy — powered by credits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-foreground">
              {userCredits?.balance ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
          <Link to="/credits">
            <Button size="sm" variant="outline">
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Get Credits
            </Button>
          </Link>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Services grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="surface-card animate-pulse h-56 rounded-xl" />
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20">
          <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No services available in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service: any, i: number) => {
            const color = categoryColors[service.category] ?? "hsl(var(--primary))";
            const rate = creditRatePerHour(service);
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="surface-card group relative overflow-hidden cursor-pointer transition-all hover:shadow-md"
                onClick={() => setSelectedService(service)}
              >
                {/* Color accent */}
                <div className="h-1.5" style={{ backgroundColor: color }} />
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {service.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-primary font-display font-bold">
                      <Coins className="h-3.5 w-3.5" />
                      {Number(rate).toFixed(rate % 1 === 0 ? 0 : 1)} cr/hr
                    </div>
                  </div>

                  <h3 className="font-display font-semibold text-foreground leading-snug">
                    {service.title}
                  </h3>

                  {service.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      Drag to book any duration
                    </span>
                    {service.non_member_rate && (
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" />
                        {service.non_member_rate}/hr non-member
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Service detail dialog */}
      <Dialog open={!!selectedService} onOpenChange={(open) => { if (!open) { setSelectedService(null); setPayMode("credits"); } }}>
        <DialogContent className="sm:max-w-lg">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {selectedService.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize">
                    {selectedService.category}
                  </Badge>
                </div>

                {selectedService.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedService.description}
                  </p>
                )}

                {/* Pricing info — rate-based */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPayMode("credits")}
                    className={`rounded-xl p-4 text-center transition-all border ${
                      payMode === "credits"
                        ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
                        : "bg-muted border-border hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-primary font-display text-2xl font-bold">
                      <Coins className="h-5 w-5" />
                      {Number(creditRatePerHour(selectedService)).toFixed(
                        creditRatePerHour(selectedService) % 1 === 0 ? 0 : 1
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Credits / hour</p>
                  </button>
                  <button
                    onClick={() => setPayMode("fiat")}
                    className={`rounded-xl p-4 text-center transition-all border ${
                      payMode === "fiat"
                        ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
                        : "bg-muted border-border hover:border-primary/20"
                    }`}
                  >
                    <div className="font-display text-2xl font-bold text-foreground">
                      ${selectedService.non_member_rate ?? "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Pay with Card / hr</p>
                  </button>
                </div>

                {selectedService.revisions_info && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Revisions: </span>
                      {selectedService.revisions_info}
                    </p>
                  </div>
                )}

                {/* Credits path → calendar drag */}
                {payMode === "credits" && (
                  <>
                    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Drag across the calendar to book exactly the time you need — credits are calculated based on your selected duration.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={() => {
                        setSelectedService(null);
                        navigate(`/bookings?service=${selectedService.id}`);
                      }}>
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
                  </>
                )}

                {/* Fiat path → Square card form */}
                {payMode === "fiat" && selectedService.non_member_rate && (
                  <>
                    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Pay ${selectedService.non_member_rate}/hr with a card. After payment, you'll select your session time on the calendar.
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
                              description: `Rhozeland: ${selectedService.title} (1hr)`,
                              source_id: token,
                              location_id: SQUARE_LOCATION_ID,
                            },
                          });
                          if (error) throw error;
                          if (!data?.success) throw new Error(data?.error || "Payment failed");
                          toast.success("Payment successful! Redirecting to calendar...");
                          setSelectedService(null);
                          setPayMode("credits");
                          navigate(`/bookings?service=${selectedService.id}`);
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;
