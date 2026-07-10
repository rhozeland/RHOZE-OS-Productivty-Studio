/**
 * ProjectCanvasPage — FigJam-lite workspace for a project.
 *
 * Route: /projects/:id/canvas
 *
 * 4 lanes (Ideas / In progress / Review / Released) with freeform cards.
 * Drag-drop uploads, gallery picker, AI Copilot dock.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCanvasCards, type CanvasKind, type CanvasLane } from "@/hooks/useCanvasCards";
import CanvasBoard from "@/components/canvas/CanvasBoard";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import AiCopilotDock from "@/components/canvas/AiCopilotDock";
import GalleryPickerSheet from "@/components/canvas/GalleryPickerSheet";

const BUCKET = "flow-uploads";

const ProjectCanvasPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { cards, loading, create, patch, remove, refetch } = useCanvasCards(id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("projects").select("name,title").eq("id", id).maybeSingle();
      const n = (data as any)?.name ?? (data as any)?.title ?? "Untitled release";
      setProjectName(n);
      setTitleDraft(n);
    })();
  }, [id]);

  const saveTitle = async () => {
    const next = titleDraft.trim() || "Untitled release";
    if (next === projectName) return;
    setSavingTitle(true);
    await supabase.from("projects").update({ name: next, title: next } as any).eq("id", id!);
    setProjectName(next);
    setSavingTitle(false);
  };

  const uploadOne = useCallback(async (file: File, lane: CanvasLane, x: number, y: number) => {
    if (!user || !id) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user.id}/projects/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const isImage = file.type.startsWith("image/");
    await create({
      kind: "media",
      lane,
      x,
      y,
      w: 240,
      h: isImage ? 200 : 140,
      payload: {
        url: pub.publicUrl,
        name: file.name,
        mime: file.type || `application/${ext}`,
        thumbnail_url: isImage ? pub.publicUrl : null,
      },
    });
  }, [user, id, create]);

  const onDropFiles = useCallback(async (files: File[], lane: CanvasLane, x: number, y: number) => {
    let cursor = 0;
    for (const f of files) {
      await uploadOne(f, lane, x + cursor, y);
      cursor += 20;
    }
  }, [uploadOne]);

  const onUploadFromToolbar = useCallback(async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      await uploadOne(files[i], "ideas", 24 + i * 20, 60 + i * 20);
    }
  }, [uploadOne]);

  const onAddNode = useCallback(async (kind: CanvasKind) => {
    const defaults: Record<string, any> = {
      sticky:    { text: "" },
      milestone: { title: "New milestone" },
      moodboard: {},
      media:     { name: "New media", mime: "application/octet-stream" },
    };
    await create({ kind, lane: "ideas", payload: defaults[kind] ?? {}, x: 24, y: 60 });
  }, [create]);

  const onPickFromGallery = useCallback(async (item: { url: string; name: string; mime: string; thumbnail_url?: string | null }) => {
    await create({
      kind: "media",
      lane: "ideas",
      x: 24,
      y: 60,
      payload: {
        url: item.url,
        name: item.name,
        mime: item.mime,
        thumbnail_url: item.thumbnail_url ?? null,
      },
    });
  }, [create]);

  const onCommitMove = useCallback((cid: string, x: number, y: number, lane?: CanvasLane) => {
    const patchObj: any = { x: Math.round(x), y: Math.round(y) };
    if (lane) patchObj.lane = lane;
    patch(cid, patchObj);
  }, [patch]);

  const onInsertMilestones = useCallback(async (nodes: Array<{ lane: CanvasLane; payload: Record<string, any> }>) => {
    let stagger = 0;
    for (const n of nodes) {
      await create({ kind: "milestone", lane: n.lane, x: 24 + stagger, y: 60 + stagger, payload: n.payload });
      stagger += 24;
    }
    await refetch();
  }, [create, refetch]);

  const onInsertSticky = useCallback(async (text: string) => {
    await create({ kind: "sticky", lane: "ideas", x: 24, y: 60, payload: { text } });
  }, [create]);

  const selectedCards = useMemo(() => cards.filter((c) => selectedIds.has(c.id)), [cards, selectedIds]);

  if (!id) return null;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}`)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to project"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="flex-1 min-w-0 bg-transparent font-display text-lg tracking-tight text-foreground focus:outline-none"
          placeholder="Untitled release"
        />
        {savingTitle && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <CanvasToolbar
          onAddNode={onAddNode}
          onUploadFiles={onUploadFromToolbar}
          onOpenGallery={() => setGalleryOpen(true)}
        />
      </header>

      {loading ? (
        <div className="flex-1 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <CanvasBoard
          cards={cards}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onMovePreview={(cid, x, y) => patch(cid, { x: Math.round(x), y: Math.round(y) })}
          onCommitMove={onCommitMove}
          onEditPayload={(cid, p) => patch(cid, { payload: { ...(cards.find((c) => c.id === cid)?.payload ?? {}), ...p } })}
          onDelete={remove}
          onDropFiles={onDropFiles}
        />
      )}

      <AiCopilotDock
        projectName={projectName}
        selectedCards={selectedCards}
        onInsertMilestones={onInsertMilestones}
        onInsertSticky={onInsertSticky}
      />

      <GalleryPickerSheet
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onPick={onPickFromGallery}
      />
    </div>
  );
};

export default ProjectCanvasPage;
