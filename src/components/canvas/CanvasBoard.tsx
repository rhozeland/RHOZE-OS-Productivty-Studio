/**
 * CanvasBoard — 4-lane structured board that hosts CanvasCards.
 * Handles OS drag-drop uploads, lane targeting, and card selection.
 */
import { useRef, useState } from "react";
import { LANES, type CanvasCard as CanvasCardT, type CanvasLane } from "@/hooks/useCanvasCards";
import { CanvasCard } from "./CanvasCard";

interface Props {
  cards: CanvasCardT[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onMovePreview: (id: string, x: number, y: number) => void;
  onCommitMove: (id: string, x: number, y: number, lane?: CanvasLane) => void;
  onEditPayload: (id: string, patch: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onDropFiles: (files: File[], lane: CanvasLane, x: number, y: number) => void;
}

const CanvasBoard = ({
  cards, selectedIds, onSelectionChange, onMovePreview, onCommitMove,
  onEditPayload, onDelete, onDropFiles,
}: Props) => {
  const [dragOverLane, setDragOverLane] = useState<CanvasLane | null>(null);
  const draggingCardId = useRef<string | null>(null);

  const handleSelect = (id: string, additive: boolean) => {
    const next = new Set(additive ? selectedIds : []);
    if (additive && selectedIds.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const clearSelection = () => onSelectionChange(new Set());

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 overflow-auto">
      {LANES.map((lane) => {
        const laneCards = cards.filter((c) => c.lane === lane.id);
        const isOver = dragOverLane === lane.id;
        return (
          <div
            key={lane.id}
            className={`relative rounded-2xl border-2 transition-colors min-h-[70vh] ${
              isOver ? "border-foreground/50 bg-muted/40" : "border-border/60 bg-muted/10"
            }`}
            onClick={clearSelection}
            onDragOver={(e) => { e.preventDefault(); setDragOverLane(lane.id); }}
            onDragLeave={() => setDragOverLane((cur) => (cur === lane.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverLane(null);
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = Math.max(8, e.clientX - rect.left - 120);
              const y = Math.max(40, e.clientY - rect.top - 40);
              const cardId = draggingCardId.current;
              if (cardId) {
                onCommitMove(cardId, x, y, lane.id);
                draggingCardId.current = null;
                return;
              }
              const files = Array.from(e.dataTransfer.files ?? []);
              if (files.length) onDropFiles(files, lane.id, x, y);
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-md border-b border-border/40 rounded-t-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{lane.label}</p>
              <span className="text-[10px] text-muted-foreground">{laneCards.length}</span>
            </div>
            <div className="relative min-h-[60vh]">
              {laneCards.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[11px] text-muted-foreground/60 italic">Drop content here</p>
                </div>
              )}
              {laneCards.map((card) => (
                <CanvasCard
                  key={card.id}
                  card={card}
                  selected={selectedIds.has(card.id)}
                  onSelect={handleSelect}
                  onMove={onMovePreview}
                  onCommitMove={(id, x, y) => onCommitMove(id, x, y)}
                  onEditPayload={onEditPayload}
                  onDelete={onDelete}
                  onDragStartCard={(id, e) => {
                    draggingCardId.current = id;
                    e.dataTransfer.setData("text/plain", id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CanvasBoard;
