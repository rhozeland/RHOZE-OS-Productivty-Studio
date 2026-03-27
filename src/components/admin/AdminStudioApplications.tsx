import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, ExternalLink, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

interface Application {
  id: string;
  studio_name: string;
  description: string | null;
  location: string | null;
  contact_email: string | null;
  website_url: string | null;
  portfolio_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  applicant_name?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const AdminStudioApplications = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchApplications = async () => {
    setLoading(true);
    let query = supabase
      .from("studio_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Fetch applicant display names
      const userIds = [...new Set((data || []).map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);
      setApplications(
        (data || []).map((a) => ({ ...a, applicant_name: nameMap.get(a.user_id) || "Unknown" }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const handleReview = async (status: "approved" | "rejected") => {
    if (!selected || !user) return;
    setProcessing(true);

    const { error } = await supabase
      .from("studio_applications")
      .update({
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", selected.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Application ${status}`, description: `${selected.studio_name} has been ${status}.` });

      // If approved, create the studio listing
      if (status === "approved") {
        await supabase.from("studios").insert({
          name: selected.studio_name,
          description: selected.description,
          location: selected.location,
          owner_id: selected.user_id,
          status: "active",
          is_active: true,
        });
      }

      setSelected(null);
      setAdminNotes("");
      fetchApplications();
    }
    setProcessing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Studio Applications</CardTitle>
        <CardDescription>Review and manage studio listing applications</CardDescription>
        <div className="flex gap-2 pt-2">
          {(["pending", "all", "approved", "rejected"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : applications.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No {filter === "all" ? "" : filter} applications found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Studio Name</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const sc = statusConfig[app.status] || statusConfig.pending;
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.studio_name}</TableCell>
                    <TableCell>{app.applicant_name}</TableCell>
                    <TableCell>{app.location || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelected(app);
                          setAdminNotes(app.admin_notes || "");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected?.studio_name}</DialogTitle>
              <DialogDescription>Submitted by {selected?.applicant_name}</DialogDescription>
            </DialogHeader>

            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Location</span>
                    <p className="font-medium">{selected.location || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact</span>
                    <p className="font-medium">{selected.contact_email || "Not provided"}</p>
                  </div>
                  {selected.website_url && (
                    <div>
                      <span className="text-muted-foreground">Website</span>
                      <a href={selected.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        Visit <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selected.portfolio_url && (
                    <div>
                      <span className="text-muted-foreground">Portfolio</span>
                      <a href={selected.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {selected.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">Description</span>
                    <p className="text-sm mt-1 bg-muted/50 rounded-md p-3">{selected.description}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-muted-foreground">Admin Notes</span>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this application..."
                    className="mt-1"
                  />
                </div>

                {selected.status === "pending" ? (
                  <div className="flex gap-2 justify-end">
                    <Button variant="destructive" onClick={() => handleReview("rejected")} disabled={processing}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button onClick={() => handleReview("approved")} disabled={processing}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-end text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Reviewed on {selected.reviewed_at ? new Date(selected.reviewed_at).toLocaleDateString() : "—"}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminStudioApplications;
