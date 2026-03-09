import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  X,
  Plus,
  Briefcase,
  FileText,
  Package,
  ShoppingBag,
  ImageIcon,
  Music,
  Video,
} from "lucide-react";
import { toast } from "sonner";

const LISTING_TYPES = [
  { key: "service", label: "Service", desc: "Offer your skills", icon: Briefcase },
  { key: "digital_product", label: "Digital Product", desc: "Beats, presets, templates", icon: FileText },
  { key: "physical_product", label: "Physical Product", desc: "Merch, prints, goods", icon: Package },
  { key: "project_request", label: "Project Request", desc: "Need help? Post it", icon: ShoppingBag },
];

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateListingDialog = ({ open, onOpenChange }: CreateListingDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);

  // Form
  const [listingType, setListingType] = useState("service");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("design");
  const [creditsPrice, setCreditsPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [revisions, setRevisions] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [shippingInfo, setShippingInfo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const reset = () => {
    setStep(0);
    setListingType("service");
    setTitle("");
    setDescription("");
    setCategory("design");
    setCreditsPrice("");
    setDeliveryDays("");
    setRevisions("");
    setTags([]);
    setTagInput("");
    setShippingInfo("");
    setFiles([]);
  };

  const createListing = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      setUploading(true);

      // 1. Create listing
      const { data: listing, error } = await supabase
        .from("marketplace_listings")
        .insert({
          user_id: user.id,
          title,
          description: description || null,
          category,
          listing_type: listingType,
          credits_price: creditsPrice ? parseFloat(creditsPrice) : null,
          price: creditsPrice ? parseFloat(creditsPrice) : null,
          delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
          revisions: revisions ? parseInt(revisions) : null,
          tags: tags.length > 0 ? tags : null,
          shipping_info: listingType === "physical_product" ? shippingInfo || null : null,
        })
        .select()
        .single();
      if (error) throw error;

      // 2. Upload media files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${listing.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("listing-media").upload(path, file);
        if (upErr) { toast.error(`Failed to upload ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("listing-media").getPublicUrl(path);

        // Set first image as cover
        if (i === 0 && file.type.startsWith("image")) {
          await supabase.from("marketplace_listings").update({ cover_url: urlData.publicUrl }).eq("id", listing.id);
        }

        await supabase.from("listing_media").insert({
          listing_id: listing.id,
          user_id: user.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          sort_order: i,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      onOpenChange(false);
      reset();
      toast.success("Listing published! 🎉");
      setUploading(false);
    },
    onError: (e: any) => { toast.error(e.message); setUploading(false); },
  });

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const valid = newFiles.filter((f) => f.size <= 20 * 1024 * 1024);
    if (valid.length < newFiles.length) toast.error("Some files exceed 20MB limit");
    setFiles([...files, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 0 ? "What are you posting?" : step === 1 ? "Listing Details" : "Add Media"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: Choose type */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {LISTING_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => { setListingType(t.key); setStep(1); }}
                  className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all hover:border-primary/50 hover:bg-primary/5 ${
                    listingType === t.key ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="font-display font-semibold text-sm text-foreground">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (title.trim()) setStep(2); }}
            className="space-y-4"
          >
            <Input
              placeholder="Listing title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="Describe what you're offering..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">🎵 Music</SelectItem>
                  <SelectItem value="design">🎨 Design</SelectItem>
                  <SelectItem value="photo">📷 Photo</SelectItem>
                  <SelectItem value="video">🎬 Video</SelectItem>
                  <SelectItem value="writing">✍️ Writing</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Credits price"
                type="number"
                min="0"
                value={creditsPrice}
                onChange={(e) => setCreditsPrice(e.target.value)}
              />
            </div>
            {(listingType === "service" || listingType === "project_request") && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Delivery (days)"
                  type="number"
                  min="1"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                />
                <Input
                  placeholder="Revisions included"
                  type="number"
                  min="0"
                  value={revisions}
                  onChange={(e) => setRevisions(e.target.value)}
                />
              </div>
            )}
            {listingType === "physical_product" && (
              <Input
                placeholder="Shipping info (e.g. US only, 3-5 days)"
                value={shippingInfo}
                onChange={(e) => setShippingInfo(e.target.value)}
              />
            )}

            {/* Tags */}
            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button onClick={() => setTags(tags.filter((t) => t !== tag))}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={!title.trim()}>
                Next: Add Media
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Media upload */}
        {step === 2 && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.pdf"
              className="hidden"
              onChange={handleFiles}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload images, audio, video, or PDFs</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Max 20MB per file</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      {file.type.startsWith("image") && <ImageIcon className="h-4 w-4 text-primary" />}
                      {file.type.startsWith("audio") && <Music className="h-4 w-4 text-primary" />}
                      {file.type.startsWith("video") && <Video className="h-4 w-4 text-primary" />}
                      {file.type === "application/pdf" && <FileText className="h-4 w-4 text-destructive" />}
                    </div>
                    <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => createListing.mutate()}
                disabled={uploading}
              >
                {uploading ? "Publishing..." : files.length > 0 ? "Publish with Media" : "Publish without Media"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateListingDialog;
