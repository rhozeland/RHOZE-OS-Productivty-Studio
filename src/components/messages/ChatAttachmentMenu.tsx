import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetUrl } from "@/lib/storage-utils";
import { safeFileExt } from "@/lib/file-ext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Paperclip,
  LayoutGrid,
  User,
  ShoppingBag,
  Search,
  Upload,
  Loader2,
  Link2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ShareType = "menu" | "smartboards" | "profiles" | "listings" | "link";

interface ChatAttachmentMenuProps {
  onSendMessage: (content: string) => void;
  onSendQuote?: () => void;
  disabled?: boolean;
}

const ChatAttachmentMenu = ({ onSendMessage, onSendQuote, disabled }: ChatAttachmentMenuProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ShareType>("menu");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smartboards
  const { data: smartboards } = useQuery({
    queryKey: ["share-smartboards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboards")
        .select("id, title, description, cover_color")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && open && view === "smartboards",
  });

  // Profiles
  const { data: profiles } = useQuery({
    queryKey: ["share-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, headline")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && view === "profiles",
  });

  // Listings
  const { data: listings } = useQuery({
    queryKey: ["share-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, category, listing_type, credits_price, user_id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open && view === "listings",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 20MB)`);
          continue;
        }
        const fileExt = safeFileExt(file);
        const filePath = `chat/${user.id}/${crypto.randomUUID()}.${fileExt}`;
        const { url: signedUrl, error: uploadErrMsg } = await uploadAndGetUrl("smartboard-files", filePath, file);
        if (uploadErrMsg) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Send as a rich file message
        const fileMsg = `[FILE:${JSON.stringify({
          name: file.name,
          url: signedUrl,
          type: file.type,
          size: file.size,
        })}]`;
        onSendMessage(fileMsg);
      }
      toast.success("File shared!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOpen(false);
      setView("menu");
    }
  };

  const shareSmartboard = (board: any) => {
    const msg = `[SMARTBOARD:${JSON.stringify({
      id: board.id,
      title: board.title,
      description: board.description,
      color: board.cover_color,
    })}]`;
    onSendMessage(msg);
    setOpen(false);
    setView("menu");
  };

  const shareProfile = (profile: any) => {
    const msg = `[PROFILE:${JSON.stringify({
      user_id: profile.user_id,
      name: profile.display_name,
      avatar: profile.avatar_url,
      headline: profile.headline,
    })}]`;
    onSendMessage(msg);
    setOpen(false);
    setView("menu");
  };

  const shareListing = (listing: any) => {
    const msg = `[LISTING:${JSON.stringify({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      type: listing.listing_type,
      price: listing.credits_price,
    })}]`;
    onSendMessage(msg);
    setOpen(false);
    setView("menu");
  };

  const filterBySearch = (items: any[] | undefined, fields: string[]) => {
    if (!items) return [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => item[f]?.toString().toLowerCase().includes(q))
    );
  };

  const shareLink = () => {
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const msg = `[LINK:${JSON.stringify({
      url,
      title: linkTitle.trim() || url,
    })}]`;
    onSendMessage(msg);
    setLinkUrl("");
    setLinkTitle("");
    setOpen(false);
    setView("menu");
  };

  const menuItems = [
    { icon: Paperclip, label: "Upload File", description: "Share images, docs, audio", action: () => fileInputRef.current?.click() },
    { icon: Link2, label: "Share Link", description: "Google Drive, Dropbox, any URL", action: () => setView("link") },
    { icon: FileText, label: "Send Quote", description: "Create a project quote", action: () => { setOpen(false); setView("menu"); onSendQuote?.(); } },
    { icon: LayoutGrid, label: "Smartboard", description: "Share a smartboard", action: () => setView("smartboards") },
    { icon: User, label: "Creator Profile", description: "Share a creator's profile", action: () => setView("profiles") },
    { icon: ShoppingBag, label: "Listing", description: "Share a marketplace listing", action: () => setView("listings") },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.zip"
        onChange={handleFileUpload}
        className="hidden"
      />
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setView("menu"); setSearch(""); setLinkUrl(""); setLinkTitle(""); } }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || uploading}
            className="shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start" side="top" sideOffset={8}>
          {view === "menu" && (
            <div className="p-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {view === "smartboards" && (
            <div>
              <div className="flex items-center gap-2 p-2 border-b border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView("menu")}>
                  <span className="text-lg">←</span>
                </Button>
                <p className="text-sm font-medium text-foreground">Share Smartboard</p>
              </div>
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-52">
                {filterBySearch(smartboards, ["title"]).length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">No smartboards found</p>
                ) : (
                  filterBySearch(smartboards, ["title"]).map((board) => (
                    <button
                      key={board.id}
                      onClick={() => shareSmartboard(board)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-md shrink-0" style={{ background: board.cover_color || "hsl(var(--muted))" }} />
                      <div className="min-w-0 text-left">
                        <p className="text-sm text-foreground truncate">{board.title}</p>
                        {board.description && <p className="text-[10px] text-muted-foreground truncate">{board.description}</p>}
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {view === "profiles" && (
            <div>
              <div className="flex items-center gap-2 p-2 border-b border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView("menu")}>
                  <span className="text-lg">←</span>
                </Button>
                <p className="text-sm font-medium text-foreground">Share Profile</p>
              </div>
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-52">
                {filterBySearch(profiles, ["display_name", "headline"]).length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">No profiles found</p>
                ) : (
                  filterBySearch(profiles, ["display_name", "headline"]).map((profile) => (
                    <button
                      key={profile.user_id}
                      onClick={() => shareProfile(profile)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm text-foreground truncate">{profile.display_name || "Creator"}</p>
                        {profile.headline && <p className="text-[10px] text-muted-foreground truncate">{profile.headline}</p>}
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          )}

          {view === "link" && (
            <div>
              <div className="flex items-center gap-2 p-2 border-b border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView("menu")}>
                  <span className="text-lg">←</span>
                </Button>
                <p className="text-sm font-medium text-foreground">Share a Link</p>
              </div>
              <div className="p-3 space-y-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste URL (Google Drive, Dropbox, etc.)"
                  className="h-8 text-sm"
                  autoFocus
                />
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!linkUrl.trim()}
                  onClick={shareLink}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Share Link
                </Button>
              </div>
            </div>
          )}

          {view === "listings" && (
            <div>
              <div className="flex items-center gap-2 p-2 border-b border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView("menu")}>
                  <span className="text-lg">←</span>
                </Button>
                <p className="text-sm font-medium text-foreground">Share Listing</p>
              </div>
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-52">
                {filterBySearch(listings, ["title", "category"]).length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">No listings found</p>
                ) : (
                  filterBySearch(listings, ["title", "category"]).map((listing) => (
                    <button
                      key={listing.id}
                      onClick={() => shareListing(listing)}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="h-4 w-4 text-accent-foreground" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm text-foreground truncate">{listing.title}</p>
                        <p className="text-[10px] text-muted-foreground">{listing.category} · {listing.listing_type}{listing.credits_price ? ` · ${listing.credits_price} credits` : ""}</p>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
};

export default ChatAttachmentMenu;
