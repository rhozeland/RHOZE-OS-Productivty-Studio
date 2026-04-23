import { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetUrl } from "@/lib/storage-utils";
import { safeFileExt } from "@/lib/file-ext";
import { buildSmartboardFilePath, SMARTBOARD_BUCKET } from "@/lib/smartboard-paths";
import UploadFileMeta from "@/components/upload/UploadFileMeta";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Plus,
  MessageSquare,
  UserPlus,
  StickyNote,
  Link2,
  ImageIcon,
  Send,
  X,
  Users,
  FileText,
  Share2,
  Edit3,
  Trash2,
  Download,
  Check,
  Video,
  AudioLines,
  ExternalLink,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import BackgroundCustomizer from "@/components/smartboard/BackgroundCustomizer";
import SmartboardBackground from "@/components/smartboard/SmartboardBackground";
import ResizableItem from "@/components/smartboard/ResizableItem";

const SmartboardDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [editMode, setEditMode] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [itemType, setItemType] = useState<"note" | "link" | "image" | "video" | "audio" | "pdf">("note");
  const [itemTitle, setItemTitle] = useState("");
  const [itemContent, setItemContent] = useState("");
  const [itemLink, setItemLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alsoPostToFlow, setAlsoPostToFlow] = useState(false);

  const { data: board } = useQuery({
    queryKey: ["smartboard", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("smartboards").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["smartboard-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_items")
        .select("*")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["smartboard-members", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("smartboard_members").select("*").eq("smartboard_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["smartboard-chat", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smartboard_messages")
        .select("*")
        .eq("smartboard_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`smartboard-chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "smartboard_messages", filter: `smartboard_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["smartboard-chat", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (board) {
      setEditTitle(board.title);
      setEditDesc(board.description || "");
    }
  }, [board]);

  const addItem = useMutation({
    mutationFn: async () => {
      let fileUrl: string | null = null;
      const uploadTypes = ["image", "video", "audio", "pdf"];

      // Upload file if provided
      if (uploadTypes.includes(itemType) && imageFile) {
        // Path layout enforced by buildSmartboardFilePath so RLS stays happy.
        const path = buildSmartboardFilePath(id!, user!.id, imageFile, { kind: "item" });
        const { url, error: uploadErrMsg } = await uploadAndGetUrl(SMARTBOARD_BUCKET, path, imageFile);
        if (uploadErrMsg) throw new Error(uploadErrMsg);
        fileUrl = url;
      }

      // For image/video/audio/pdf with URL but no file upload, use link as file_url
      if (!fileUrl && uploadTypes.includes(itemType) && itemLink) {
        fileUrl = itemLink;
      }

      const { error } = await supabase.from("smartboard_items").insert({
        smartboard_id: id!,
        user_id: user!.id,
        content_type: itemType,
        title: itemTitle || null,
        content: itemContent || null,
        link_url: itemType === "link" ? itemLink : null,
        file_url: fileUrl,
      });
      if (error) throw error;

      // Cross-post to Flow Mode if opted in
      if (alsoPostToFlow) {
        const categoryMap: Record<string, string> = {
          image: "Photo", video: "Video", audio: "Music", note: "Writing", link: "Writing", pdf: "Writing",
        };
        await supabase.from("flow_items").insert({
          user_id: user!.id,
          title: itemTitle || `From board`,
          description: itemContent || null,
          category: categoryMap[itemType] || "Photo",
          content_type: itemType === "note" || itemType === "link" ? "text" : "file",
          file_url: fileUrl || (itemType === "link" ? itemLink : null),
          link_url: itemType === "link" ? itemLink : null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard-items", id] });
      if (alsoPostToFlow) {
        queryClient.invalidateQueries({ queryKey: ["flow-items"] });
      }
      setAddOpen(false);
      setItemTitle("");
      setItemContent("");
      setItemLink("");
      setImageFile(null);
      setAlsoPostToFlow(false);
      toast.success(alsoPostToFlow ? "Added to board & Flow Mode!" : "Item added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("smartboard_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["smartboard-items", id] }),
  });

  const updateBoard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboards").update({
        title: editTitle,
        description: editDesc || null,
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard", id] });
      setAboutOpen(false);
      toast.success("Board updated!");
    },
  });

  const sendChat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("smartboard_messages").insert({
        smartboard_id: id!,
        user_id: user!.id,
        content: chatMsg,
      });
      if (error) throw error;
    },
    onSuccess: () => setChatMsg(""),
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", `%${inviteEmail}%`)
        .limit(1);
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) throw new Error("User not found");
      const { error } = await supabase.from("smartboard_members").insert({
        smartboard_id: id!,
        user_id: profiles[0].user_id,
        role: inviteRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartboard-members", id] });
      setInviteOpen(false);
      setInviteEmail("");
      toast.success("Member invited!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOwner = board?.user_id === user?.id;

  if (!board) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const getContentIcon = (type: string) => {
    switch (type) {
      case "image": return <ImageIcon className="h-3.5 w-3.5 text-primary" />;
      case "link": return <Link2 className="h-3.5 w-3.5 text-primary" />;
      case "video": return <Video className="h-3.5 w-3.5 text-primary" />;
      case "audio": return <AudioLines className="h-3.5 w-3.5 text-primary" />;
      default: return <StickyNote className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/smartboards">
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground flex-1 text-center md:text-left">
              {editMode ? "Edit Mode" : board.title}
            </h1>
          </div>

          {/* Action strip */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setAboutOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="About"
            >
              <FileText className="h-5 w-5" />
            </button>
            <button
              onClick={async () => {
                if (!board.is_public) {
                  await supabase.from("smartboards").update({ is_public: true }).eq("id", id!);
                  queryClient.invalidateQueries({ queryKey: ["smartboard", id] });
                }
                const url = `${window.location.origin}/boards/${id}`;
                navigator.clipboard.writeText(url);
                toast.success(board.is_public ? "Share link copied!" : "Board made public & link copied!");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copy share link"
            >
              <Share2 className="h-5 w-5" />
            </button>
            {isOwner && (
              <BackgroundCustomizer
                boardId={id!}
                currentColor={board.background_color}
                currentUrl={board.background_url}
                currentBlur={board.background_blur ?? 0}
                currentOpacity={board.background_opacity ?? 100}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ["smartboard", id] })}
              />
            )}
            {isOwner && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={`transition-colors ${editMode ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Edit"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
            <button className="text-muted-foreground hover:text-foreground transition-colors" title="Download">
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {members && members.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{members.length + 1}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full text-xs">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (inviteEmail.trim()) inviteMember.mutate(); }} className="space-y-4">
                  <Input placeholder="Search by display name..." value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="w-full rounded-full">Send Invite</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add to Board</DialogTitle></DialogHeader>
              {/* Content type tabs */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(["note", "link", "image", "video", "audio", "pdf"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={itemType === type ? "default" : "outline"}
                    size="sm"
                    className="rounded-full capitalize"
                    onClick={() => { setItemType(type); setImageFile(null); setItemLink(""); }}
                  >
                    {type === "note" && <StickyNote className="mr-1 h-4 w-4" />}
                    {type === "link" && <Link2 className="mr-1 h-4 w-4" />}
                    {type === "image" && <ImageIcon className="mr-1 h-4 w-4" />}
                    {type === "video" && <Video className="mr-1 h-4 w-4" />}
                    {type === "audio" && <AudioLines className="mr-1 h-4 w-4" />}
                    {type === "pdf" && <FileText className="mr-1 h-4 w-4" />}
                    {type}
                  </Button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addItem.mutate(); }} className="space-y-4">
                <Input placeholder="Title (optional)" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} />

                {itemType === "note" && (
                  <Textarea placeholder="Write your note..." value={itemContent} onChange={(e) => setItemContent(e.target.value)} rows={4} />
                )}
                {itemType === "link" && (
                  <>
                    <Input placeholder="https://..." value={itemLink} onChange={(e) => setItemLink(e.target.value)} />
                    <Textarea placeholder="Description (optional)" value={itemContent} onChange={(e) => setItemContent(e.target.value)} rows={2} />
                  </>
                )}
                {(itemType === "image" || itemType === "video" || itemType === "audio" || itemType === "pdf") && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        itemType === "image" ? "image/*" :
                        itemType === "video" ? "video/*" :
                        itemType === "audio" ? "audio/*" :
                        ".pdf"
                      }
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      {imageFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span className="text-sm text-foreground truncate max-w-[200px]">{imageFile.name}</span>
                        </div>
                      ) : (
                        <>
                          {itemType === "image" && <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />}
                          {itemType === "video" && <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />}
                          {itemType === "audio" && <AudioLines className="h-8 w-8 text-muted-foreground mx-auto mb-2" />}
                          {itemType === "pdf" && <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />}
                          <p className="text-sm text-muted-foreground">
                            {itemType === "image" ? "Upload image" :
                             itemType === "video" ? "Upload video" :
                             itemType === "audio" ? "Upload audio" :
                             "Upload PDF"}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {itemType === "image" ? "JPG, PNG, WEBP up to 20MB" :
                             itemType === "video" ? "MP4, MOV, WEBM up to 20MB" :
                             itemType === "audio" ? "MP3, WAV, FLAC up to 20MB" :
                             "PDF files up to 20MB"}
                          </p>
                        </>
                      )}
                    </div>
                    {imageFile && id && user && (
                      <UploadFileMeta
                        file={imageFile}
                        path={buildSmartboardFilePath(id, user.id, imageFile, { kind: "item" })}
                      />
                    )}
                    <div className="mt-3">
                      <Input
                        placeholder={
                          itemType === "image" ? "Or paste image URL" :
                          itemType === "video" ? "Or paste YouTube / Vimeo link" :
                          itemType === "audio" ? "Or paste Spotify / SoundCloud link" :
                          "Or paste link to PDF"
                        }
                        value={itemLink}
                        onChange={(e) => setItemLink(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="also-flow"
                    checked={alsoPostToFlow}
                    onCheckedChange={(v) => setAlsoPostToFlow(!!v)}
                  />
                  <Label htmlFor="also-flow" className="text-sm text-muted-foreground cursor-pointer">
                    Also share to Flow Mode
                  </Label>
                </div>
                <Button type="submit" className="w-full rounded-full">Add to Board</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <SmartboardBackground
        color={board.background_color}
        url={board.background_url}
        blur={board.background_blur ?? 0}
        opacity={board.background_opacity ?? 100}
        className="rounded-2xl p-4"
      >
      <div className={`grid gap-4 ${chatOpen ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Multi-modal masonry grid */}
        <div className={chatOpen ? "lg:col-span-2" : ""}>
          {(!items || items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-muted/20 border border-border">
              <StickyNote className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-foreground font-medium">This board is empty</p>
              <p className="text-sm text-muted-foreground mt-1">Add notes, links, images, or media to get started</p>
            </div>
          ) : (
            <div className={editMode ? "flex flex-wrap gap-3" : "columns-2 md:columns-3 gap-3 space-y-3"}>
              <AnimatePresence>
                {items.map((item, i) => {
                  const isImage = item.content_type === "image" && item.file_url;
                  const isVideo = item.content_type === "video" && item.file_url;
                  const isAudio = item.content_type === "audio" && item.file_url;
                  const isPdf = item.content_type === "pdf" && item.file_url;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.03 }}
                      className={editMode ? "" : "break-inside-avoid"}
                    >
                      <ResizableItem
                        itemId={item.id}
                        initialWidth={item.item_width}
                        initialHeight={item.item_height}
                        editMode={editMode}
                        className="group relative rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-md transition-all"
                      >
                      {isImage && (
                        <div className="relative h-full">
                          <img src={item.file_url!} alt={item.title || "Image"} className="w-full h-full object-cover" loading="lazy" />
                          {item.title && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/60 to-transparent p-3">
                              <span className="text-card text-sm font-medium">{item.title}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isVideo && (
                        <div className="relative">
                          <video src={item.file_url!} className="w-full" controls preload="metadata" />
                          {item.title && (
                            <div className="p-3 pt-1">
                              <span className="text-sm font-medium text-foreground">{item.title}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isAudio && (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <AudioLines className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Audio</span>
                              {item.title && <h3 className="font-display font-semibold text-foreground text-sm truncate">{item.title}</h3>}
                            </div>
                          </div>
                          <audio src={item.file_url!} controls className="w-full h-10" preload="metadata" />
                        </div>
                      )}

                      {isPdf && (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-destructive" />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PDF</span>
                          </div>
                          {item.title && <h3 className="font-display font-semibold text-foreground text-sm mb-2">{item.title}</h3>}
                          <a href={item.file_url!} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> Open PDF
                          </a>
                        </div>
                      )}

                      {!isImage && !isVideo && !isAudio && !isPdf && (
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getContentIcon(item.content_type)}
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              {item.content_type}
                            </span>
                          </div>
                          {item.title && (
                            <h3 className="font-display font-semibold text-foreground text-sm leading-snug mb-1">
                              {item.title}
                            </h3>
                          )}
                          {item.content && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{item.content}</p>
                          )}
                          {item.link_url && (
                            <a href={item.link_url} target="_blank" rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline truncate">
                              <ExternalLink className="h-3 w-3 flex-shrink-0" /> {item.link_url}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Edit mode overlay */}
                      {editMode && item.user_id === user?.id && (
                        <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <button
                            onClick={() => deleteItem.mutate(item.id)}
                            className="h-9 w-9 rounded-full bg-card shadow-md flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors pointer-events-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Normal delete button */}
                      {!editMode && item.user_id === user?.id && (
                        <button
                          onClick={() => deleteItem.mutate(item.id)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      </ResizableItem>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-card border border-border flex flex-col overflow-hidden lg:col-span-1"
            style={{ height: "60vh" }}
          >
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-sm">Board Chat</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setChatOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages?.map((msg: any) => (
                <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5">
                    {msg.user_id === user?.id ? "You" : "Member"}
                  </span>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    msg.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (chatMsg.trim()) sendChat.mutate(); }}
              className="border-t border-border p-3 flex gap-2"
            >
              <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 rounded-full" />
              <Button type="submit" size="icon" className="rounded-full" disabled={!chatMsg.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </div>
      </SmartboardBackground>

      {/* About / Edit Info overlay */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-sm">
          <div className="text-center mb-4">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">ABOUT</span>
          </div>
          {isOwner ? (
            <form onSubmit={(e) => { e.preventDefault(); updateBoard.mutate(); }} className="space-y-4">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-display font-bold text-lg"
                placeholder="Title of concept"
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Items</span>
                <span>{items?.length || 0}</span>
              </div>
              <Button type="submit" className="w-full rounded-full">Confirm</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <h2 className="font-display font-bold text-lg text-foreground">{board.title}</h2>
              {board.description && <p className="text-sm text-muted-foreground">{board.description}</p>}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Items</span>
                <span>{items?.length || 0}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit mode confirm bar */}
      {editMode && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-xl rounded-full px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tap items to remove</span>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => setEditMode(false)}>
            Confirm
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default SmartboardDetailPage;
