import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Phone, Edit2, Search, ArrowUpDown, Calendar, MapPin, Download, Trash2, Mail, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { exportToCSV } from "@/lib/export-csv";
import { formatDateIL } from "@/lib/format-date";
import { EditCredentialsDialog } from "@/components/edit-credentials-dialog";

interface Manager {
  id: number;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  assignedEvents?: Event[];
}

interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
  managerId?: number | null;
}

type SortColumn = "name" | "username" | "events" | "email";
type SortOrder = "asc" | "desc";

export default function AdminManagers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [credentialsManager, setCredentialsManager] = useState<Manager | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data: managers = [], isLoading: managersLoading } = useQuery<Manager[]>({
    queryKey: ["/api/managers-with-events"],
    queryFn: async () => {
      const res = await fetch("/api/managers-with-events");
      if (!res.ok) throw new Error("Failed to fetch managers");
      return res.json();
    },
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const updateEventManagerMutation = useMutation({
    mutationFn: async ({ eventId, managerId }: { eventId: number; managerId: number | null }) => {
      return apiRequest("PUT", `/api/events/${eventId}/manager`, { managerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers-with-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update assignment", variant: "destructive" });
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: number) => {
      return apiRequest("DELETE", `/api/managers/${managerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers-with-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Deleted", description: "Manager has been removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete manager", variant: "destructive" });
    },
  });

  const openEditDialog = (manager: Manager) => {
    setEditingManagerId(manager.id);
    setSelectedEventIds(manager.assignedEvents?.map(e => e.id) || []);
    setEditDialogOpen(true);
  };

  const handleSaveAssignments = () => {
    if (!editingManagerId) return;

    const allEventIds = events.map(e => e.id);
    let mutationCount = 0;

    for (const eventId of allEventIds) {
      const event = events.find(e => e.id === eventId);
      if (!event) continue;

      const isSelected = selectedEventIds.includes(eventId);
      const isCurrentlyAssigned = event.managerId === editingManagerId;

      if (isSelected && !isCurrentlyAssigned) {
        mutationCount++;
        updateEventManagerMutation.mutate({ eventId, managerId: editingManagerId });
      } else if (!isSelected && isCurrentlyAssigned) {
        mutationCount++;
        updateEventManagerMutation.mutate({ eventId, managerId: null });
      }
    }

    if (mutationCount === 0) {
      toast({ title: "No changes", description: "No assignments were modified." });
    } else {
      toast({ title: "Success", description: "Manager assignments updated" });
    }
    setEditDialogOpen(false);
    setEditingManagerId(null);
  };

  const filteredAndSortedManagers = useMemo(() => {
    let filtered = managers.filter(manager =>
      manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "username":
          aValue = a.username;
          bValue = b.username;
          break;
        case "events":
          aValue = a.assignedEvents?.length || 0;
          bValue = b.assignedEvents?.length || 0;
          break;
        case "email":
          aValue = a.email || "";
          bValue = b.email || "";
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [managers, searchTerm, sortColumn, sortOrder]);

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

  const isLoading = managersLoading || eventsLoading;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const editingManager = managers.find(m => m.id === editingManagerId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manager Management</h1>
          <p className="text-muted-foreground">View managers and manage their event assignments</p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-card/50 to-card/30 border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                All Managers ({filteredAndSortedManagers.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV("managers.csv", ["Name", "Username", "Events", "Email"], filteredAndSortedManagers.map((manager) => [
                    manager.name,
                    manager.username,
                    manager.assignedEvents?.map(e => e.name).join(", ") || "",
                    manager.email || "",
                  ]))
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-primary/20 focus:border-primary/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedManagers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{managers.length === 0 ? "No managers found in the system." : "No managers match your search."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/30 bg-card/20">
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow className="border-primary/10 hover:bg-primary/5">
                    <SortHeader column="name" label="Name" />
                    <SortHeader column="username" label="Username" />
                    <SortHeader column="events" label="Events" />
                    <SortHeader column="email" label="Email" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedManagers.map((manager, idx) => (
                    <TableRow
                      key={manager.id}
                      className="border-border/30 hover:bg-primary/5 transition-colors duration-200 animate-in fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="font-semibold text-foreground">{manager.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary/20 text-foreground">
                          {manager.username}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {manager.assignedEvents && manager.assignedEvents.length > 0 ? (
                            <>
                              {manager.assignedEvents.slice(0, 2).map((event) => (
                                <Badge
                                  key={event.id}
                                  variant="outline"
                                  className="text-xs bg-blue/5 text-white dark:text-blue-300 border-blue/30"
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {event.name}
                                </Badge>
                              ))}
                              {manager.assignedEvents.length > 2 && (
                                <Badge variant="secondary" className="text-xs bg-muted/30">
                                  +{manager.assignedEvents.length - 2} more
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No events</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {manager.email ? (
                          <span className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            <span className="text-muted-foreground">{manager.email}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {manager.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this manager from the system and unassign them from all events. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteManagerMutation.mutate(manager.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCredentialsManager(manager);
                              setCredentialsOpen(true);
                            }}
                            data-testid={`button-credentials-manager-${manager.id}`}
                            className="hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                            title="Edit credentials"
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            Credentials
                          </Button>
                          <Dialog open={editDialogOpen && editingManagerId === manager.id} onOpenChange={(open) => {
                            if (!open) {
                              setEditDialogOpen(false);
                              setEditingManagerId(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(manager)}
                                className="hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Assign Events to {editingManager?.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 max-h-96 overflow-y-auto pr-4">
                                {events.length === 0 ? (
                                  <p className="text-center text-muted-foreground py-4">No events available</p>
                                ) : (
                                  events.map((event) => {
                                    const otherManager = event.managerId && event.managerId !== editingManagerId
                                      ? managers.find(m => m.id === event.managerId)
                                      : null;
                                    return (
                                      <div
                                        key={event.id}
                                        className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-border/20"
                                      >
                                        <Checkbox
                                          id={`event-${event.id}`}
                                          checked={selectedEventIds.includes(event.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedEventIds([...selectedEventIds, event.id]);
                                            } else {
                                              setSelectedEventIds(selectedEventIds.filter(id => id !== event.id));
                                            }
                                          }}
                                          className="mt-1"
                                        />
                                        <Label
                                          htmlFor={`event-${event.id}`}
                                          className="font-normal cursor-pointer flex-1"
                                        >
                                          <div className="flex flex-col gap-1">
                                            <span className="font-semibold">{event.name}</span>
                                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                              <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatDateIL(event.date)}
                                              </span>
                                              {event.location && (
                                                <span className="flex items-center gap-1">
                                                  <MapPin className="h-3 w-3" />
                                                  {event.location}
                                                </span>
                                              )}
                                              {otherManager && (
                                                <span className="text-amber-500 flex items-center gap-1">
                                                  <Users className="h-3 w-3" />
                                                  Currently managed by {otherManager.name}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </Label>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              <DialogFooter className="gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditDialogOpen(false);
                                    setEditingManagerId(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveAssignments}
                                  disabled={updateEventManagerMutation.isPending}
                                  className="bg-primary hover:bg-primary/90"
                                >
                                  {updateEventManagerMutation.isPending ? "Saving..." : "Save Assignments"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
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

      <EditCredentialsDialog
        user={credentialsManager}
        open={credentialsOpen}
        onOpenChange={(open) => {
          setCredentialsOpen(open);
          if (!open) setCredentialsManager(null);
        }}
        invalidateKeys={["/api/managers-with-events", "/api/managers"]}
      />
    </div>
  );
}
