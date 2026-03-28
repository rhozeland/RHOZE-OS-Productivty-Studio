import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Building2,
  FolderKanban,
  Palette,
} from "lucide-react";

const dockItems = [
  { icon: Building2, label: "Studios", path: "/studios" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Palette, label: "Hub", path: "/creators" },
];

const DockBar = () => {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-4 inset-x-0 mx-auto w-fit z-50"
    >
      <div className="flex items-center gap-1 px-4 py-2.5 bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-lg shadow-foreground/5">
        {dockItems.map((item) => {
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative group"
            >
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-lg transition-colors duration-150 gap-0.5",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-body font-medium leading-none">
                  {item.label}
                </span>
                {showBadge && (
                  <span className="absolute top-0.5 right-1 h-2 w-2 rounded-full bg-accent" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DockBar;