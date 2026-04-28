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
import { Users, Phone, Edit2, Search, ArrowUpDown, Calendar, MapPin, Download, Trash2, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { exportToCSV } from "@/lib/export-csv";
import { formatDateIL } from "@/lib/format-date";
import { EditCredentialsDialog } from "@/components/edit-credentials-dialog";
import type { User } from "@shared/schema";

interface Judge {
  id: number;
  name: string;
  username: string;
  phone?: string;
  assignedEvents?: Event[];
}

interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
  judgeIds?: number[];
}

type SortColumn = "name" | "username" | "events" | "phone";
type SortOrder = "asc" | "desc";

export default function AdminJudges() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingJudgeId, setEditingJudgeId] = useState<number | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [credentialsJudge, setCredentialsJudge] = useState<any | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data: judges = [], isLoading: judgesLoading } = useQuery<(any)[]>({
    queryKey: ["/api/judges-with-events"],
    queryFn: async () => {
      const res = await fetch("/api/judges-with-events");
      if (!res.ok) throw new Error("Failed to fetch judges");
      return res.json();
    },
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const updateEventJudgesMutation = useMutation({
    mutationFn: async ({ eventId, judgeIds }: { eventId: number; judgeIds: number[] }) => {
      return apiRequest("PUT", `/api/events/${eventId}/judges`, { judgeIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Success", description: "Judge assignments updated" });
      setEditDialogOpen(false);
      setEditingJudgeId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update assignments", variant: "destructive" });
    },
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (judgeId: number) => {
      return apiRequest("DELETE", `/api/judges/${judgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/judges-with-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Deleted", description: "Judge has been removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete judge", variant: "destructive" });
    },
  });

  const openEditDialog = (judge: any) => {
    setEditingJudgeId(judge.id);
    setSelectedEventIds(judge.assignedEvents?.map((e: any) => e.id) || []);
    setEditDialogOpen(true);
  };

  const handleSaveAssignments = () => {
    if (!editingJudgeId) return;

    const allEventIds = events.map(e => e.id);
    let mutationCount = 0;
    
    for (const eventId of allEventIds) {
      const event = events.find(e => e.id === eventId);
      if (!event) continue;

      const currentJudgeIds = event.judgeIds || [];
      const isSelected = selectedEventIds.includes(eventId);
      const isCurrentlyAssigned = currentJudgeIds.includes(editingJudgeId);

      if (isSelected && !isCurrentlyAssigned) {
        mutationCount++;
        updateEventJudgesMutation.mutate({
          eventId,
          judgeIds: [...currentJudgeIds, editingJudgeId],
        });
      } else if (!isSelected && isCurrentlyAssigned) {
        mutationCount++;
        updateEventJudgesMutation.mutate({
          eventId,
          judgeIds: currentJudgeIds.filter((id: number) => id !== editingJudgeId),
        });
      }
    }

    if (mutationCount === 0) {
      toast({ title: "No changes", description: "No assignments were modified." });
      setEditDialogOpen(false);
      setEditingJudgeId(null);
    }
  };

  const filteredAndSortedJudges = useMemo(() => {
    let filtered = judges.filter(judge =>
      judge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      judge.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      judge.phone?.toLowerCase().includes(searchTerm.toLowerCase())
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
        case "phone":
          aValue = a.phone || "";
          bValue = b.phone || "";
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [judges, searchTerm, sortColumn, sortOrder]);

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

  const isLoading = judgesLoading || eventsLoading;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const editingJudge = judges.find(j => j.id === editingJudgeId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Judge Management</h1>
          <p className="text-muted-foreground">View judges and manage their event assignments</p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-card/50 to-card/30 border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                All Judges ({filteredAndSortedJudges.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV("judges.csv", ["Name", "Username", "Events", "Phone"], filteredAndSortedJudges.map((judge) => [
                    judge.name,
                    judge.username,
                    judge.assignedEvents?.map((e: any) => e.name).join(", ") || "",
                    judge.phone || "",
                  ]))
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-primary/20 focus:border-primary/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedJudges.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{judges.length === 0 ? "No judges found in the system." : "No judges match your search."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/30 bg-card/20">
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow className="border-primary/10 hover:bg-primary/5">
                    <SortHeader column="name" label="Name" />
                    <SortHeader column="username" label="Username" />
                    <SortHeader column="events" label="Events" />
                    <SortHeader column="phone" label="Phone" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedJudges.map((judge, idx) => (
                    <TableRow
                      key={judge.id}
                      data-testid={`row-judge-${judge.id}`}
                      className="border-border/30 hover:bg-primary/5 transition-colors duration-200 animate-in fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="font-semibold text-foreground">{judge.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary/20 text-foreground">
                          {judge.username}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {judge.assignedEvents && judge.assignedEvents.length > 0 ? (
                            <>
                              {judge.assignedEvents.slice(0, 2).map((event: any) => (
                                <Badge
                                  key={event.id}
                                  variant="outline"
                                  className="text-xs bg-blue/5 text-white dark:text-blue-300 border-blue/30"
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {event.name}
                                </Badge>
                              ))}
                              {judge.assignedEvents.length > 2 && (
                                <Badge variant="secondary" className="text-xs bg-muted/30">
                                  +{judge.assignedEvents.length - 2} more
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No events</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {judge.phone ? (
                          <span className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-mono text-muted-foreground">{judge.phone}</span>
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
                              data-testid={`button-delete-judge-${judge.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {judge.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this judge from the system. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteJudgeMutation.mutate(judge.id)}
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
                            setCredentialsJudge(judge);
                            setCredentialsOpen(true);
                          }}
                          data-testid={`button-credentials-judge-${judge.id}`}
                          className="hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                          title="Edit credentials"
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Credentials
                        </Button>
                        <Dialog open={editDialogOpen && editingJudgeId === judge.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditDialogOpen(false);
                            setEditingJudgeId(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(judge)}
                              data-testid={`button-edit-judge-${judge.id}`}
                              className="hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Assign Events to {editingJudge?.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-4">
                              {events.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No events available</p>
                              ) : (
                                events.map((event) => (
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
                                      data-testid={`checkbox-event-${event.id}`}
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
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {event.location}
                                          </span>
                                        </div>
                                      </div>
                                    </Label>
                                  </div>
                                ))
                              )}
                            </div>
                            <DialogFooter className="gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditDialogOpen(false);
                                  setEditingJudgeId(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSaveAssignments}
                                disabled={updateEventJudgesMutation.isPending}
                                className="bg-primary hover:bg-primary/90"
                                data-testid={`button-save-assignments-${judge.id}`}
                              >
                                {updateEventJudgesMutation.isPending ? "Saving..." : "Save Assignments"}
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
        user={credentialsJudge}
        open={credentialsOpen}
        onOpenChange={(open) => {
          setCredentialsOpen(open);
          if (!open) setCredentialsJudge(null);
        }}
        invalidateKeys={["/api/judges-with-events", "/api/judges"]}
      />
    </div>
  );
}
