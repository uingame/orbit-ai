import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Mail, Shield, Users, UserCog, Search, ArrowUpDown, Calendar, Download, Send } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { formatDateIL } from "@/lib/format-date";

interface AuthorizedEmail {
  id: string;
  email: string;
  role: string;
  name: string | null;
  createdAt: string | null;
  createdBy: number | null;
}

type SortColumn = "email" | "name" | "role" | "date";
type SortOrder = "asc" | "desc";

export default function AdminAuthorizedEmails() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("email");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [formData, setFormData] = useState({
    email: "",
    role: "judge",
    name: "",
  });

  const { data: user } = useQuery<{ role: string }>({
    queryKey: ["/api/user"],
  });

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  const { data: authorizedEmails = [], isLoading } = useQuery<AuthorizedEmail[]>({
    queryKey: ["/api/authorized-emails"],
    enabled: isAdmin || isManager,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; name?: string }) => {
      return apiRequest("POST", "/api/authorized-emails", data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/authorized-emails"] });
      toast({ title: "Email Added", description: "The email has been added to the authorized list." });
      setDialogOpen(false);
      setFormData({ email: "", role: "judge", name: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add email", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/authorized-emails/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/authorized-emails"] });
      toast({ title: "Email Removed", description: "The email has been removed from the authorized list." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove email", variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/authorized-emails/${id}/resend`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation Sent", description: "The invitation email has been resent." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error.message || "Could not resend invitation", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      email: formData.email.trim(),
      role: formData.role,
      name: formData.name.trim() || undefined,
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive" className="gap-1"><Shield className="w-3 h-3" />Admin</Badge>;
      case "manager":
        return <Badge variant="default" className="gap-1"><UserCog className="w-3 h-3" />Manager</Badge>;
      case "judge":
        return <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" />Judge</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-5 h-5 text-red-500" />;
      case "manager":
        return <UserCog className="w-5 h-5 text-blue-500" />;
      case "judge":
        return <Users className="w-5 h-5 text-gray-500" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  const filteredAndSortedEmails = useMemo(() => {
    let filtered = authorizedEmails.filter(item =>
      item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "email":
          aValue = a.email;
          bValue = b.email;
          break;
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "role":
          aValue = a.role;
          bValue = b.role;
          break;
        case "date":
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [authorizedEmails, searchTerm, sortColumn, sortOrder]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("asc");
    }
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className={`h-4 w-4 transition-opacity ${
          sortColumn === column ? "opacity-100" : "opacity-20"
        } ${sortColumn === column && sortOrder === "desc" ? "rotate-180" : ""}`} />
      </div>
    </TableHead>
  );

  const adminCount = authorizedEmails.filter(e => e.role === "admin").length;
  const managerCount = authorizedEmails.filter(e => e.role === "manager").length;
  const judgeCount = authorizedEmails.filter(e => e.role === "judge").length;

  if (!isAdmin && !isManager) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Authorized Emails</h1>
          <p className="text-muted-foreground">
            Manage email addresses that can log in with Google. Users with these emails will automatically get their assigned role.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-email">
              <Plus className="w-4 h-4 mr-2" />
              Add Email
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Authorized Email</DialogTitle>
              <DialogDescription>Add an email address that will be recognized when logging in with Google.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    {isAdmin && <SelectItem value="manager">Manager</SelectItem>}
                    <SelectItem value="judge">Judge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending}
                data-testid="button-submit-email"
              >
                {createMutation.isPending ? "Adding..." : "Add Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>
        )}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <UserCog className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{managerCount}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Judges</CardTitle>
            <Users className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{judgeCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Authorized Emails ({filteredAndSortedEmails.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportToCSV("authorized-emails.csv", ["Email", "Name", "Role", "Date Created"], filteredAndSortedEmails.map((item) => [
                      item.email,
                      item.name || "",
                      item.role,
                      item.createdAt ? formatDateIL(item.createdAt) : "",
                    ]))
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
              <CardDescription>
                {isManager ? "Judges you've authorized to log in with Google" : "All authorized emails for Google login"}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-primary/20"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredAndSortedEmails.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{authorizedEmails.length === 0 ? "No authorized emails yet." : "No emails match your search."}</p>
              <p className="text-sm">Add emails to allow users to log in with Google.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/30 bg-card/20">
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow className="border-primary/10">
                    <SortHeader column="email" label="Email" />
                    <SortHeader column="name" label="Name" />
                    <SortHeader column="role" label="Role" />
                    {isAdmin && <SortHeader column="date" label="Added" />}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedEmails.map((item, idx) => (
                    <TableRow 
                      key={item.id} 
                      data-testid={`row-email-${item.id}`}
                      className="border-border/30 hover:bg-primary/5 transition-colors animate-in fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(item.role)}
                          <span className="font-mono text-sm">{item.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.name || <span className="text-muted-foreground italic">-</span>}</TableCell>
                      <TableCell>{getRoleBadge(item.role)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-sm text-muted-foreground">
                          {item.createdAt ? formatDateIL(item.createdAt) : "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resendMutation.mutate(item.id)}
                            disabled={resendMutation.isPending}
                            data-testid={`button-resend-${item.id}`}
                            className="hover:text-primary"
                            title="Resend invitation email"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Remove ${item.email} from authorized list?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
