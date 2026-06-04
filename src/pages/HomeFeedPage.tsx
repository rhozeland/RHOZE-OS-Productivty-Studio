/**
 * HomeFeedPage — `/home` (v11)
 *
 * Logged-in front door. No hero, no greeting, no marketing copy.
 * Flow Mode is embedded inline — clicking a card does NOT redirect to /flow.
 * A single compact top bar holds two gradient actions:
 *   • Start a Project · Launch a Coin
 *
 * (Discovery filters live on /discover — no duplicate filter pills here.)
 */
import { useNavigate } from "react-router-dom";
import { Rocket, Coins } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { todayGradient } from "@/lib/rhoze-gradients";

const HomeFeedPage = () => {
  const navigate = useNavigate();
  const grad = todayGradient();

  const startProject = () => {
    sessionStorage.setItem("newProjectPrefill", JSON.stringify({ open: true }));
    navigate("/messages?tab=projects&new=1");
  };

  const launchCoin = () => navigate("/why-coin");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-3 pb-12">
      {/* TOP BAR — one compact line */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={startProject}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundImage: grad.text }}
        >
          <Rocket className="h-3.5 w-3.5" />
          Start a Project
        </button>
        <button
          onClick={launchCoin}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundImage: grad.text }}
        >
          <Coins className="h-3.5 w-3.5" />
          Launch a Coin
        </button>
      </div>

      {/* FEED — Flow Mode embedded inline (no redirect to /flow) */}
      <div className="mt-4">
        <FlowModePage />
      </div>
    </div>
  );
};

export default HomeFeedPage;
