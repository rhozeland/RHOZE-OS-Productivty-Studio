/**
 * ProjectBoardCanvas — a whiteboard for each project's Board tab.
 *
 * Features:
 *  - Pan (space-drag or middle-mouse / right-drag), zoom (+/− buttons + ctrl/⌘ wheel)
 *  - Drag, resize, rotate any item (deliverables + sticky notes + drawings)
 *  - Sticky notes (color picker, inline text)
 *  - Freehand pen (draws SVG path; persists as a 'drawing' element)
 *  - Background removal on images ("Cutout") using @imgly/background-removal
 *  - Shared across the whole project team
 *  - Read-only when the viewer can't manage the project
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  MousePointer2,
  Pencil,
  StickyNote,
  Image as ImageIcon,
  Scissors,
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  Loader2,
  X,
  Hand,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Deliverable {
  id: string;
  title: string | null;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  board_x: number | null;
  board_y: number | null;
  board_width: number | null;
  board_height: number | null;
  board_rotation: number | null;
  board_z: number | null;
  bg_removed: boolean | null;
}

interface BoardElement {
  id: string;
  kind: "note" | "drawing" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  color: string | null;
  payload: any;
}

type Tool = "select" | "pan" | "pen" | "note";

interface Props {
  projectId: string;
  canManage: boolean;
  onAdd: () => void;
}

const NOTE_COLORS = ["#FEF3C7", "#FCE7F3", "#DBEAFE", "#DCFCE7", "#FED7AA", "#E9D5FF"];
const PEN_COLORS = ["#1F2937", "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

const ProjectBoardCanvas = ({ projectId, canManage, onAdd }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [spaceDown, setSpaceDown] = useState(false);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cuttingId, setCuttingId] = useState<string | null>(null);

  // ───── data ─────
  const { data: deliverables } = useQuery({
    queryKey: ["project-deliverables", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_deliverables")
        .select("id,title,file_url,file_name,mime_type,board_x,board_y,board_width,board_height,board_rotation,board_z,bg_removed")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data as any[]).filter((d) => d.file_url) as Deliverable[];
    },
  });

  const { data: elements } = useQuery({
    queryKey: ["project-board-elements", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_board_elements" as any)
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data as any[]) as BoardElement[];
    },
  });

  // realtime sync
  useEffect(() => {
    const ch = supabase
      .channel(`board-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_board_elements", filter: `project_id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ["project-board-elements", projectId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_deliverables", filter: `project_id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, qc]);

  // ───── derived: place legacy (positionless) deliverables in a starter grid ─────
  const positioned = useMemo(() => {
    if (!deliverables) return [] as Deliverable[];
    return deliverables.map((d, i) => {
      if (d.board_x != null && d.board_y != null) return d;
      const col = i % 4;
      const row = Math.floor(i / 4);
      return {
        ...d,
        board_x: 40 + col * 260,
        board_y: 40 + row * 240,
        board_width: d.board_width ?? 240,
        board_height: d.board_height ?? 200,
        board_rotation: d.board_rotation ?? 0,
        board_z: d.board_z ?? 0,
      };
    });
  }, [deliverables]);

  // ───── keyboard ─────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !["INPUT","TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && canManage && !["INPUT","TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
          deleteSelected();
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setTool("select");
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, canManage]);

  // ───── mutations ─────
  const patchDeliverable = async (id: string, patch: Partial<Deliverable>) => {
    await supabase.from("project_deliverables").update(patch as any).eq("id", id);
  };
  const patchElement = async (id: string, patch: Partial<BoardElement>) => {
    await supabase.from("project_board_elements" as any).update(patch as any).eq("id", id);
  };
  const deleteDeliverable = async (id: string) => {
    const { error } = await supabase.from("project_deliverables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
  };
  const deleteElement = async (id: string) => {
    const { error } = await supabase.from("project_board_elements" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["project-board-elements", projectId] });
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const isElement = elements?.some((e) => e.id === selectedId);
    if (isElement) deleteElement(selectedId);
    else deleteDeliverable(selectedId);
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, elements]);

  const addElement = async (el: Omit<BoardElement, "id" | "z">) => {
    if (!user) return;
    const { error } = await supabase.from("project_board_elements" as any).insert({
      project_id: projectId,
      created_by: user.id,
      kind: el.kind,
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height),
      rotation: el.rotation,
      color: el.color,
      payload: el.payload,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["project-board-elements", projectId] });
  };

  // ───── pan / zoom ─────
  const screenToWorld = (sx: number, sy: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: (sx - rect.left - pan.x) / zoom, y: (sy - rect.top - pan.y) / zoom };
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    const isPan = tool === "pan" || spaceDown || e.button === 1 || e.button === 2;
    if (isPan) {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const start = { ...pan };
      const move = (ev: MouseEvent) => setPan({ x: start.x + (ev.clientX - startX), y: start.y + (ev.clientY - startY) });
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      return;
    }
    if (tool === "note" && canManage) {
      const wp = screenToWorld(e.clientX, e.clientY);
      addElement({ kind: "note", x: wp.x - 110, y: wp.y - 90, width: 220, height: 180, rotation: 0, color: noteColor, payload: { text: "" } });
      setTool("select");
      return;
    }
    if (tool === "pen" && canManage) {
      // pen handled in onPenDown
      return;
    }
    // background click: deselect
    if ((e.target as HTMLElement).dataset?.canvasbg) setSelectedId(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((z) => Math.max(0.25, Math.min(3, z * (1 + delta))));
  };

  // ───── pen tool ─────
  const [drawing, setDrawing] = useState<{ pts: { x: number; y: number }[]; color: string; w: number } | null>(null);
  const onPenDown = (e: React.MouseEvent) => {
    if (tool !== "pen" || !canManage) return;
    e.preventDefault();
    const wp = screenToWorld(e.clientX, e.clientY);
    setDrawing({ pts: [wp], color: penColor, w: penWidth });
    const move = (ev: MouseEvent) => {
      const p = screenToWorld(ev.clientX, ev.clientY);
      setDrawing((d) => d ? { ...d, pts: [...d.pts, p] } : d);
    };
    const up = async () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setDrawing((d) => {
        if (!d || d.pts.length < 2) return null;
        const xs = d.pts.map((p) => p.x); const ys = d.pts.map((p) => p.y);
        const minX = Math.min(...xs), minY = Math.min(...ys);
        const maxX = Math.max(...xs), maxY = Math.max(...ys);
        const pad = d.w + 4;
        const w = maxX - minX + pad * 2;
        const h = maxY - minY + pad * 2;
        const rel = d.pts.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad }));
        addElement({
          kind: "drawing",
          x: minX - pad,
          y: minY - pad,
          width: Math.max(20, w),
          height: Math.max(20, h),
          rotation: 0,
          color: d.color,
          payload: { points: rel, strokeWidth: d.w },
        });
        return null;
      });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // ───── drag/resize handler factory ─────
  const beginDrag = (e: React.MouseEvent, id: string, x: number, y: number, persist: (patch: any) => void) => {
    if (!canManage || tool === "pen") return;
    e.stopPropagation();
    setSelectedId(id);
    if (tool !== "select") return;
    const startX = e.clientX, startY = e.clientY;
    let curX = x, curY = y;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      curX = x + dx; curY = y + dy;
      const node = document.getElementById(`item-${id}`);
      if (node) node.style.transform = `translate(${curX}px, ${curY}px) rotate(var(--rot, 0deg))`;
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      persist({ x: Math.round(curX), y: Math.round(curY) });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const beginResize = (e: React.MouseEvent, id: string, w: number, h: number, persist: (patch: any) => void) => {
    if (!canManage) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let curW = w, curH = h;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      curW = Math.max(80, w + dx);
      curH = Math.max(60, h + dy);
      const node = document.getElementById(`item-${id}`);
      if (node) { node.style.width = `${curW}px`; node.style.height = `${curH}px`; }
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      persist({ width: Math.round(curW), height: Math.round(curH) });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // ───── background removal ─────
  const cutoutImage = async (d: Deliverable) => {
    if (!d.file_url || !user) return;
    setCuttingId(d.id);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      toast.loading("Removing background…", { id: `cut-${d.id}` });
      const blob = await removeBackground(d.file_url);
      const file = new File([blob], `cutout-${Date.now()}.png`, { type: "image/png" });
      const path = `${user.id}/deliverables/${projectId}/cutout_${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("flow-uploads").upload(path, file, { contentType: "image/png" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      await supabase.from("project_deliverables").update({
        file_url: pub.publicUrl,
        mime_type: "image/png",
        bg_removed: true,
        content_hash: null,
      } as any).eq("id", d.id);
      qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      toast.success("Background removed", { id: `cut-${d.id}` });
    } catch (e: any) {
      toast.error("Couldn't remove background", { id: `cut-${d.id}`, description: e?.message });
    } finally {
      setCuttingId(null);
    }
  };

  // ───── render helpers ─────
  const renderDeliverable = (d: Deliverable) => {
    const mime = d.mime_type ?? "";
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");
    const isLink = mime === "text/uri-list" || (!mime && d.file_url?.startsWith("http"));
    const selected = selectedId === d.id;
    const isCutting = cuttingId === d.id;

    return (
      <div
        id={`item-${d.id}`}
        key={d.id}
        className={`absolute select-none group ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${d.bg_removed ? "" : "bg-card border border-border shadow-md rounded-xl overflow-hidden"}`}
        style={{
          transform: `translate(${d.board_x}px, ${d.board_y}px) rotate(${d.board_rotation ?? 0}deg)`,
          width: d.board_width ?? 240,
          height: d.board_height ?? 200,
          zIndex: d.board_z ?? 0,
          cursor: canManage && tool === "select" ? "grab" : "default",
        }}
        onMouseDown={(e) => beginDrag(e, d.id, d.board_x!, d.board_y!, (p) => patchDeliverable(d.id, p))}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        onClick={(e) => { e.stopPropagation(); setSelectedId(d.id); }}
      >
        {isImage && (
          <img src={d.file_url!} alt={d.title ?? ""} className="w-full h-full object-cover pointer-events-none" draggable={false} />
        )}
        {isVideo && (
          <video src={d.file_url!} className="w-full h-full object-cover pointer-events-none" muted playsInline />
        )}
        {isAudio && (
          <div className="w-full h-full p-3 flex flex-col justify-center">
            <div className="text-xs font-medium truncate mb-2">{d.title}</div>
            <audio src={d.file_url!} controls className="w-full" onMouseDown={(e) => e.stopPropagation()} />
          </div>
        )}
        {isLink && !isImage && !isVideo && !isAudio && (
          <div className="w-full h-full p-3 flex flex-col justify-center pointer-events-none">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Link</div>
            <div className="text-sm font-medium truncate mt-1">{d.title}</div>
            <div className="text-[11px] text-muted-foreground truncate mt-1">{d.file_url}</div>
            {selected && (
              <a
                href={d.file_url!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="pointer-events-auto mt-2 text-[11px] underline text-primary self-start"
              >
                Open link ↗
              </a>
            )}
          </div>
        )}
        {!isImage && !isVideo && !isAudio && !isLink && (
          <div className="w-full h-full p-3 flex flex-col justify-center">
            <div className="text-xs font-medium truncate">{d.title || d.file_name}</div>
          </div>
        )}

        {/* selection toolbar */}
        {selected && canManage && (
          <div className="absolute -top-10 left-0 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-1 py-1 z-30">
            {isImage && (
              <button
                title="Remove background"
                onClick={(e) => { e.stopPropagation(); cutoutImage(d); }}
                disabled={isCutting}
                className="h-7 w-7 grid place-items-center rounded hover:bg-muted disabled:opacity-50"
              >
                {isCutting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              title="Delete"
              onClick={(e) => { e.stopPropagation(); deleteDeliverable(d.id); setSelectedId(null); }}
              className="h-7 w-7 grid place-items-center rounded hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* resize handle */}
        {selected && canManage && (
          <div
            onMouseDown={(e) => beginResize(e, d.id, d.board_width ?? 240, d.board_height ?? 200, (p) => patchDeliverable(d.id, p))}
            className="absolute -right-1.5 -bottom-1.5 h-4 w-4 rounded-sm bg-primary border-2 border-background cursor-se-resize z-30"
          />
        )}
      </div>
    );
  };

  const renderElement = (el: BoardElement) => {
    const selected = selectedId === el.id;
    return (
      <div
        id={`item-${el.id}`}
        key={el.id}
        className={`absolute select-none ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        style={{
          transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
          width: el.width,
          height: el.height,
          zIndex: el.z,
          cursor: canManage && tool === "select" ? "grab" : "default",
        }}
        onMouseDown={(e) => beginDrag(e, el.id, el.x, el.y, (p) => patchElement(el.id, p))}
        onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
      >
        {el.kind === "note" && (
          <NoteBody
            color={el.color ?? "#FEF3C7"}
            text={el.payload?.text ?? ""}
            editable={canManage}
            onChange={(text) => patchElement(el.id, { payload: { ...el.payload, text } } as any)}
          />
        )}
        {el.kind === "drawing" && (
          <svg className="w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${el.width} ${el.height}`} preserveAspectRatio="none">
            <polyline
              points={(el.payload?.points ?? []).map((p: any) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={el.color ?? "#1F2937"}
              strokeWidth={el.payload?.strokeWidth ?? 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {selected && canManage && (
          <>
            <div className="absolute -top-10 left-0 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-1 py-1 z-30">
              <button
                title="Delete"
                onClick={(e) => { e.stopPropagation(); deleteElement(el.id); setSelectedId(null); }}
                className="h-7 w-7 grid place-items-center rounded hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              onMouseDown={(e) => beginResize(e, el.id, el.width, el.height, (p) => patchElement(el.id, p))}
              className="absolute -right-1.5 -bottom-1.5 h-4 w-4 rounded-sm bg-primary border-2 border-background cursor-se-resize z-30"
            />
          </>
        )}
      </div>
    );
  };

  // ───── render ─────
  const cursor =
    tool === "pan" || spaceDown ? "grab" :
    tool === "pen" ? "crosshair" :
    tool === "note" ? "copy" : "default";

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl border border-border bg-[radial-gradient(circle,_hsl(var(--muted-foreground)/0.15)_1px,_transparent_1px)] bg-[length:24px_24px] overflow-hidden"
      style={{ height: "min(78vh, 820px)", cursor }}
      onMouseDown={(e) => { onCanvasMouseDown(e); onPenDown(e); }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={onWheel}
    >
      {/* world */}
      <div
        data-canvasbg="true"
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        onMouseDown={(e) => { if ((e.target as HTMLElement).dataset.canvasbg) setSelectedId(null); }}
      >
        {positioned.map(renderDeliverable)}
        {(elements ?? []).map(renderElement)}

        {drawing && (
          <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: 1, height: 1 }}>
            <polyline
              points={drawing.pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={drawing.color}
              strokeWidth={drawing.w}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* toolbar */}
      {canManage && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/95 backdrop-blur border border-border rounded-full shadow-xl px-2 py-1.5 z-40">
          <ToolBtn icon={MousePointer2} label="Select" active={tool === "select"} onClick={() => setTool("select")} />
          <ToolBtn icon={Hand} label="Pan" active={tool === "pan"} onClick={() => setTool("pan")} />
          <div className="relative">
            <ToolBtn icon={Pencil} label="Pen" active={tool === "pen"} onClick={() => setTool("pen")} />
            {tool === "pen" && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5">
                {PEN_COLORS.map((c) => (
                  <button key={c} onClick={() => setPenColor(c)} className={`h-5 w-5 rounded-full border-2 ${penColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
                <div className="h-5 w-px bg-border mx-1" />
                {[2, 4, 8].map((w) => (
                  <button key={w} onClick={() => setPenWidth(w)} className={`h-5 w-5 grid place-items-center rounded-full ${penWidth === w ? "bg-muted" : ""}`}>
                    <div className="rounded-full bg-foreground" style={{ width: w, height: w }} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <ToolBtn icon={StickyNote} label="Sticky note" active={tool === "note"} onClick={() => setTool("note")} />
            {tool === "note" && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5">
                {NOTE_COLORS.map((c) => (
                  <button key={c} onClick={() => setNoteColor(c)} className={`h-5 w-5 rounded-full border-2 ${noteColor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            )}
          </div>
          <ToolBtn icon={ImageIcon} label="Add file" onClick={onAdd} />
          <div className="h-6 w-px bg-border mx-1" />
          <ToolBtn icon={Minus} label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} />
          <span className="text-[11px] tabular-nums w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <ToolBtn icon={Plus} label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} />
          <ToolBtn icon={RotateCcw} label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} />
        </div>
      )}

      {/* empty state */}
      {positioned.length === 0 && (elements?.length ?? 0) === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="mx-auto h-14 w-14 rounded-full border-2 border-dashed border-border grid place-items-center mb-3">
              <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-base font-medium">A blank whiteboard, all yours</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Add a file, drop a sticky note, or scribble an idea. Drag to move, corner-handle to resize.</p>
            {canManage && (
              <Button size="sm" variant="outline" className="mt-3" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add file</Button>
            )}
          </div>
        </div>
      )}

      {/* hint */}
      <div className="absolute top-3 right-3 text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-md border border-border">
        Hold Space to pan · ⌘/Ctrl + scroll to zoom
      </div>
    </div>
  );
};

const ToolBtn = ({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick: () => void }) => (
  <button
    title={label}
    onClick={onClick}
    className={`h-9 w-9 grid place-items-center rounded-full transition-colors ${active ? "bg-foreground text-background" : "hover:bg-muted text-foreground"}`}
  >
    <Icon className="h-4 w-4" />
  </button>
);

const NoteBody = ({ color, text, editable, onChange }: { color: string; text: string; editable: boolean; onChange: (t: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  useEffect(() => { setDraft(text); }, [text]);
  return (
    <div
      className="w-full h-full p-3 shadow-md rounded-md"
      style={{ background: color }}
      onDoubleClick={(e) => { e.stopPropagation(); if (editable) setEditing(true); }}
    >
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft !== text) onChange(draft); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent outline-none resize-none text-sm text-foreground"
          placeholder="Type a note…"
        />
      ) : (
        <div className="w-full h-full whitespace-pre-wrap break-words text-sm text-foreground/90 overflow-hidden">
          {text || <span className="text-foreground/40">Double-click to edit</span>}
        </div>
      )}
    </div>
  );
};

export default ProjectBoardCanvas;
