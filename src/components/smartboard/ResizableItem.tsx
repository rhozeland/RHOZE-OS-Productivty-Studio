import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ResizableItemProps {
  itemId: string;
  initialWidth: number | null;
  initialHeight: number | null;
  editMode: boolean;
  children: React.ReactNode;
  className?: string;
}

const ResizableItem = ({
  itemId,
  initialWidth,
  initialHeight,
  editMode,
  children,
  className = "",
}: ResizableItemProps) => {
  const [size, setSize] = useState({
    width: initialWidth || 0,
    height: initialHeight || 0,
  });
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const hasCustomSize = size.width > 0 && size.height > 0;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      startRef.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
      setResizing(true);

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startRef.current.x;
        const dy = ev.clientY - startRef.current.y;
        setSize({
          width: Math.max(120, startRef.current.w + dx),
          height: Math.max(80, startRef.current.h + dy),
        });
      };

      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setResizing(false);
        const rect2 = containerRef.current?.getBoundingClientRect();
        if (rect2) {
          const w = Math.round(rect2.width);
          const h = Math.round(rect2.height);
          setSize({ width: w, height: h });
          await supabase
            .from("smartboard_items")
            .update({ item_width: w, item_height: h })
            .eq("id", itemId);
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [editMode, itemId]
  );

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={
        hasCustomSize
          ? { width: size.width, height: size.height }
          : undefined
      }
    >
      {children}
      {editMode && (
        <div
          onMouseDown={onMouseDown}
          className={`absolute right-0 bottom-0 w-5 h-5 cursor-se-resize z-20 flex items-end justify-end ${
            resizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-primary">
            <path d="M11 1v10H1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ResizableItem;
