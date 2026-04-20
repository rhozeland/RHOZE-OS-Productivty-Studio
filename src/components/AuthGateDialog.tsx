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
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const requireAuth = useCallback(
    (msg?: string) => {
      if (isAuthenticated) return true;
      setMessage(msg || "Sign in to unlock this feature");
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
            <DialogTitle className="text-lg">Join Rhozeland</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {message}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={() => { setOpen(false); navigate("/auth"); }}
              className="w-full gap-2"
            >
              <UserPlus className="h-4 w-4" /> Sign Up Free
            </Button>
            <Button
              variant="outline"
              onClick={() => { setOpen(false); navigate("/auth"); }}
              className="w-full gap-2"
            >
              <LogIn className="h-4 w-4" /> I Already Have an Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthGateContext.Provider>
  );
};
