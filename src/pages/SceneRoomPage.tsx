import RoomHero from "@/components/rooms/RoomHero";
import DiscoverPage from "@/pages/DiscoverPage";

/**
 * THE SCENE — Room 1 (Social / Discovery).
 * Renders the existing Discover experience under the Today room hero.
 */
const SceneRoomPage = () => {
  return (
    <div className="space-y-4">
      <RoomHero
        variant="today"
        eyebrow="Today"
        title="What's happening now."
        subtitle="The pulse of Rhozeland — fresh works, live events, creators on the rise."
      />
      <DiscoverPage />
    </div>
  );
};

export default SceneRoomPage;
