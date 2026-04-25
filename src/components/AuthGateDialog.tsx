import { useState, createContext, useContext, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

interface AuthGateContextType {
  requireAuth: (message?: string) => boolean;
}

const AuthGateContext = createContext<AuthGateContextType>({
  requireAuth: () => false,
});

export const useAuthGate = () => useContext(AuthGateContext);

export const AuthGateProvider = ({
  isAuthenticated,
  children,
}: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Preserve current location so user lands back here after signing in
  const goToAuth = () => {
    setOpen(false);
    const here = `${location.pathname}${location.search}${location.hash}`;
    const redirectParam = here && here !== "/auth" ? `?redirect=${encodeURIComponent(here)}` : "";
    navigate(`/auth${redirectParam}`);
  };

  const requireAuth = useCallback(
    (msg?: string) => {
      if (isAuthenticated) return true;
      // Default copy speaks to outcomes (joining a community of creators),
      // not to tokens or wallets — addresses the most common signup objection.
      setMessage(msg || "Create a free account to use this — takes 10 seconds with Google.");
      setOpen(true);
      return false;
    },
    [isAuthenticated]
  );

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-2 mx-auto"
            >
              <LogIn className="h-7 w-7 text-primary" />
            </motion.div>
            <DialogTitle className="text-lg">Quick — sign up first</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {message}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={goToAuth} className="w-full gap-2">
              <UserPlus className="h-4 w-4" /> Sign up free
            </Button>
            <Button variant="outline" onClick={goToAuth} className="w-full gap-2">
              <LogIn className="h-4 w-4" /> I already have an account
            </Button>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Free forever · No credit card · No spam
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AuthGateContext.Provider>
  );
};
