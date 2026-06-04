/**
 * RoadmapCopilot — streaming chat panel mounted on a project's Roadmap tab.
 * Lets project members talk through the roadmap with Gemini 2.5 Pro; the
 * edge function loads project + goals + linked coin server-side, so the
 * client only sends the latest user prompt + a short history tail.
 *
 * Messages are persisted to `project_copilot_messages` so the conversation
 * survives reloads and any team member can pick it up later.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

type Msg = { id?: string; role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roadmap-copilot`;
const QUICK_PROMPTS = [
  "Critique my current roadmap",
  "Suggest 3 marketing moves for milestone 1",
  "Tighten the timeline",
  "How do I give holders something to do?",
];

export default function RoadmapCopilot({ projectId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draftAssistant, setDraftAssistant] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["copilot-msgs", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_copilot_messages")
        .select("id, role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, draftAssistant]);

  const send = async (text: string) => {
    if (!text.trim() || streaming || !user) return;
    setInput("");
    setStreaming(true);
    setDraftAssistant("");

    // Persist user msg
    const { data: inserted, error: insertErr } = await supabase
      .from("project_copilot_messages")
      .insert({ project_id: projectId, user_id: user.id, role: "user", content: text })
      .select("id, role, content")
      .single();
    if (insertErr) {
      toast.error(insertErr.message);
      setStreaming(false);
      return;
    }
    qc.setQueryData<Msg[]>(["copilot-msgs", projectId], (prev = []) => [...prev, inserted as Msg]);

    const history = (messages ?? []).slice(-10).map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ project_id: projectId, message: text, history }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Rate limited — try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("Copilot failed");
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setDraftAssistant(acc);
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (acc.trim()) {
        await supabase.from("project_copilot_messages").insert({
          project_id: projectId,
          user_id: user.id,
          role: "assistant",
          content: acc,
        });
      }
      setDraftAssistant("");
      qc.invalidateQueries({ queryKey: ["copilot-msgs", projectId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Copilot error");
    } finally {
      setStreaming(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-border bg-card hover:bg-card/80 px-4 py-3 flex items-center gap-3 text-left transition shadow-sm"
      >
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Roadmap Copilot</div>
          <div className="text-xs text-muted-foreground">Chat with AI about your release — sequencing, marketing, holder utility.</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 h-7 text-xs font-medium text-foreground">
          <Bot className="h-3 w-3" /> Open
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-violet-500" /> Roadmap Copilot
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !draftAssistant && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask anything about this release — I have the full roadmap, your linked coin, and your bio in context.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="text-xs rounded-full border border-border bg-background px-2.5 py-1 hover:bg-muted"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                : "mr-8 rounded-lg bg-muted/60 px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none"
            }
          >
            {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
          </div>
        ))}
        {draftAssistant && (
          <div className="mr-8 rounded-lg bg-muted/60 px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{draftAssistant}</ReactMarkdown>
          </div>
        )}
        {streaming && !draftAssistant && (
          <div className="mr-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-border p-2 flex gap-2 items-end"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask the copilot…"
          rows={1}
          className="min-h-[40px] resize-none text-sm"
          disabled={streaming}
        />
        <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
