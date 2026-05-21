import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveRole, ROLE_HOME, type ActiveRole } from "@/hooks/useActiveRole";

/**
 * Compact Fan / Creator toggle pill that sits between the Rhozeland logo
 * and the EXPLORE label in the sidebar. Tapping the inactive side flips the
 * persisted role and navigates to that role's home — no full page reload.
 *
 * Hidden when the sidebar is collapsed (icon-only) to keep the rail clean.
 */
const SidebarRoleSwitcher = ({ collapsed }: { collapsed: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useActiveRole();

  if (!user || collapsed) return null;

  const switchTo = (next: ActiveRole) => {
    if (next === role) return;
    setRole(next);
    navigate(ROLE_HOME[next]);
  };

  return (
    <div className="px-3 pt-3 pb-1">
      <div
        role="tablist"
        aria-label="View as role"
        className="relative grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1"
      >
        {(["fan", "creator"] as ActiveRole[]).map((r) => {
          const active = role === r;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-200",
                active
                  ? "sidebar-active-gradient text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/70">
        Viewing as {role === "creator" ? "Creator" : "Fan"}
      </p>
    </div>
  );
};

export default SidebarRoleSwitcher;
