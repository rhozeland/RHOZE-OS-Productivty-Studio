import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Search,
  Sparkles,
  X,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import PayWithSolButton from "@/components/PayWithSolButton";
import { isValidSolanaAddress } from "@/lib/solana";

const CATEGORIES = [
  { key: "all", label: "All", icon: Sparkles, color: "hsl(var(--primary))" },
  { key: "music", label: "Music", icon: Music, color: "hsl(280, 60%, 55%)" },
  { key: "design", label: "Design", icon: Palette, color: "hsl(160, 60%, 50%)" },
  { key: "photo", label: "Photo", icon: Camera, color: "hsl(35, 90%, 55%)" },
  { key: "video", label: "Video", icon: Video, color: "hsl(340, 70%, 55%)" },
  { key: "writing", label: "Writing", icon: PenTool, color: "hsl(210, 60%, 55%)" },
];

const MarketplacePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("design");
  const [price, setPrice] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings", activeCategory, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }
      if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createListing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketplace_listings").insert({
        user_id: user!.id,
        title,
        description: description || null,
        category,
        price: price ? parseFloat(price) : null,
        contact_info: contactInfo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setCategory("design");
      setPrice("");
      setContactInfo("");
      toast.success("Listing published!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("marketplace_listings")
        .delete()
        .eq("id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      toast.success("Listing removed");
    },
  });

  const getCategoryMeta = (key: string) =>
    CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Community Marketplace
          </h1>
          <p className="text-muted-foreground">
            Find your next project — explore services from creators worldwide
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Post Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Post a Listing</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) createListing.mutate();
              }}
              className="space-y-4"
            >
              <Input
                placeholder="Listing title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Describe your service or project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">🎵 Music</SelectItem>
                    <SelectItem value="design">🎨 Design</SelectItem>
                    <SelectItem value="photo">📷 Photo</SelectItem>
                    <SelectItem value="video">🎬 Video</SelectItem>
                    <SelectItem value="writing">✍️ Writing</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Price (optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <Input
                placeholder="Contact info (email, link, etc.)"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={!title.trim() || createListing.isPending}
              >
                Publish Listing
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Category Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-card animate-pulse h-48 rounded-xl" />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-20">
          <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            {searchQuery
              ? "No listings match your search"
              : "No listings yet. Be the first to post!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {listings.map((listing: any, i: number) => {
              const catMeta = getCategoryMeta(listing.category);
              const CatIcon = catMeta.icon;
              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="surface-card group relative overflow-hidden transition-all hover:shadow-md"
                >
                  {/* Color accent bar */}
                  <div
                    className="h-1.5"
                    style={{ backgroundColor: catMeta.color }}
                  />
                  <div className="p-5 space-y-3">
                    {/* Category + Price row */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 text-xs"
                      >
                        <CatIcon className="h-3 w-3" />
                        {catMeta.label}
                      </Badge>
                      {listing.price != null && (
                        <span className="flex items-center gap-0.5 font-display font-semibold text-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          {Number(listing.price).toFixed(0)}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-display font-semibold text-foreground leading-snug line-clamp-2">
                      {listing.title}
                    </h3>

                    {/* Description */}
                    {listing.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {listing.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                      {listing.contact_info && (
                        <a
                          href={
                            listing.contact_info.includes("@")
                              ? `mailto:${listing.contact_info}`
                              : listing.contact_info.startsWith("http")
                              ? listing.contact_info
                              : `mailto:${listing.contact_info}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Contact
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Delete button for owner */}
                  {listing.user_id === user?.id && (
                    <button
                      onClick={() => deleteListing.mutate(listing.id)}
                      className="absolute right-2 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
