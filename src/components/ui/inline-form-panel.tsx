/**
 * InlineFormPanel
 * ─────────────────────────────────────────────────────────────────────────
 * A reusable, collapsible inline form container. Replaces the dialog/modal
 * pattern with an expand-in-place panel that shows a trigger button when
 * collapsed and the form body + Cancel/Submit footer when open.
 *
 * Originally extracted from `WorksPage`'s "Register a work" panel so other
 * inline forms across the app (project deliverables, hub offerings, profile
 * sections, etc.) share the same chrome and behavior.
 *
 * Usage:
 *   <InlineFormPanel
 *     icon={Plus}
 *     title="Register a work"
 *     description="We hash the file in your browser…"
 *     triggerLabel="New work"
 *     submitLabel="Register"
 *     submitting={submitting}
 *     canSubmit={canSubmit}
 *     onSubmit={handleSubmit}
 *     onReset={resetForm}
 *   >
 *     {/* form fields here *\/}
 *   </InlineFormPanel>
 *
 * State can be uncontrolled (default) or controlled via `open` + `onOpenChange`.
 */
import { useState, type ReactNode, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineFormPanelProps {
  /** Icon shown next to the title and (by default) inside the trigger button. */
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  /** Section heading shown at the top of the panel. */
  title: string;
  /** Helper text shown under the title. */
  description?: ReactNode;

  /** Label for the closed-state trigger button. Defaults to "New". */
  triggerLabel?: string;
  /** Label for the submit button. Defaults to "Save". */
  submitLabel?: string;
  /** Label for the loading state. Defaults to "Saving…". */
  submittingLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Label for the collapse-while-open button. Defaults to "Hide". */
  hideLabel?: string;

  /** Whether the form is currently submitting. */
  submitting?: boolean;
  /** Whether the submit button should be enabled. */
  canSubmit?: boolean;

  /** Submit handler. */
  onSubmit?: () => void;
  /** Optional reset hook fired on Cancel / Hide. */
  onReset?: () => void;

  /** Hide the built-in Cancel/Submit footer if the form provides its own. */
  hideFooter?: boolean;

  /** Controlled open state. */
  open?: boolean;
  /** Notified whenever the panel opens or closes. */
  onOpenChange?: (open: boolean) => void;

  /** Extra trailing content rendered next to the trigger button (when closed). */
  triggerExtra?: ReactNode;

  /** Extra class names for the surface card. */
  className?: string;

  /** Form body. */
  children?: ReactNode;
}

export function InlineFormPanel({
  icon: Icon = Plus,
  title,
  description,
  triggerLabel = "New",
  submitLabel = "Save",
  submittingLabel = "Saving…",
  cancelLabel = "Cancel",
  hideLabel = "Hide",
  submitting = false,
  canSubmit = true,
  onSubmit,
  onReset,
  hideFooter = false,
  open: openProp,
  onOpenChange,
  triggerExtra,
  className,
  children,
}: InlineFormPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const handleClose = () => {
    setOpen(false);
    onReset?.();
  };

  return (
    <section className={cn("surface-card p-5 sm:p-6 space-y-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />} {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {description}
            </p>
          )}
        </div>
        {open && (
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {hideLabel}
          </Button>
        )}
      </div>

      {!open ? (
        <div className="flex items-center gap-2">
          <Button onClick={() => setOpen(true)} className="gap-1.5 rounded-full">
            {Icon && <Icon className="h-4 w-4" />} {triggerLabel}
          </Button>
          {triggerExtra}
        </div>
      ) : (
        <div className="space-y-4">
          {children}
          {!hideFooter && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={handleClose}>
                {cancelLabel}
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {submittingLabel}
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default InlineFormPanel;
