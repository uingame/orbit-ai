import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, Users, AlertTriangle, Phone, Languages, Upload, Search, ArrowUpDown, Calendar, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import type { User } from "@shared/schema";

type SortColumn = "name" | "username" | "events" | "phone";
type SortOrder = "asc" | "desc";

export default function ManagerJudges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<User | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    languages: "",
    restrictions: "",
  });

  const { data: judges = [], isLoading } = useQuery<(any)[]>({
    queryKey: ["/api/judges-with-events"],
    queryFn: async () => {
      const res = await fetch("/api/judges-with-events");
      if (!res.ok) throw new Error("Failed to fetch judges");
      return res.json();
    },
  });

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
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortColumn === column && (
          <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} />
        )}
      </div>
    </TableHead>
  );

  const filteredAndSortedJudges = useMemo(() => {
    let filtered = judges.filter(
      (judge) =>
        judge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        judge.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        judge.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === "phone") {
        aVal = a.phone || "";
        bVal = b.phone || "";
      } else if (sortColumn === "events") {
        aVal = a.assignedEvents?.length || 0;
        bVal = b.assignedEvents?.length || 0;
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [judges, searchTerm, sortColumn, sortOrder]);

  const createJudgeMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/judges", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      toast({ title: "Judge Created", description: "New judge has been added successfully." });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create judge", variant: "destructive" });
    },
  });

  const updateJudgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/judges/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      toast({ title: "Judge Updated", description: "Judge details have been updated." });
      resetForm();
      setDialogOpen(false);
      setEditingJudge(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update judge", variant: "destructive" });
    },
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/judges/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      toast({ title: "Judge Removed", description: "Judge has been removed from the system." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete judge", variant: "destructive" });
    },
  });

  const importJudgesMutation = useMutation({
    mutationFn: async (judges: any[]) => {
      const results = [];
      for (const judge of judges) {
        try {
          await apiRequest("POST", "/api/judges", judge);
          results.push({ success: true, name: judge.name });
        } catch (e) {
          results.push({ success: false, name: judge.name });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      const successCount = results.filter(r => r.success).length;
      toast({ 
        title: "Import Complete", 
        description: `${successCount} of ${results.length} judges imported successfully.` 
      });
      setImportDialogOpen(false);
      setImportText("");
    },
  });

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      name: "",
      phone: "",
      languages: "",
      restrictions: "",
    });
  };

  const openEditDialog = (judge: User) => {
    setEditingJudge(judge);
    setFormData({
      username: judge.username,
      password: "",
      name: judge.name,
      phone: judge.phone || "",
      languages: judge.languages?.join(", ") || "",
      restrictions: (judge as any).restrictions || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      username: formData.username,
      password: formData.password || undefined,
      name: formData.name,
      phone: formData.phone || null,
      languages: formData.languages ? formData.languages.split(",").map(l => l.trim()) : [],
      restrictions: formData.restrictions || null,
      role: "judge",
    };

    if (editingJudge) {
      const updateData = { ...data };
      if (!updateData.password) delete updateData.password;
      updateJudgeMutation.mutate({ id: editingJudge.id, data: updateData });
    } else {
      if (!data.password) {
        toast({ title: "Error", description: "Password is required for new judges", variant: "destructive" });
        return;
      }
      createJudgeMutation.mutate(data);
    }
  };

  const handleImport = () => {
    const lines = importText.trim().split("\n");
    const judges = [];
    
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        judges.push({
          name: parts[0],
          username: parts[1] || parts[0].toLowerCase().replace(/\s+/g, ""),
          password: parts[2] || "password123",
          phone: parts[3] || null,
          languages: parts[4] ? parts[4].split(";").map(l => l.trim()) : [],
          restrictions: parts[5] || null,
          role: "judge",
        });
      }
    }

    if (judges.length === 0) {
      toast({ title: "Error", description: "No valid judges found in import data", variant: "destructive" });
      return;
    }

    importJudgesMutation.mutate(judges);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading judges...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Judge Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage potential judges with restrictions</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-judges">
                <Upload className="mr-2 h-4 w-4" /> Import List
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Judges from List</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Paste judge list (CSV format)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Format: Name, Username, Password, Phone, Languages (semicolon-separated), Restrictions
                  </p>
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="John Doe, johnd, pass123, +1234567890, English;Hebrew, Cannot judge weekends"
                    rows={8}
                    data-testid="textarea-import-judges"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importJudgesMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  Import Judges
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingJudge(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-judge">
                <Plus className="mr-2 h-4 w-4" /> Add Judge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingJudge ? "Edit Judge" : "Add New Judge"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      data-testid="input-judge-name"
                    />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="johnd"
                      data-testid="input-judge-username"
                    />
                  </div>
                </div>
                <div>
                  <Label>{editingJudge ? "New Password (leave blank to keep)" : "Password"}</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingJudge ? "Leave blank to keep current" : "Enter password"}
                    data-testid="input-judge-password"
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                    data-testid="input-judge-phone"
                  />
                </div>
                <div>
                  <Label>Languages (comma-separated)</Label>
                  <Input
                    value={formData.languages}
                    onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                    placeholder="English, Hebrew, Arabic"
                    data-testid="input-judge-languages"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Restrictions
                  </Label>
                  <Textarea
                    value={formData.restrictions}
                    onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                    placeholder="e.g., Cannot judge on weekends, Only available for Hebrew events, Cannot judge teams from XYZ school"
                    rows={3}
                    data-testid="input-judge-restrictions"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter any scheduling or assignment restrictions for this judge
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createJudgeMutation.isPending || updateJudgeMutation.isPending}
                  data-testid="button-save-judge"
                >
                  {editingJudge ? "Update Judge" : "Add Judge"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Judges ({filteredAndSortedJudges.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV("judges.csv", ["Name", "Username", "Events", "Phone", "Languages"], filteredAndSortedJudges.map((judge) => [
                    judge.name,
                    judge.username,
                    judge.assignedEvents?.map((e: any) => e.name).join(", ") || "",
                    judge.phone || "",
                    judge.languages?.join(", ") || "",
                  ]))
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {judges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No judges added yet. Click "Add Judge" to get started.</p>
            </div>
          ) : filteredAndSortedJudges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No judges match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortHeader column="name" label="Name" />
                    <SortHeader column="username" label="Username" />
                    <SortHeader column="events" label="Events" />
                    <SortHeader column="phone" label="Phone" />
                    <TableHead>Languages</TableHead>
                    <TableHead>Restrictions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedJudges.map((judge, idx) => (
                    <TableRow 
                      key={judge.id} 
                      data-testid={`row-judge-${judge.id}`}
                      className="animate-in fade-in duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="font-medium">{judge.name}</TableCell>
                      <TableCell className="text-muted-foreground">{judge.username}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {judge.assignedEvents && judge.assignedEvents.length > 0 ? (
                            judge.assignedEvents.map((event: any) => (
                              <Badge key={event.id} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                {event.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {judge.phone ? (
                          <span className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {judge.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {judge.languages?.map((lang: string) => (
                            <Badge key={lang} variant="secondary" className="text-xs">
                              {lang}
                            </Badge>
                          )) || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {(judge as any).restrictions ? (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-amber-600 dark:text-amber-400 line-clamp-2">
                              {(judge as any).restrictions}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(judge)}
                            data-testid={`button-edit-judge-${judge.id}`}
                            className="hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Are you sure you want to remove this judge?")) {
                                deleteJudgeMutation.mutate(judge.id);
                              }
                            }}
                            data-testid={`button-delete-judge-${judge.id}`}
                            className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
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
