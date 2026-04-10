import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, CheckCircle, Clock, AlertCircle, XCircle, Plus, Upload, Download, Pencil, Trash2, Loader2, Search, ArrowUpDown } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import { ImportFileButton } from "@/components/import-file-button";
import { importTemplates } from "@/lib/import-templates";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Team, ScheduleSlot, Station, Event, Score } from "@shared/schema";
import { api } from "@shared/routes";

type SortColumn = "name" | "school" | "country" | "category" | "language" | "progress";
type SortOrder = "asc" | "desc";

export default function ManagerTeamTracking() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [csvText, setCsvText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [teamForm, setTeamForm] = useState({
    name: "",
    schoolName: "",
    city: "",
    country: "",
    category: "ElementarySchool",
    language: "English",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch(api.events.list.path);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const activeEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/events", activeEvent?.id, "teams"],
    queryFn: async () => {
      const res = await fetch(api.teams.list.path.replace(":eventId", String(activeEvent?.id)));
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    enabled: !!activeEvent?.id,
  });

  const { data: stations = [], isLoading: stationsLoading } = useQuery<Station[]>({
    queryKey: ["/api/events", activeEvent?.id, "stations"],
    queryFn: async () => {
      const res = await fetch(api.stations.list.path.replace(":eventId", String(activeEvent?.id)));
      if (!res.ok) throw new Error("Failed to fetch stations");
      return res.json();
    },
    enabled: !!activeEvent?.id,
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<ScheduleSlot[]>({
    queryKey: ["/api/events", activeEvent?.id, "slots"],
    queryFn: async () => {
      const res = await fetch(api.slots.list.path.replace(":eventId", String(activeEvent?.id)));
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: !!activeEvent?.id,
  });

  const { data: scores = [], isLoading: scoresLoading } = useQuery<Score[]>({
    queryKey: ["/api/events", activeEvent?.id, "scores"],
    queryFn: async () => {
      const res = await fetch(api.scores.list.path.replace(":eventId", String(activeEvent?.id)));
      if (!res.ok) throw new Error("Failed to fetch scores");
      return res.json();
    },
    enabled: !!activeEvent?.id,
  });

  const isDataLoading = teamsLoading || stationsLoading || slotsLoading || scoresLoading;

  const createTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", activeEvent?.id, "teams"] });
      setShowAddTeam(false);
      resetForm();
      toast({ title: "Team created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create team", variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", activeEvent?.id, "teams"] });
      setEditingTeam(null);
      resetForm();
      toast({ title: "Team updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update team", variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", activeEvent?.id, "teams"] });
      toast({ title: "Team deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete team", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest("POST", `/api/events/${activeEvent?.id}/import/teams`, { data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", activeEvent?.id, "teams"] });
      setShowImport(false);
      setCsvText("");
      toast({ title: "Teams imported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to import teams", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTeamForm({ name: "", schoolName: "", city: "", country: "", category: "ElementarySchool", language: "English" });
  };

  const handleCreateTeam = () => {
    if (!teamForm.name.trim() || !activeEvent?.id) return;
    createTeamMutation.mutate({ ...teamForm, eventId: activeEvent.id });
  };

  const handleUpdateTeam = () => {
    if (!editingTeam || !teamForm.name.trim()) return;
    updateTeamMutation.mutate({ id: editingTeam.id, data: teamForm });
  };

  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      toast({ title: "Invalid CSV format", variant: "destructive" });
      return;
    }
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data = lines.slice(1).map(line => {
      const values = line.match(/("([^"]*)"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
      const row: any = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });
    importMutation.mutate(data);
  };

  const handleExport = () => {
    window.open(`/api/events/${activeEvent?.id}/export/teams`, "_blank");
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      schoolName: team.schoolName || "",
      city: team.city || "",
      country: team.country || "",
      category: team.category || "ElementarySchool",
      language: team.language || "English",
    });
  };

  const teamStats = useMemo(() => {
    return teams.map((team) => {
      const teamSlots = slots.filter((s) => s.teamId === team.id);
      const totalStations = stations.length;
      const scoredStations = new Set(
        scores.filter((s) => s.teamId === team.id).map((s) => s.stationId)
      ).size;
      
      const stationStatuses = stations.map((station) => {
        const slot = teamSlots.find((s) => s.stationId === station.id);
        const hasScore = scores.some((s) => s.teamId === team.id && s.stationId === station.id);
        
        let status: "complete" | "pending" | "behind" | "no-slot" = "no-slot";
        if (slot) {
          if (hasScore) {
            status = "complete";
          } else if (slot.status === "behind") {
            status = "behind";
          } else {
            status = "pending";
          }
        }
        
        return {
          station,
          slot,
          status,
          hasScore,
        };
      });

      const progressPercent = totalStations > 0 ? (scoredStations / totalStations) * 100 : 0;

      return {
        team,
        stationStatuses,
        scoredStations,
        totalStations,
        progressPercent,
      };
    });
  }, [teams, slots, scores, stations]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "behind":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      ElementarySchool: "Elementary",
      MiddleSchool: "Middle",
      HighSchool: "High School",
    };
    return labels[category] || category;
  };

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

  const filteredAndSortedTeams = useMemo(() => {
    let filtered = teamStats.filter(
      (stat) =>
        stat.team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stat.team.schoolName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stat.team.country || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stat.team.category || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal: any = a.team[sortColumn];
      let bVal: any = b.team[sortColumn];

      if (sortColumn === "progress") {
        aVal = a.progressPercent;
        bVal = b.progressPercent;
      } else if (sortColumn === "country") {
        aVal = a.team.country || "";
        bVal = b.team.country || "";
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [teamStats, searchTerm, sortColumn, sortOrder]);

  if (eventsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading events...</div>;
  }

  if (eventsError) {
    return <div className="p-8 text-center text-destructive">Failed to load events. Please try again.</div>;
  }

  if (events.length === 0) {
    return (
      <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
        <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-bold">No Assigned Events</h3>
        <p className="text-muted-foreground">You have not been assigned to manage any events.</p>
      </Card>
    );
  }

  const TeamFormFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="team-name">Team Name</Label>
        <Input
          id="team-name"
          value={teamForm.name}
          onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
          placeholder="Enter team name"
          data-testid="input-team-name"
        />
      </div>
      <div>
        <Label htmlFor="school-name">School Name</Label>
        <Input
          id="school-name"
          value={teamForm.schoolName}
          onChange={(e) => setTeamForm({ ...teamForm, schoolName: e.target.value })}
          placeholder="Enter school name"
          data-testid="input-school-name"
        />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={teamForm.city}
          onChange={(e) => setTeamForm({ ...teamForm, city: e.target.value })}
          placeholder="Enter city"
          data-testid="input-city"
        />
      </div>
      <div>
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={teamForm.country}
          onChange={(e) => setTeamForm({ ...teamForm, country: e.target.value })}
          placeholder="Enter country"
          data-testid="input-country"
        />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Select value={teamForm.category} onValueChange={(v) => setTeamForm({ ...teamForm, category: v })}>
          <SelectTrigger id="category" data-testid="select-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ElementarySchool">Elementary School</SelectItem>
            <SelectItem value="MiddleSchool">Middle School</SelectItem>
            <SelectItem value="HighSchool">High School</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="language">Language</Label>
        <Select value={teamForm.language} onValueChange={(v) => setTeamForm({ ...teamForm, language: v })}>
          <SelectTrigger id="language" data-testid="select-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Hebrew">Hebrew</SelectItem>
            <SelectItem value="Arabic">Arabic</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Team Tracking</h1>
          <p className="text-muted-foreground">Monitor judging status and manage teams</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-team">
                <Plus className="h-4 w-4 mr-2" />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
                <DialogDescription>Enter the team details below to add a new team to this event.</DialogDescription>
              </DialogHeader>
              <TeamFormFields />
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => { setShowAddTeam(false); resetForm(); }} data-testid="button-cancel-add">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTeam} 
                  disabled={!teamForm.name.trim() || createTeamMutation.isPending}
                  data-testid="button-submit-team"
                >
                  {createTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <ImportFileButton
            template={importTemplates.teams}
            requiredColumns={["name", "schoolName", "category", "language"]}
            onParsed={(rows) => importMutation.mutate(rows)}
            disabled={importMutation.isPending}
            testIdPrefix="import-teams-file"
          />

          <Dialog open={showImport} onOpenChange={setShowImport}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-teams">
                <Upload className="h-4 w-4 mr-2" />
                Paste CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Teams from CSV</DialogTitle>
                <DialogDescription>Paste CSV data to import multiple teams at once.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Paste CSV Data</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Format: name,schoolName,category,language
                  </p>
                  <textarea
                    className="w-full h-40 p-3 border rounded-md bg-background text-foreground font-mono text-sm"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="name,schoolName,city,category,language&#10;Apollo Juniors,Armstrong Elementary,Tel Aviv,ElementarySchool,English&#10;Curiosity Rovers,Gagarin Middle School,Haifa,MiddleSchool,English"
                    data-testid="textarea-import-csv"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); }} data-testid="button-cancel-import">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={!csvText.trim() || importMutation.isPending}
                    data-testid="button-submit-import"
                  >
                    {importMutation.isPending ? "Importing..." : "Import Teams"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExport} data-testid="button-export-teams">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {activeEvent && isDataLoading && (
        <div className="p-8 text-center text-muted-foreground">Loading team data...</div>
      )}

      {activeEvent && !isDataLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{teams.length}</div>
                <p className="text-sm text-muted-foreground">Total Teams</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">
                  {teamStats.filter((t) => t.progressPercent === 100).length}
                </div>
                <p className="text-sm text-muted-foreground">Fully Scored</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-500">
                  {teamStats.filter((t) => t.progressPercent > 0 && t.progressPercent < 100).length}
                </div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-500">
                  {teamStats.filter((t) => t.progressPercent === 0).length}
                </div>
                <p className="text-sm text-muted-foreground">Not Started</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Teams ({filteredAndSortedTeams.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToCSV("team-tracking.csv", ["Team", "School", "Country", "Category", "Language", "Progress"], filteredAndSortedTeams.map(({ team, scoredStations, totalStations, progressPercent }) => [
                        team.name,
                        team.schoolName || "",
                        team.country || "",
                        getCategoryLabel(team.category || ""),
                        team.language || "",
                        `${scoredStations}/${totalStations} (${Math.round(progressPercent)}%)`,
                      ]))
                    }
                  >
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by team, school, or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No teams yet. Add teams manually or import from CSV.</p>
                </div>
              ) : filteredAndSortedTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No teams match your search.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <SortHeader column="name" label="Team Name" />
                        <SortHeader column="school" label="School" />
                        <SortHeader column="country" label="Country" />
                        <SortHeader column="category" label="Category" />
                        <SortHeader column="language" label="Language" />
                        <SortHeader column="progress" label="Progress" />
                        {stations.map((station) => (
                          <TableHead key={station.id} className="text-center">
                            {station.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedTeams.map(({ team, stationStatuses, scoredStations, totalStations, progressPercent }, idx) => (
                        <TableRow 
                          key={team.id} 
                          data-testid={`row-team-${team.id}`}
                          className="animate-in fade-in duration-300"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell className="text-muted-foreground">{team.schoolName || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{team.country || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{getCategoryLabel(team.category || "")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{team.language || "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-40">
                              <Progress value={progressPercent} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                                {scoredStations}/{totalStations}
                              </span>
                            </div>
                          </TableCell>
                          {stationStatuses.map(({ station, status }) => (
                            <TableCell key={station.id} className="text-center">
                              <div className="flex justify-center">
                                {getStatusIcon(status)}
                              </div>
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => openEditDialog(team)}
                                data-testid={`button-edit-team-${team.id}`}
                                className="hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                disabled={deleteTeamMutation.isPending}
                                onClick={() => deleteTeamMutation.mutate(team.id)}
                                data-testid={`button-delete-team-${team.id}`}
                                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                {deleteTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
        </>
      )}

      <Dialog open={!!editingTeam} onOpenChange={(open) => { if (!open) { setEditingTeam(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update the team information below.</DialogDescription>
          </DialogHeader>
          <TeamFormFields />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => { setEditingTeam(null); resetForm(); }} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTeam} 
              disabled={!teamForm.name.trim() || updateTeamMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {updateTeamMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
