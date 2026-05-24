/**
 * CuratorPage — Phase 3 of the Concierge SKU.
 *
 * Standalone surface at `/curator` for Certified Curators to triage incoming
 * Concierge briefs without giving them full admin access. Mounts the same
 * `<AdminConciergeRequests />` component used in `/admin?tab=concierge`, with
 * the "Convert to project" panel hidden for non-admins (server-side RPC
 * enforcement matches).
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useCuratorCheck } from "@/hooks/useCuratorCheck";
import AdminConciergeRequests from "@/components/admin/AdminConciergeRequests";
import { Sparkles } from "lucide-react";

export default function CuratorPage() {
  const { isCurator, isAdmin, loading } = useCuratorCheck();

  useEffect(() => {
    document.title = "Curator inbox · Rhozeland";
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isCurator) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          <Sparkles className="h-3 w-3" /> Certified Curator
        </div>
        <h1 className="text-2xl font-bold text-foreground">Concierge inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Triage incoming briefs, draft a scoped proposal, and hand off to an
          admin for project conversion.
        </p>
      </header>
      <AdminConciergeRequests canConvert={isAdmin} />
    </div>
  );
}
