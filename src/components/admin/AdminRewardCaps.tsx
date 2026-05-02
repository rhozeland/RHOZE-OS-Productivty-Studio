/**
 * AdminRewardCaps — admin-only editor for `reward_daily_caps`.
 *
 * Two panels:
 *   1. Cap configs — edit `amount`, `per_day_cap`, `per_day_amount_cap`,
 *      `enabled`, and `description` per action_type. Admin can also add a
 *      new action row.
 *   2. Last 14 days usage — for each (action_type, day):
 *        - awarded count (rows in pending_rewards)
 *        - awarded amount sum
 *        - distinct users
 *        - "% of count cap" indicator using the *current* per_day_cap
 *      Helps spot whether caps are too tight or too loose.
 *
 * RLS: `reward_daily_caps` is admin-write / authed-read, and
 * `pending_rewards` is admin-readable, so direct table queries are fine.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, Trash2, BarChart3, Sliders } from "lucide-react";
import { format, subDays } from "date-fns";

type CapRow = {
  action_type: string;
  amount: number;
  per_day_cap: number;
  per_day_amount_cap: number | null;
  enabled: boolean;
  description: string | null;
};

type UsageRow = {
  action_type: string;
  day: string; // yyyy-MM-dd
  count: number;
  amount_sum: number;
  distinct_users: number;
  capped_users: number; // users who reached/exceeded current per_day_cap
};

const DAYS_WINDOW = 14;

const AdminRewardCaps = () => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<CapRow>>>({});
  const [newRow, setNewRow] = useState<CapRow>({
    action_type: "",
    amount: 1,
    per_day_cap: 10,
    per_day_amount_cap: 10,
    enabled: true,
    description: "",
  });

  // ---- Caps ----
  const { data: caps, isLoading: capsLoading } = useQuery({
    queryKey: ["admin-reward-caps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_daily_caps" as any)
        .select("*")
        .order("action_type");
      if (error) throw error;
      return (data ?? []) as unknown as CapRow[];
    },
  });

  // ---- Usage (last 14 days) ----
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["admin-reward-caps-usage", caps?.length],
    enabled: !!caps,
    queryFn: async () => {
      const since = subDays(new Date(), DAYS_WINDOW).toISOString();
      const { data, error } = await supabase
        .from("pending_rewards")
        .select("action_type, amount, user_id, created_at, status")
        .gte("created_at", since)
        .in("status", ["pending", "approved"])
        .limit(10000);
      if (error) throw error;

      const buckets = new Map<string, UsageRow>();
      const perUserDay = new Map<string, number>(); // key: action|day|user -> count
      for (const r of data ?? []) {
        const day = format(new Date(r.created_at as string), "yyyy-MM-dd");
        const key = `${r.action_type}|${day}`;
        const userKey = `${key}|${r.user_id}`;
        perUserDay.set(userKey, (perUserDay.get(userKey) ?? 0) + 1);
        const b = buckets.get(key) ?? {
          action_type: r.action_type as string,
          day,
          count: 0,
          amount_sum: 0,
          distinct_users: 0,
          capped_users: 0,
        };
        b.count += 1;
        b.amount_sum += Number(r.amount ?? 0);
        buckets.set(key, b);
      }

      // distinct + capped per (action|day) using per-user counts
      const userSets = new Map<string, Set<string>>();
      const cappedSets = new Map<string, Set<string>>();
      for (const [userKey, count] of perUserDay) {
        const [action_type, day, user_id] = userKey.split("|");
        const k = `${action_type}|${day}`;
        if (!userSets.has(k)) userSets.set(k, new Set());
        userSets.get(k)!.add(user_id);
        const cap = caps?.find((c) => c.action_type === action_type)?.per_day_cap;
        if (cap != null && count >= cap) {
          if (!cappedSets.has(k)) cappedSets.set(k, new Set());
          cappedSets.get(k)!.add(user_id);
        }
      }
      for (const [k, b] of buckets) {
        b.distinct_users = userSets.get(k)?.size ?? 0;
        b.capped_users = cappedSets.get(k)?.size ?? 0;
      }
      return Array.from(buckets.values()).sort(
        (a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.action_type.localeCompare(b.action_type)),
      );
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (row: CapRow) => {
      const { error } = await supabase
        .from("reward_daily_caps" as any)
        .upsert(
          {
            action_type: row.action_type,
            amount: row.amount,
            per_day_cap: row.per_day_cap,
            per_day_amount_cap: row.per_day_amount_cap,
            enabled: row.enabled,
            description: row.description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "action_type" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, row) => {
      toast.success(`Saved ${row.action_type}`);
      setDrafts((d) => {
        const { [row.action_type]: _, ...rest } = d;
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ["admin-reward-caps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (action_type: string) => {
      const { error } = await supabase
        .from("reward_daily_caps" as any)
        .delete()
        .eq("action_type", action_type);
      if (error) throw error;
    },
    onSuccess: (_d, action_type) => {
      toast.success(`Removed ${action_type}`);
      queryClient.invalidateQueries({ queryKey: ["admin-reward-caps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const merged = useMemo(() => {
    return (caps ?? []).map((c) => ({ ...c, ...(drafts[c.action_type] ?? {}) })) as CapRow[];
  }, [caps, drafts]);

  const updateDraft = (action_type: string, patch: Partial<CapRow>) =>
    setDrafts((d) => ({ ...d, [action_type]: { ...(d[action_type] ?? {}), ...patch } }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sliders className="h-4 w-4" /> Daily reward caps
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Per-action limits enforced by <code>award_engagement_reward</code>. Changes apply immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {capsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Count cap / day</th>
                    <th className="px-2 py-2">Amount cap / day</th>
                    <th className="px-2 py-2">Enabled</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((row) => {
                    const dirty = !!drafts[row.action_type];
                    return (
                      <tr key={row.action_type} className="border-b border-border/30 align-top">
                        <td className="px-2 py-2 font-mono text-xs">{row.action_type}</td>
                        <td className="px-2 py-2 w-24">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) =>
                              updateDraft(row.action_type, { amount: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <Input
                            type="number"
                            value={row.per_day_cap}
                            onChange={(e) =>
                              updateDraft(row.action_type, { per_day_cap: Number(e.target.value) })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 w-28">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.per_day_amount_cap ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              updateDraft(row.action_type, {
                                per_day_amount_cap:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={(v) => updateDraft(row.action_type, { enabled: v })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={row.description ?? ""}
                            onChange={(e) =>
                              updateDraft(row.action_type, { description: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant={dirty ? "default" : "ghost"}
                            disabled={!dirty || upsertMut.isPending}
                            onClick={() => upsertMut.mutate(row)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete cap for ${row.action_type}?`))
                                deleteMut.mutate(row.action_type);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add new */}
          <div className="border border-dashed border-border/50 rounded-md p-3 mt-2">
            <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add action
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs">action_type</Label>
                <Input
                  value={newRow.action_type}
                  onChange={(e) => setNewRow({ ...newRow, action_type: e.target.value })}
                  placeholder="e.g. share_work"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newRow.amount}
                  onChange={(e) => setNewRow({ ...newRow, amount: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">count/day</Label>
                <Input
                  type="number"
                  value={newRow.per_day_cap}
                  onChange={(e) => setNewRow({ ...newRow, per_day_cap: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">amount/day</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newRow.per_day_amount_cap ?? ""}
                  onChange={(e) =>
                    setNewRow({
                      ...newRow,
                      per_day_amount_cap: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                disabled={!newRow.action_type.trim() || upsertMut.isPending}
                onClick={() => {
                  upsertMut.mutate(newRow, {
                    onSuccess: () =>
                      setNewRow({
                        action_type: "",
                        amount: 1,
                        per_day_cap: 10,
                        per_day_amount_cap: 10,
                        enabled: true,
                        description: "",
                      }),
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Awarded vs cap — last {DAYS_WINDOW} days
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Counts pending + approved rewards. "Capped users" reached the current per-day count cap.
          </p>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !usage?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No reward activity in window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-2 py-2">Day</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2 text-right">Awarded</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-right">Users</th>
                    <th className="px-2 py-2 text-right">Capped users</th>
                    <th className="px-2 py-2 text-right">Avg / user vs cap</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => {
                    const cap = caps?.find((c) => c.action_type === u.action_type)?.per_day_cap;
                    const avg = u.distinct_users ? u.count / u.distinct_users : 0;
                    const ratio = cap ? avg / cap : null;
                    const ratioColor =
                      ratio == null
                        ? "text-muted-foreground"
                        : ratio >= 0.9
                        ? "text-destructive"
                        : ratio >= 0.6
                        ? "text-amber-500"
                        : "text-emerald-500";
                    return (
                      <tr key={`${u.action_type}-${u.day}`} className="border-b border-border/30">
                        <td className="px-2 py-2 font-mono text-xs">{u.day}</td>
                        <td className="px-2 py-2 font-mono text-xs">{u.action_type}</td>
                        <td className="px-2 py-2 text-right">{u.count}</td>
                        <td className="px-2 py-2 text-right">{u.amount_sum.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">{u.distinct_users}</td>
                        <td className="px-2 py-2 text-right">
                          {u.capped_users > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">
                              {u.capped_users}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className={`px-2 py-2 text-right text-xs ${ratioColor}`}>
                          {cap ? `${avg.toFixed(1)} / ${cap}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRewardCaps;
