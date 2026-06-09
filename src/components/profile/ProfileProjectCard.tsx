/**
 * ProfileProjectCard — editorial card used on profile Projects tab.
 * Visual mirrors the reference upload: tall image-style header with a
 * status pill in the top-left, then a white footer block carrying title,
 * description, partnership chips, and an arrow CTA button.
 */
import { ArrowUpRight, Sparkles, Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Collaborator {
  user_id: string;
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
}

interface Props {
  project: {
    id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    cover_color?: string | null;
    cover_image_url?: string | null;
    intake_tier?: string | null;
  };
  collaborators?: Collaborator[];
  onOpen: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}

const statusLabel = (s?: string | null) => {
  if (!s) return "Active";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
};

export default function ProfileProjectCard({ project, collaborators = [], onOpen, canDelete, onDelete }: Props) {
  const accent = project.cover_color || "#7c3aed";
  const bg = `radial-gradient(120% 80% at 20% 0%, ${accent}cc 0%, ${accent}55 45%, #0a0a0a 100%)`;
  const isBacked = project.intake_tier === "concierge";
  const collabPreview = collaborators.slice(0, 3);
  const extra = Math.max(0, collaborators.length - collabPreview.length);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full text-left overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5"
    >
      {/* Image / cover */}
      <div className="relative h-56 w-full bg-muted" style={project.cover_image_url ? undefined : { background: bg }}>
        {project.cover_image_url && (
          <img src={project.cover_image_url} alt={project.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* status pill top-left */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {statusLabel(project.status)}
          </span>
        </div>

        {/* partnership chips top-right */}
        {(isBacked || collabPreview.length > 0) && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {isBacked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-black shadow-sm">
                <Sparkles className="h-3 w-3" /> Backed by Rhozeland
              </span>
            )}
            {collabPreview.length > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-sm">
                <div className="flex -space-x-1.5">
                  {collabPreview.map((c) => (
                    <div
                      key={c.user_id}
                      title={c.display_name || c.username || ""}
                      className="h-5 w-5 rounded-full border border-white bg-muted overflow-hidden"
                    >
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-[8px] font-bold text-muted-foreground">
                          {(c.display_name || c.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {extra > 0 && (
                  <span className="text-[10px] font-semibold text-black">+{extra}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer card */}
      <div className="relative -mt-8 mx-3 mb-3 rounded-2xl bg-card border border-border/50 p-4 flex items-start gap-3 shadow-md">
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold text-foreground line-clamp-2 leading-snug">
            {project.title}
          </p>
          {project.description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
          {collaborators.length > 0 && !isBacked && (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              with {collabPreview.map((c) => c.display_name || c.username || "creator").join(", ")}
              {extra > 0 ? ` +${extra}` : ""}
            </p>
          )}
        </div>
        <div
          className={cn(
            "shrink-0 h-9 w-9 rounded-xl bg-foreground text-background grid place-items-center transition-transform group-hover:rotate-12",
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
