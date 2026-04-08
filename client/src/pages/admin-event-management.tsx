import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Trash2, Edit, Calendar, MapPin, Users, Building, Clock, 
  GraduationCap, User, CheckCircle, XCircle, Copy, Download, Upload, FileText, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { formatDateIL, formatDateTimeIL } from "@/lib/format-date";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToCSV } from "@/lib/export-csv";
import { ImportFileButton } from "@/components/import-file-button";
import { importTemplates } from "@/lib/import-templates";
import { useToast } from "@/hooks/use-toast";
import type { Event, Team, Station, ScheduleSlot, User as UserType } from "@shared/schema";

export default function AdminEventManagement() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const queryClientHook = useQueryClient();

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: judges = [] } = useQuery<UserType[]>({
    queryKey: ["/api/judges"],
  });

  const { data: managers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/managers"],
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/events", selectedEventId, "teams"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/teams`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ["/api/events", selectedEventId, "stations"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/stations`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const { data: slots = [] } = useQuery<ScheduleSlot[]>({
    queryKey: ["/api/events", selectedEventId, "slots"],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/slots`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  if (eventsLoading) {
    return <div className="p-8 text-center">Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Event Management</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Select
            value={selectedEventId?.toString() || ""}
            onValueChange={(v) => setSelectedEventId(v ? Number(v) : null)}
          >
            <SelectTrigger className="w-full sm:w-64" data-testid="select-event">
              <SelectValue placeholder="Select an event to manage" />
            </SelectTrigger>
            <SelectContent>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id.toString()}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CreateEventDialog managers={managers} />
        </div>
      </div>

      {!selectedEventId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Select an event above to manage its teams, stations, judges, and slots.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 gap-1 h-auto text-xs sm:text-sm">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="judges" data-testid="tab-judges">Judges</TabsTrigger>
            <TabsTrigger value="teams" data-testid="tab-teams">Teams</TabsTrigger>
            <TabsTrigger value="stations" data-testid="tab-stations">Stations</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">Slots</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <EventOverviewTab event={selectedEvent!} managers={managers} />
          </TabsContent>

          <TabsContent value="judges">
            <JudgesTab eventId={selectedEventId} event={selectedEvent!} judges={judges} />
          </TabsContent>

          <TabsContent value="teams">
            <TeamsTab eventId={selectedEventId} teams={teams} />
          </TabsContent>

          <TabsContent value="stations">
            <StationsTab eventId={selectedEventId} stations={stations} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab 
              eventId={selectedEventId} 
              slots={slots} 
              teams={teams} 
              stations={stations} 
              judges={judges}
              eventJudgeIds={selectedEvent?.judgeIds || []}
              eventDate={selectedEvent?.date ? new Date(selectedEvent.date) : new Date()}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CreateEventDialog({ managers }: { managers: UserType[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const queryClientHook = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; note: string; date: Date; managerId?: number }) => {
      return apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events"] });
      setOpen(false);
      setName("");
      setLocation("");
      setNote("");
      setEventDate("");
      setManagerId("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-event">
          <Plus className="mr-2 h-4 w-4" /> New Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>Set up a new event for the Space Olympics</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Event Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Galactic Championship 2025"
              data-testid="input-event-name"
            />
          </div>
          <div>
            <Label>Event Date</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              data-testid="input-event-date"
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Mars Base Alpha"
              data-testid="input-event-location"
            />
          </div>
          <div>
            <Label>Assign Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger data-testid="select-event-manager">
                <SelectValue placeholder="Select a manager..." />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} ({m.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any notes about this event..."
              className="resize-none"
              rows={3}
              data-testid="input-event-note"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const date = eventDate ? new Date(eventDate + "T00:00:00") : new Date();
              createMutation.mutate({
                name, location, note, date,
                managerId: managerId ? parseInt(managerId) : undefined
              });
            }}
            disabled={!name || !eventDate || createMutation.isPending}
            data-testid="button-submit-event"
          >
            {createMutation.isPending ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventOverviewTab({ event, managers }: { event: Event; managers: UserType[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(event.name);
  const [location, setLocation] = useState(event.location || "");
  const [note, setNote] = useState(event.note || "");
  const [managerId, setManagerId] = useState<string>(event.managerId ? String(event.managerId) : "");
  const [eventDate, setEventDate] = useState(() => {
    return format(new Date(event.date), "yyyy-MM-dd");
  });
  const queryClientHook = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; note: string; date?: Date; managerId?: number | null }) => {
      return apiRequest("PUT", `/api/events/${event.id}`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/events/${event.id}`);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/events/${event.id}/duplicate`);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          Event Details
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setEditing(!editing)}
              data-testid="button-edit-event"
            >
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              data-testid="button-duplicate-event"
            >
              <Copy className="h-4 w-4 mr-1" /> {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                if (confirm("Delete this event? This cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              data-testid="button-delete-event"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="space-y-4">
            <div>
              <Label>Event Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-event-name" />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input 
                type="date"
                value={eventDate} 
                onChange={(e) => setEventDate(e.target.value)} 
                data-testid="input-edit-event-date"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-edit-event-location" />
            </div>
            <div>
              <Label>Assign Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger data-testid="select-edit-event-manager">
                  <SelectValue placeholder="No manager assigned" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} ({m.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any notes about this event..."
                className="resize-none"
                rows={3}
                data-testid="input-edit-event-note"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => updateMutation.mutate({ name, location, note, date: new Date(eventDate + "T00:00:00"), managerId: managerId ? parseInt(managerId) : null })} disabled={updateMutation.isPending} data-testid="button-save-event">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDateIL(event.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{event.location || "TBD"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${event.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{event.isActive ? 'Active' : 'Archived'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Manager</p>
                  <p className="font-medium">{event.managerId ? (managers.find(m => m.id === event.managerId)?.name || "Unknown") : "Not assigned"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Judges</p>
                  <p className="font-medium">{event.judgeIds?.length || 0} judges</p>
                </div>
              </div>
            </div>
            {event.note && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Note</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-event-note">{event.note}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JudgesTab({ eventId, event, judges }: { eventId: number; event: Event; judges: UserType[] }) {
  const queryClientHook = useQueryClient();
  const { toast } = useToast();
  const assignedJudgeIds = event.judgeIds || [];
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; errors: number; errorDetails: any[] } | null>(null);

  const updateJudgesMutation = useMutation({
    mutationFn: async (judgeIds: number[]) => {
      return apiRequest("PUT", `/api/events/${eventId}/judges`, { judgeIds });
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      try {
        // Error message format: "400: {json}"
        const jsonStr = msg.substring(msg.indexOf("{"));
        const data = JSON.parse(jsonStr);
        if (data.details?.length) {
          toast({ title: "Scheduling Conflict", description: data.details.join(". "), variant: "destructive" });
          return;
        }
      } catch { /* not JSON, fallback below */ }
      toast({ title: "Error", description: msg || "Failed to update judge assignments", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const res = await apiRequest("POST", "/api/import/judges", { data });
      return res.json();
    },
    onSuccess: (result) => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/judges"] });
      setImportResult(result);
      setCsvText("");
    },
  });

  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data = lines.slice(1).map(line => {
      const values = line.match(/("([^"]*)"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
      const row: any = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    }).filter(row => row.name || row.username);
    importMutation.mutate(data);
  };

  const toggleJudge = (judgeId: number) => {
    const isCurrentlyAssigned = assignedJudgeIds.includes(judgeId);
    if (isCurrentlyAssigned) {
      const judge = judges.find(j => j.id === judgeId);
      if (!confirm(`Are you sure you want to unassign ${judge?.name || 'this judge'} from the event?`)) {
        return;
      }
    }
    const newJudgeIds = isCurrentlyAssigned
      ? assignedJudgeIds.filter(id => id !== judgeId)
      : [...assignedJudgeIds, judgeId];
    updateJudgesMutation.mutate(newJudgeIds);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Judges
            </div>
            <div className="flex items-center gap-2">
              <ImportFileButton
                template={importTemplates.judges}
                requiredColumns={["name", "username", "email"]}
                onParsed={(rows) => importMutation.mutate(rows)}
                disabled={importMutation.isPending}
                testIdPrefix="import-judges-file"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowImport(!showImport); setImportResult(null); }}
                data-testid="button-import-judges"
              >
                <Upload className="h-4 w-4 mr-1" /> Paste CSV
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Import judges from an Excel/CSV file or paste CSV text. Required columns: name, username, email. Optional: phone, languages (semicolon-separated), restrictions. An invitation email will be sent to each judge automatically.
          </CardDescription>
        </CardHeader>
        {showImport && (
          <CardContent>
            <div className="space-y-3">
              <textarea
                className="w-full h-32 p-2 border rounded-md bg-background text-foreground font-mono text-sm"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"name,username,email,phone,languages,restrictions\nJohn Smith,john.smith,john@example.com,+1234567890,English;Hebrew,\nSarah Cohen,sarah.cohen,sarah@example.com,+0987654321,English;Arabic,Cannot judge on weekends"}
                data-testid="textarea-import-judges"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleImport} 
                  disabled={!csvText.trim() || importMutation.isPending}
                  data-testid="button-submit-import-judges"
                >
                  {importMutation.isPending ? "Importing..." : "Import Judges"}
                </Button>
                <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); setImportResult(null); }}>
                  Cancel
                </Button>
              </div>
              {importResult && (
                <div className="p-3 border rounded-md bg-muted/50 space-y-1">
                  <p className="font-medium" data-testid="text-import-result">
                    Imported {importResult.imported} judge{importResult.imported !== 1 ? 's' : ''} successfully.
                    {importResult.errors > 0 && ` ${importResult.errors} error${importResult.errors !== 1 ? 's' : ''}.`}
                  </p>
                  {importResult.errorDetails?.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">
                      Row "{err.row?.name || err.row?.username}": {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Assign Judges to Event
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const assigned = judges.filter(j => assignedJudgeIds.includes(j.id));
              exportToCSV("event-judges.csv",
                ["Name", "Phone", "Languages", "Status"],
                judges.map(j => [j.name, j.phone || "", (j.languages || []).join(", "), assignedJudgeIds.includes(j.id) ? "Assigned" : "Not Assigned"])
              );
            }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </CardTitle>
          <CardDescription>
            Select which judges will be available for this event. Assigned judges can then be assigned to specific slots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {judges.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No judges available in the system.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judge</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map(judge => {
                  const isAssigned = assignedJudgeIds.includes(judge.id);
                  return (
                    <TableRow
                      key={judge.id}
                      className={`cursor-pointer transition-colors ${isAssigned ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                      onClick={() => toggleJudge(judge.id)}
                      data-testid={`judge-row-${judge.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{judge.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {judge.languages?.join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {judge.phone || "—"}
                      </TableCell>
                      <TableCell>
                        {isAssigned ? (
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" /> Assigned
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <XCircle className="h-3 w-3 mr-1" /> Not Assigned
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamsTab({ eventId, teams }: { eventId: number; teams: Team[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("ElementarySchool");
  const [language, setLanguage] = useState("English");
  const [csvText, setCsvText] = useState("");
  const queryClientHook = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/teams`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest("POST", `/api/events/${eventId}/import/teams`, { data });
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      setShowImport(false);
      setCsvText("");
    },
  });

  const handleExport = () => {
    exportToCSV("teams.csv",
      ["Name", "School", "City", "Country", "Category", "Language"],
      teams.map(t => [t.name, t.schoolName, t.city || "", t.country || "", t.category, t.language])
    );
  };

  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data = lines.slice(1).map(line => {
      const values = line.match(/("([^"]*)"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
      const row: any = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });
    importMutation.mutate(data);
  };

  const resetForm = () => {
    setShowCreate(false);
    setEditingTeam(null);
    setName("");
    setSchoolName("");
    setCity("");
    setCountry("");
    setCategory("ElementarySchool");
    setLanguage("English");
  };

  const startEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setSchoolName(team.schoolName);
    setCity(team.city || "");
    setCountry(team.country || "");
    setCategory(team.category);
    setLanguage(team.language);
    setShowCreate(true);
  };

  const handleSubmit = () => {
    const data = { name, schoolName, city: city || null, country: country || null, category, language, eventId };
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Teams ({teams.length})
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-teams">
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <ImportFileButton
              template={importTemplates.teams}
              requiredColumns={["name", "schoolName", "category", "language"]}
              onParsed={(rows) => importMutation.mutate(rows)}
              disabled={importMutation.isPending}
              testIdPrefix="import-teams-file"
            />
            <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)} data-testid="button-import-teams">
              <Upload className="h-4 w-4 mr-1" /> Paste CSV
            </Button>
            <Button onClick={() => setShowCreate(true)} data-testid="button-add-team">
              <Plus className="h-4 w-4 mr-1" /> Add Team
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showImport && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <Label>Paste CSV Data (format: name,schoolName,city,category,language)</Label>
            <textarea
              className="w-full h-32 p-2 border rounded-md bg-background text-foreground font-mono text-sm"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="name,schoolName,city,category,language&#10;Apollo Juniors,Armstrong Elementary,Tel Aviv,ElementarySchool,English&#10;Curiosity Rovers,Gagarin Middle School,Haifa,MiddleSchool,English"
              data-testid="textarea-import-teams"
            />
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={!csvText.trim() || importMutation.isPending} data-testid="button-submit-import-teams">
                {importMutation.isPending ? "Importing..." : "Import Teams"}
              </Button>
              <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Team Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apollo Juniors" data-testid="input-team-name" />
              </div>
              <div>
                <Label>School Name</Label>
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Armstrong Elementary" data-testid="input-team-school" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tel Aviv" data-testid="input-team-city" />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Israel" data-testid="input-team-country" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-team-category">
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
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger data-testid="select-team-language">
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
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={!name || !schoolName || createMutation.isPending || updateMutation.isPending} data-testid="button-submit-team">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingTeam ? "Update Team" : "Add Team"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {teams.length === 0 && !showCreate ? (
          <p className="text-muted-foreground text-center py-8">No teams yet. Add your first team above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>School</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map(team => (
                <TableRow key={team.id} data-testid={`team-row-${team.id}`}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.schoolName}</TableCell>
                  <TableCell>{team.city || "—"}</TableCell>
                  <TableCell>{team.country || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{team.category}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{team.language}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(team)} data-testid={`button-edit-team-${team.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm("Delete this team?")) deleteMutation.mutate(team.id);
                        }}
                        data-testid={`button-delete-team-${team.id}`}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StationsTab({ eventId, stations }: { eventId: number; stations: Station[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [criteria, setCriteria] = useState<{ name: string; maxPoints: number; note: string }[]>([
    { name: "", maxPoints: 10, note: "" }
  ]);
  const [csvText, setCsvText] = useState("");
  const queryClientHook = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/stations`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "stations"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/stations/${id}`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "stations"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/stations/${id}`);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "stations"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return apiRequest("POST", `/api/events/${eventId}/import/stations`, { data });
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "stations"] });
      setShowImport(false);
      setCsvText("");
    },
  });

  const handleExport = () => {
    exportToCSV("stations.csv",
      ["Name", "Note", "Criteria", "Total Points"],
      stations.map(s => {
        const rubric = s.rubric as { criteria: { name: string; maxPoints: number }[] };
        const criteria = rubric?.criteria?.map(c => `${c.name} (${c.maxPoints})`).join(", ") || "";
        const totalPoints = rubric?.criteria?.reduce((sum, c) => sum + c.maxPoints, 0) || 0;
        return [s.name, s.note || "", criteria, String(totalPoints)];
      })
    );
  };

  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data = lines.slice(1).map(line => {
      const values = line.match(/("([^"]*)"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
      const row: any = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });
    importMutation.mutate(data);
  };

  const resetForm = () => {
    setShowCreate(false);
    setEditingStation(null);
    setName("");
    setNote("");
    setCriteria([{ name: "", maxPoints: 10, note: "" }]);
  };

  const startEdit = (station: Station) => {
    setEditingStation(station);
    setName(station.name);
    setNote(station.note || "");
    const rubric = station.rubric as { criteria: { name: string; maxPoints: number; note?: string }[] };
    setCriteria(rubric?.criteria?.map(c => ({ name: c.name, maxPoints: c.maxPoints, note: c.note || "" })) || [{ name: "", maxPoints: 10, note: "" }]);
    setShowCreate(true);
  };

  const handleSubmit = () => {
    const validCriteria = criteria.filter(c => c.name.trim()).map(c => ({
      name: c.name,
      maxPoints: c.maxPoints,
      ...(c.note.trim() ? { note: c.note.trim() } : {}),
    }));
    const data = { name, note: note.trim() || null, rubric: { criteria: validCriteria }, eventId };
    if (editingStation) {
      updateMutation.mutate({ id: editingStation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addCriteria = () => {
    setCriteria([...criteria, { name: "", maxPoints: 10, note: "" }]);
  };

  const updateCriteria = (index: number, field: "name" | "maxPoints" | "note", value: string | number) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Stations ({stations.length})
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-stations">
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <ImportFileButton
              template={importTemplates.stations}
              requiredColumns={["name", "rubric"]}
              onParsed={(rows) => importMutation.mutate(rows)}
              disabled={importMutation.isPending}
              testIdPrefix="import-stations-file"
            />
            <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)} data-testid="button-import-stations">
              <Upload className="h-4 w-4 mr-1" /> Paste CSV
            </Button>
            <Button onClick={() => setShowCreate(true)} data-testid="button-add-station">
              <Plus className="h-4 w-4 mr-1" /> Add Station
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showImport && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <Label>Paste CSV Data (format: name,rubric)</Label>
            <textarea
              className="w-full h-32 p-2 border rounded-md bg-background text-foreground font-mono text-sm"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'name,rubric\n"Rover Navigation","{""criteria"":[{""name"":""Speed"",""maxPoints"":10}]}"'}
              data-testid="textarea-import-stations"
            />
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={!csvText.trim() || importMutation.isPending} data-testid="button-submit-import-stations">
                {importMutation.isPending ? "Importing..." : "Import Stations"}
              </Button>
              <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <div>
              <Label>Station Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rover Navigation" data-testid="input-station-name" />
            </div>
            <div>
              <Label>Scoring Rubric</Label>
              <div className="space-y-2 mt-2">
                {criteria.map((c, i) => (
                  <div key={i} className="space-y-1 p-2 border rounded-md bg-background">
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="Criteria name" 
                        value={c.name} 
                        onChange={(e) => updateCriteria(i, "name", e.target.value)}
                        className="flex-1"
                        data-testid={`input-criteria-name-${i}`}
                      />
                      <Input 
                        type="number" 
                        placeholder="Max pts" 
                        value={c.maxPoints} 
                        onChange={(e) => updateCriteria(i, "maxPoints", Number(e.target.value))}
                        className="w-24"
                        data-testid={`input-criteria-points-${i}`}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeCriteria(i)} data-testid={`button-remove-criteria-${i}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input 
                      placeholder="Note for this criteria (optional)" 
                      value={c.note} 
                      onChange={(e) => updateCriteria(i, "note", e.target.value)}
                      className="text-sm"
                      data-testid={`input-criteria-note-${i}`}
                    />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCriteria} data-testid="button-add-criteria">
                  <Plus className="h-3 w-3 mr-1" /> Add Criteria
                </Button>
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for this station" data-testid="input-station-note" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={!name || createMutation.isPending || updateMutation.isPending} data-testid="button-submit-station">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingStation ? "Update Station" : "Add Station"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {stations.length === 0 && !showCreate ? (
          <p className="text-muted-foreground text-center py-8">No stations yet. Add your first station above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Rubric</TableHead>
                <TableHead>Total Points</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map(station => {
                const rubric = station.rubric as { criteria: { name: string; maxPoints: number; note?: string }[] };
                const totalPoints = rubric?.criteria?.reduce((sum, c) => sum + c.maxPoints, 0) || 0;
                return (
                  <TableRow key={station.id} data-testid={`station-row-${station.id}`}>
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell>
                      {station.note ? (
                        <span className="text-sm text-muted-foreground" data-testid={`station-note-${station.id}`}>{station.note}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rubric?.criteria?.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {c.name}: {c.maxPoints}pts
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{totalPoints}pts</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(station)} data-testid={`button-edit-station-${station.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm("Delete this station?")) deleteMutation.mutate(station.id);
                          }}
                          data-testid={`button-delete-station-${station.id}`}
                        >
                          {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleTab({ 
  eventId, slots, teams, stations, judges, eventJudgeIds, eventDate 
}: { 
  eventId: number; 
  slots: ScheduleSlot[]; 
  teams: Team[]; 
  stations: Station[]; 
  judges: UserType[];
  eventJudgeIds: number[];
  eventDate: Date;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [stationId, setStationId] = useState<number | null>(null);
  const [judgeIds, setJudgeIds] = useState<number[]>([]);
  const [captainJudgeId, setCaptainJudgeId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [csvText, setCsvText] = useState("");
  const queryClientHook = useQueryClient();
  const { toast } = useToast();

  const availableJudges = judges.filter(j => eventJudgeIds.includes(j.id));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/slots`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "slots"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/slots/${id}`, data);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "slots"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/slots/${id}`);
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/events", eventId, "slots"] });
    },
  });

  const resetForm = () => {
    setShowCreate(false);
    setEditingSlot(null);
    setTeamId(null);
    setStationId(null);
    setJudgeIds([]);
    setCaptainJudgeId(null);
    setStartTime("");
    setDuration(30);
  };

  const extractTime = (dateVal: string | Date) => {
    const d = new Date(dateVal);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const startEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setTeamId(slot.teamId);
    setStationId(slot.stationId);
    setJudgeIds(slot.judgeIds || []);
    setCaptainJudgeId(slot.captainJudgeId || null);
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    setDuration(dur);
    setStartTime(extractTime(start));
    setShowCreate(true);
  };

  const duplicateSlot = (slot: ScheduleSlot) => {
    setEditingSlot(null);
    setTeamId(slot.teamId);
    setStationId(slot.stationId);
    setJudgeIds(slot.judgeIds || []);
    setCaptainJudgeId(slot.captainJudgeId || null);
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    setDuration(dur);
    setStartTime(extractTime(start));
    setShowCreate(true);
  };

  const combineDateTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const combined = new Date(eventDate);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  };

  const handleSubmit = () => {
    const start = combineDateTime(startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const data = {
      eventId,
      teamId,
      stationId,
      judgeIds,
      captainJudgeId: captainJudgeId || judgeIds[0],
      startTime: start,
      endTime: end,
    };
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      toast({ title: "Invalid CSV format", variant: "destructive" });
      return;
    }
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
    let imported = 0;
    let errors: string[] = [];
    const rows = lines.slice(1);
    for (let i = 0; i < rows.length; i++) {
      const values = rows[i].match(/("([^"]*)"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
      const team = teams.find(t => t.name.toLowerCase() === (row.team || "").toLowerCase());
      const station = stations.find(s => s.name.toLowerCase() === (row.station || "").toLowerCase());
      if (!team) { errors.push(`Row ${i + 2}: Team "${row.team}" not found`); continue; }
      if (!station) { errors.push(`Row ${i + 2}: Station "${row.station}" not found`); continue; }
      if (!row.starttime && !row["start time"] && !row.start_time) { errors.push(`Row ${i + 2}: Missing start time`); continue; }
      const timeVal = row.starttime || row["start time"] || row.start_time;
      const durationVal = Number(row.duration) || 30;
      const timeMatch = timeVal.match(/^(\d{1,2}):(\d{2})$/);
      let start: Date;
      if (timeMatch) {
        start = new Date(eventDate);
        start.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      } else {
        start = new Date(timeVal);
      }
      if (isNaN(start.getTime())) { errors.push(`Row ${i + 2}: Invalid start time "${timeVal}"`); continue; }
      const end = new Date(start.getTime() + durationVal * 60 * 1000);
      const judgeNames = (row.judges || "").split(";").map((n: string) => n.trim()).filter(Boolean);
      const matchedJudgeIds = judgeNames.map((n: string) => {
        const j = availableJudges.find(j => j.name?.toLowerCase() === n.toLowerCase());
        return j?.id;
      }).filter(Boolean) as number[];
      createMutation.mutate({
        eventId,
        teamId: team.id,
        stationId: station.id,
        judgeIds: matchedJudgeIds,
        captainJudgeId: matchedJudgeIds[0] || null,
        startTime: start,
        endTime: end,
      });
      imported++;
    }
    if (errors.length > 0) {
      toast({ title: `Imported ${imported} slots with ${errors.length} errors`, description: errors.slice(0, 3).join("; "), variant: "destructive" });
    } else {
      toast({ title: `Successfully imported ${imported} slots` });
    }
    setCsvText("");
    setShowImport(false);
  };

  const toggleJudge = (id: number) => {
    setJudgeIds(prev => 
      prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Slots ({slots.length})
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              exportToCSV("schedule.csv",
                ["Time", "Team", "Station", "Judges", "Captain"],
                slots.map(s => {
                  const team = teams.find(t => t.id === s.teamId);
                  const station = stations.find(st => st.id === s.stationId);
                  const slotJudges = (s.judgeIds || []).map(id => judges.find(j => j.id === id)?.name || "").filter(Boolean);
                  const captain = s.captainJudgeId ? judges.find(j => j.id === s.captainJudgeId)?.name || "" : "";
                  return [
                    `${format(new Date(s.startTime), "HH:mm")} - ${format(new Date(s.endTime), "HH:mm")}`,
                    team?.name || "", station?.name || "", slotJudges.join(", "), captain
                  ];
                })
              );
            }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)} data-testid="button-import-slots">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
            <Button onClick={() => { resetForm(); setShowCreate(true); }} data-testid="button-add-slot">
              <Plus className="h-4 w-4 mr-1" /> Add Slot
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Assign a team to a station with judges at a specific time. Date is taken from the event ({format(eventDate, "MMMM d, yyyy")}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showImport && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <Label>Paste CSV Data (format: team,station,startTime,duration,judges)</Label>
            <textarea
              className="w-full h-32 p-2 border rounded-md bg-background text-foreground font-mono text-sm"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'team,station,startTime,duration,judges\n"Alpha Team","Rover Navigation","09:00",30,"Judge A;Judge B"'}
              data-testid="textarea-import-slots"
            />
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={!csvText.trim() || createMutation.isPending} data-testid="button-submit-import-slots">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {createMutation.isPending ? "Importing..." : "Import Slots"}
              </Button>
              <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="mb-4 p-4 border rounded-md space-y-3 bg-muted/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Team</Label>
                <Select value={teamId?.toString() || ""} onValueChange={(v) => setTeamId(Number(v))}>
                  <SelectTrigger data-testid="select-slot-team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Station</Label>
                <Select value={stationId?.toString() || ""} onValueChange={(v) => setStationId(Number(v))}>
                  <SelectTrigger data-testid="select-slot-station">
                    <SelectValue placeholder="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Input 
                  type="time" 
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)}
                  data-testid="input-slot-start-time"
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(Number(e.target.value))}
                  data-testid="input-slot-duration"
                />
              </div>
            </div>
            <div>
              <Label>Assign Judges</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {availableJudges.map(j => (
                  <Badge 
                    key={j.id}
                    variant={judgeIds.includes(j.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleJudge(j.id)}
                    data-testid={`badge-judge-${j.id}`}
                  >
                    {j.name}
                  </Badge>
                ))}
                {availableJudges.length === 0 && (
                  <p className="text-sm text-muted-foreground">No judges assigned to this event. Assign judges in the Judges tab first.</p>
                )}
              </div>
            </div>
            {judgeIds.length > 1 && (
              <div>
                <Label>Captain Judge</Label>
                <Select value={captainJudgeId?.toString() || ""} onValueChange={(v) => setCaptainJudgeId(Number(v))}>
                  <SelectTrigger data-testid="select-captain-judge">
                    <SelectValue placeholder="Select captain" />
                  </SelectTrigger>
                  <SelectContent>
                    {judgeIds.map(id => {
                      const judge = judges.find(j => j.id === id);
                      return <SelectItem key={id} value={id.toString()}>{judge?.name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={handleSubmit} 
                disabled={!teamId || !stationId || !startTime || judgeIds.length === 0 || createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-slot"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingSlot ? "Update Slot" : "Create Slot"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          {slots.length === 0 && !showCreate ? (
            <p className="text-muted-foreground text-center py-8">
              No slots yet. Create teams and stations first, then add slots.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Judges</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(slot => {
                  const team = teams.find(t => t.id === slot.teamId);
                  const station = stations.find(s => s.id === slot.stationId);
                  const slotJudges = judges.filter(j => slot.judgeIds?.includes(j.id));

                  return (
                    <TableRow key={slot.id} data-testid={`slot-row-${slot.id}`}>
                      <TableCell>
                        <Badge variant="outline">{format(new Date(slot.startTime), "HH:mm")} - {format(new Date(slot.endTime), "HH:mm")}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{team?.name || "Unknown Team"}</TableCell>
                      <TableCell>{station?.name || "Unknown Station"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {slotJudges.map(j => (
                            <Badge key={j.id} variant="secondary" className="text-xs">
                              {j.name} {j.id === slot.captainJudgeId && "(Captain)"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(slot)}
                            data-testid={`button-edit-slot-${slot.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateSlot(slot)}
                            data-testid={`button-duplicate-slot-${slot.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm("Delete this slot?")) deleteMutation.mutate(slot.id);
                            }}
                            data-testid={`button-delete-slot-${slot.id}`}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
