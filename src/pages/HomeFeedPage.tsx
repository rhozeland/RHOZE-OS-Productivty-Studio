/**
 * HomeFeedPage — `/home` (v11)
 *
 * Logged-in front door. No hero, no greeting, no marketing copy.
 * The feed (Flow Mode) is the page. Above it sits a single compact bar:
 *   • Two small gradient buttons: Start a Project · Launch a Coin
 *   • Filter pills: All · Find Creators · Opportunities · Spaces · For You
 *
 * Existing card/feed styles are kept intact — only layout + chrome changes.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { Rocket, Coins } from "lucide-react";
import CompactFlowFeed from "@/components/hub/CompactFlowFeed";
import { todayGradient } from "@/lib/rhoze-gradients";
import { cn } from "@/lib/utils";

type FilterId = "all" | "creators" | "opportunities" | "spaces" | "foryou";

const FILTERS: { id: FilterId; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/home" },
  { id: "creators", label: "Find Creators", href: "/market?kind=creators" },
  { id: "opportunities", label: "Opportunities", href: "/market?kind=listings" },
  { id: "spaces", label: "Spaces", href: "/market?kind=live" },
  { id: "foryou", label: "For You", href: "/home?tab=foryou" },
];

const HomeFeedPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grad = todayGradient();

  const activeTab = searchParams.get("tab");
  const activeId: FilterId = activeTab === "foryou" ? "foryou" : "all";

  const startProject = () => {
    // Opens NewProjectDialog via ProjectsPage prefill convention.
    sessionStorage.setItem("newProjectPrefill", JSON.stringify({ open: true }));
    navigate("/messages?tab=projects&new=1");
  };

  const launchCoin = () => navigate("/why-coin");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-3 pb-12">
      {/* TOP BAR — one compact line */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Left: two small gradient buttons */}
        <div className="flex items-center gap-2">
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

        {/* Filter pills */}
        <nav
          className="flex items-center gap-1 overflow-x-auto sm:ml-auto"
          aria-label="Feed filters"
        >
          {FILTERS.map((f) => {
            const isActive = f.id === activeId;
            return (
              <button
                key={f.id}
                onClick={() => navigate(f.href)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {f.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* FEED — Flow Mode embedded immediately, no hero, no greeting */}
      <div className="mt-4">
        <CompactFlowFeed />
      </div>
    </div>
  );
};

export default HomeFeedPage;
