/**
 * CanvasToolbar — floating top bar for the release canvas.
 *
 * Provides node creation, upload, and gallery pick.
 */
import { useRef } from "react";
import { Plus, Upload, Images, Music4, StickyNote, Milestone, Image as ImageIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CanvasKind } from "@/hooks/useCanvasCards";

interface Props {
  onAddNode: (kind: CanvasKind) => void;
  onUploadFiles: (files: File[]) => void;
  onOpenGallery: () => void;
}

const CanvasToolbar = ({ onAddNode, onUploadFiles, onOpenGallery }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur-md p-1 shadow-sm">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => onAddNode("sticky")} className="gap-2">
            <StickyNote className="h-4 w-4 text-teal-500" /> Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode("milestone")} className="gap-2">
            <Milestone className="h-4 w-4 text-fuchsia-500" /> Milestone
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode("moodboard")} className="gap-2">
            <ImageIcon className="h-4 w-4 text-amber-500" /> Moodboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddNode("media")} className="gap-2">
            <Music4 className="h-4 w-4 text-rose-500" /> Empty media
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
      >
        <Upload className="h-3.5 w-3.5" /> Upload
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onUploadFiles(files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={onOpenGallery}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
      >
        <Images className="h-3.5 w-3.5" /> Gallery
      </button>
    </div>
  );
};

export default CanvasToolbar;
