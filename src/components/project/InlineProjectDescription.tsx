import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  projectId: string;
  description: string | null | undefined;
  canManage?: boolean;
}

const InlineProjectDescription = ({ projectId, description, canManage }: Props) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(description ?? "");
  }, [description]);

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ description: value.trim() || null } as any)
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setEditing(false);
      toast.success("Description updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="A short description of this project…"
          className="text-base leading-relaxed"
        />
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(description ?? "");
              setEditing(false);
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>
    );
  }

  const empty = !description || !description.trim();

  if (empty && !canManage) return null;

  return (
    <div
      className="group relative"
      onClick={() => {
        if (canManage && empty) setEditing(true);
      }}
    >
      <p
        className={[
          "pr-9 text-base md:text-lg leading-relaxed whitespace-pre-wrap",
          empty ? "text-muted-foreground italic cursor-text" : "text-foreground",
        ].join(" ")}
      >
        {empty
          ? canManage
            ? "Add a short description for this project…"
            : ""
          : description}
      </p>
      {canManage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          aria-label="Edit description"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default InlineProjectDescription;
