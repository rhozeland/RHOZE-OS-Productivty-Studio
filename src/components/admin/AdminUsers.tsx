import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  skills: string[] | null;
  available: boolean | null;
};

type UserCredit = {
  user_id: string;
  balance: number;
  tier: string;
};

const AdminUsers = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [credits, setCredits] = useState<Record<string, UserCredit>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: profileData }, { data: creditData }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_credits").select("user_id, balance, tier"),
      ]);

      setProfiles(profileData || []);
      const creditMap: Record<string, UserCredit> = {};
      (creditData || []).forEach((c) => { creditMap[c.user_id] = c; });
      setCredits(creditMap);
      setLoading(false);
    };

    fetch();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Users ({profiles.length})</h2>
      <div className="grid gap-3">
        {profiles.map((p) => {
          const credit = credits[p.user_id];
          return (
            <Card key={p.id} className="bg-card">
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {(p.display_name || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{p.display_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.bio || "No bio"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {credit && (
                    <>
                      <Badge variant="outline" className="text-xs">{credit.tier}</Badge>
                      <span className="text-sm font-medium text-foreground">{credit.balance} ◊</span>
                    </>
                  )}
                  <Badge variant={p.available ? "default" : "secondary"} className="text-xs">
                    {p.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {profiles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
