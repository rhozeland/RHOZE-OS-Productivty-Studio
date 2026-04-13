import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AtSign, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UsernamePrompt = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [debounced, setDebounced] = useState("");

  // Check if user has a username
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile-username-check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isLoading && profile && !(profile as any).username) {
      // Small delay so the app loads first
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, [profile, isLoading]);

  // Debounce username check
  useEffect(() => {
    const t = setTimeout(() => setDebounced(username), 400);
    return () => clearTimeout(t);
  }, [username]);

  // Check availability
  const { data: available, isFetching: checking } = useQuery({
    queryKey: ["username-available", debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_username_available", {
        _username: debounced,
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: debounced.length >= 3 && /^[a-zA-Z0-9_]+$/.test(debounced),
  });

  const isValid = username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
  const canSave = isValid && available === true && !checking;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.toLowerCase() } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Username set! 🎉");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to set username");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <AtSign className="h-5 w-5 text-primary" /> Choose Your Username
          </DialogTitle>
          <DialogDescription>
            Pick a unique handle so others can find you. This can't be easily changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="your_username"
              className="pl-8 pr-10"
              maxLength={20}
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!checking && isValid && available === true && <Check className="h-4 w-4 text-green-500" />}
              {!checking && isValid && available === false && <X className="h-4 w-4 text-red-500" />}
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className={cn(username.length >= 3 ? "text-green-600" : "")}>• 3-20 characters</p>
            <p className={cn(/^[a-zA-Z0-9_]*$/.test(username) && username.length > 0 ? "text-green-600" : "")}>• Letters, numbers, and underscores only</p>
            {isValid && available === false && (
              <p className="text-red-500 font-medium">This username is taken</p>
            )}
          </div>
          <Button
            onClick={handleSave}
            className="w-full rounded-full"
            disabled={!canSave || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Username"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UsernamePrompt;
