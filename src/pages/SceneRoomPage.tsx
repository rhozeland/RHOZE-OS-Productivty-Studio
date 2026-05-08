import DiscoverPage from "@/pages/DiscoverPage";

/**
 * THE SCENE — Room 1 (Social / Discovery).
 *
 * Front door for the vertical Stream and Flow Mode. Renders the existing
 * Discover experience (globe + featured + stream + flow toggle) under the
 * Scene banner. Existing /discover, /flow, /stream routes remain mounted.
 */
const SceneRoomPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-[0.28em] text-primary font-semibold">
          Room 1 · The Scene
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Social · Discovery
        </span>
      </div>
      <DiscoverPage />
    </div>
  );
};

export default SceneRoomPage;
