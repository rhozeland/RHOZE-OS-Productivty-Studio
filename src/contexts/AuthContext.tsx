import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { maybeRecordConversion } from "@/lib/guest-cta-analytics";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Track the previously-known user id so we only fire conversion
  // attribution on the actual guest → authenticated transition (not on
  // every session refresh or token rotation).
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const syncSession = (nextSession: Session | null) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      // Guest → signed-in transition: attribute any pending CTA click.
      if (nextUser && !previousUserIdRef.current) {
        maybeRecordConversion(nextUser.id);
      }
      previousUserIdRef.current = nextUser?.id ?? null;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          const isMissingRefreshToken =
            error.name === "AuthApiError" &&
            typeof error.message === "string" &&
            error.message.toLowerCase().includes("refresh token not found");

          if (isMissingRefreshToken) {
            await supabase.auth.signOut({ scope: "local" });
            syncSession(null);
            return;
          }

          throw error;
        }

        syncSession(session);
      })
      .catch(async () => {
        await supabase.auth.signOut({ scope: "local" });
        syncSession(null);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
