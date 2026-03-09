import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

type Milestone = {
  title: string;
  description: string;
  credits: number;
};

type QuoteBuilderProps = {
  recipientId: string;
  recipientName: string;
};

const QuoteBuilder = ({ recipientId, recipientName }: QuoteBuilderProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [projectTitle, setProjectTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: "", description: "", credits: 0 },
  ]);

  const totalCredits = milestones.reduce((sum, m) => sum + (m.credits || 0), 0);

  const addMilestone = () => {
    setMilestones([...milestones, { title: "", description: "", credits: 0 }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string | number) => {
    setMilestones(
      milestones.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const resetForm = () => {
    setProjectTitle("");
    setNotes("");
    setMilestones([{ title: "", description: "", credits: 0 }]);
  };

  const createQuote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // 1. Create a project for this contract
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: projectTitle,
          description: notes || null,
          status: "active",
        })
        .select("id")
        .single();
      if (projErr) throw projErr;

      // 2. Create the contract
      const { data: contract, error: contractErr } = await supabase
        .from("project_contracts")
        .insert({
          project_id: project.id,
          specialist_id: user.id,
          client_id: recipientId,
          total_credits: totalCredits,
          notes: notes || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (contractErr) throw contractErr;

      // 3. Create milestones
      const milestonesData = milestones
        .filter((m) => m.title.trim())
        .map((m, i) => ({
          contract_id: contract.id,
          title: m.title,
          description: m.description || null,
          credit_amount: m.credits || 0,
          sort_order: i,
          proposed_by: user.id,
          status: "pending",
        }));

      if (milestonesData.length > 0) {
        const { error: msErr } = await supabase
          .from("project_milestones")
          .insert(milestonesData);
        if (msErr) throw msErr;
      }

      // 4. Send a message with the quote summary
      const milestoneList = milestones
        .filter((m) => m.title.trim())
        .map((m, i) => `  ${i + 1}. ${m.title} — ${m.credits} credits`)
        .join("\n");

      const quoteMessage = `📋 **Quote Sent**\n\n**${projectTitle}**\n${notes ? `${notes}\n` : ""}\nMilestones:\n${milestoneList}\n\n💰 Total: ${totalCredits} credits\n\n_Contract ID: ${contract.id}_`;

      const { error: msgErr } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: recipientId,
        content: quoteMessage,
      });
      if (msgErr) throw msgErr;

      return contract.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      resetForm();
      setOpen(false);
      toast.success("Quote sent!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isValid =
    projectTitle.trim() &&
    milestones.some((m) => m.title.trim()) &&
    totalCredits >= 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          Send Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Create Quote for {recipientName}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) createQuote.mutate();
          }}
          className="space-y-5"
        >
          {/* Project title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Project Title
            </label>
            <Input
              placeholder="e.g. Album Cover Design"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Notes (optional)
            </label>
            <Textarea
              placeholder="Scope of work, delivery timeline..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Milestones
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={addMilestone}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Milestone ${index + 1}`}
                          value={milestone.title}
                          onChange={(e) =>
                            updateMilestone(index, "title", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Credits"
                          value={milestone.credits || ""}
                          onChange={(e) =>
                            updateMilestone(
                              index,
                              "credits",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-24"
                        />
                      </div>
                      <Input
                        placeholder="Description (optional)"
                        value={milestone.description}
                        onChange={(e) =>
                          updateMilestone(index, "description", e.target.value)
                        }
                        className="text-xs"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMilestone(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="font-display text-lg font-bold text-primary">
              {totalCredits} credits
            </span>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || createQuote.isPending}
          >
            {createQuote.isPending ? "Sending..." : "Send Quote"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteBuilder;
