import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Award, Building, Star, Users, Heart, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ICON_MAP: Record<string, any> = {
  building: Building,
  star: Star,
  users: Users,
  heart: Heart,
  "check-circle": CheckCircle,
  award: Award,
};

interface ProfileBadgesProps {
  userId: string;
  compact?: boolean;
}

const ProfileBadges = ({ userId, compact = false }: ProfileBadgesProps) => {
  const { data: badges } = useQuery({
    queryKey: ["user-badges-display", userId],
    queryFn: async () => {
      const { data: userBadges } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId);
      if (!userBadges || userBadges.length === 0) return [];

      const badgeIds = userBadges.map((ub: any) => ub.badge_id);
      const { data: badgeDefs } = await supabase
        .from("badges")
        .select("*")
        .in("id", badgeIds)
        .order("sort_order");
      return (badgeDefs as any[]) || [];
    },
    enabled: !!userId,
  });

  if (!badges || badges.length === 0) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {badges.map((badge: any) => {
            const IconComp = ICON_MAP[badge.icon] || Award;
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: badge.color + "20" }}
                  >
                    <IconComp className="h-3 w-3" style={{ color: badge.color }} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-semibold">{badge.label}</p>
                  {badge.description && <p className="text-muted-foreground">{badge.description}</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge: any) => {
        const IconComp = ICON_MAP[badge.icon] || Award;
        return (
          <div
            key={badge.id}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: badge.color }}
          >
            <IconComp className="h-3 w-3" />
            {badge.label}
          </div>
        );
      })}
    </div>
  );
};

export default ProfileBadges;
