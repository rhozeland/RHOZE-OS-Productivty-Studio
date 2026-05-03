/**
 * ProjectTools — minimal Smartboards picker pinned to the project roadmap.
 *
 * Drop Rooms moved to <DropRoomLauncher /> in the Progress Overview header
 * so the roadmap stays focused on stages + smartboards.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Palette, Link2, X } from "lucide-react";

interface Props {
  projectId: string;
  projectTitle: string;
  smartboardDetails?: any[] | null;
  onLinkSmartboard?: () => void;
  onUnlinkSmartboard?: (id: string) => void;
}

const ProjectTools = ({ projectId, smartboardDetails, onLinkSmartboard, onUnlinkSmartboard }: Props) => {
  const boards = smartboardDetails ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h4 className="font-display text-sm font-semibold">Smartboards</h4>
          {boards.length > 0 && (
            <span className="text-[10px] text-muted-foreground">· {boards.length}</span>
          )}
        </div>
        {onLinkSmartboard && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-7 gap-1 text-xs"
            onClick={onLinkSmartboard}
          >
            <Link2 className="h-3 w-3" /> Link
          </Button>
        )}
      </div>
      {boards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {boards.map((b: any, i: number) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group relative"
            >
              <Link
                to={`/smartboards/${b.id}?from=project:${projectId}`}
                state={{ backTo: `/projects/${projectId}`, backLabel: "Back to project" }}
                className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border bg-background hover:border-primary/40 transition-colors"
              >
                <span
                  className="h-5 w-5 rounded-full shrink-0"
                  style={{ background: b.cover_color || "hsl(var(--muted))" }}
                />
                <span className="text-xs font-medium text-foreground line-clamp-1 max-w-[160px]">
                  {b.title}
                </span>
              </Link>
              {onUnlinkSmartboard && (
                <button
                  onClick={() => onUnlinkSmartboard(b.id)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition"
                  aria-label="Unlink smartboard"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pin a moodboard to give the team something visual to riff on.
        </p>
      )}
    </section>
  );
};

export default ProjectTools;

