/**
 * CanvasCard — polymorphic renderer for a canvas node.
 *
 * Handles drag (freeform x/y within its lane), shift-click multi-select,
 * hover controls, and inline editing for sticky notes.
 */
import { useRef, useState } from "react";
import { Music4, Image as ImageIcon, StickyNote, Milestone, FileText, Trash2, GripVertical } from "lucide-react";
import type { CanvasCard as CanvasCardT } from "@/hooks/useCanvasCards";

interface Props {
  card: CanvasCardT;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onCommitMove: (id: string, x: number, y: number) => void;
  onEditPayload: (id: string, patch: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onDragStartCard: (id: string, e: React.DragEvent) => void;
}

const KIND_META: Record<string, { Icon: any; label: string; tint: string }> = {
  media:       { Icon: Music4,       label: "Media",       tint: "text-rose-500" },
  milestone:   { Icon: Milestone,    label: "Milestone",   tint: "text-fuchsia-500" },
  moodboard:   { Icon: ImageIcon,    label: "Moodboard",   tint: "text-amber-500" },
  sticky:      { Icon: StickyNote,   label: "Note",        tint: "text-teal-500" },
  contract:    { Icon: FileText,     label: "Contract",    tint: "text-violet-500" },
  deliverable: { Icon: FileText,     label: "Deliverable", tint: "text-sky-500" },
};

export const CanvasCard = ({
  card, selected, onSelect, onMove, onCommitMove,
  onEditPayload, onDelete, onDragStartCard,
}: Props) => {
  const meta = KIND_META[card.kind];
  const Icon = meta.Icon;
  const ref = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [editing, setEditing] = useState(false);

  const onMouseDownHandle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(card.id, e.shiftKey);
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: card.x, oy: card.y };
    const move = (ev: MouseEvent) => {
      if (!dragOrigin.current) return;
      const dx = ev.clientX - dragOrigin.current.mx;
      const dy = ev.clientY - dragOrigin.current.my;
      onMove(card.id, dragOrigin.current.ox + dx, dragOrigin.current.oy + dy);
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (dragOrigin.current) {
        const dx = ev.clientX - dragOrigin.current.mx;
        const dy = ev.clientY - dragOrigin.current.my;
        onCommitMove(card.id, dragOrigin.current.ox + dx, dragOrigin.current.oy + dy);
      }
      dragOrigin.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => onDragStartCard(card.id, e)}
      onClick={(e) => { e.stopPropagation(); onSelect(card.id, e.shiftKey); }}
      className={`group absolute rounded-xl border bg-card shadow-sm transition-all select-none ${
        selected ? "border-foreground ring-2 ring-foreground/20 shadow-md" : "border-border/70 hover:border-foreground/40"
      }`}
      style={{ left: card.x, top: card.y, width: card.w, minHeight: card.h }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/60">
        <button
          type="button"
          onMouseDown={onMouseDownHandle}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          aria-label="Drag"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Icon className={`h-3.5 w-3.5 ${meta.tint}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex-1">{meta.label}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          aria-label="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="p-2.5 text-sm">
        {card.kind === "media" && (
          <div className="space-y-1.5">
            {card.payload.thumbnail_url && (
              <img src={card.payload.thumbnail_url} alt="" className="w-full h-24 object-cover rounded-md" />
            )}
            {!card.payload.thumbnail_url && card.payload.mime?.startsWith("audio/") && (
              <div className="w-full h-16 rounded-md bg-gradient-to-br from-rose-500/20 via-fuchsia-500/20 to-amber-500/20 flex items-center justify-center">
                <Music4 className="h-6 w-6 text-foreground/60" />
              </div>
            )}
            <p className="text-xs text-foreground truncate">{card.payload.name ?? "Untitled"}</p>
            {card.payload.url && card.payload.mime?.startsWith("audio/") && (
              <audio src={card.payload.url} controls className="w-full h-8" />
            )}
          </div>
        )}

        {card.kind === "sticky" && (
          editing ? (
            <textarea
              autoFocus
              defaultValue={card.payload.text ?? ""}
              onBlur={(e) => { onEditPayload(card.id, { text: e.target.value }); setEditing(false); }}
              className="w-full min-h-[80px] resize-none bg-transparent text-sm focus:outline-none"
            />
          ) : (
            <p
              className="text-sm text-foreground whitespace-pre-wrap cursor-text min-h-[60px]"
              onDoubleClick={() => setEditing(true)}
            >
              {card.payload.text || <span className="text-muted-foreground/60">Double-click to edit</span>}
            </p>
          )
        )}

        {card.kind === "moodboard" && (
          card.payload.url ? (
            <img src={card.payload.url} alt="" className="w-full rounded-md object-cover" />
          ) : (
            <div className="h-20 rounded-md border border-dashed border-border grid place-items-center text-xs text-muted-foreground">
              No image
            </div>
          )
        )}

        {card.kind === "milestone" && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{card.payload.title ?? "Milestone"}</p>
            {card.payload.phase && (
              <span className="inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {String(card.payload.phase).replace(/_/g, " ")}
              </span>
            )}
            {card.payload.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-3">{card.payload.description}</p>
            )}
          </div>
        )}

        {(card.kind === "contract" || card.kind === "deliverable") && (
          <div className="text-xs text-muted-foreground">
            {card.payload.title ?? meta.label} — link me from the workspace.
          </div>
        )}
      </div>
    </div>
  );
};
