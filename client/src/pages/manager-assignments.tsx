import { useState, useMemo, useEffect } from "react";
import { useManagerEvent } from "@/contexts/manager-event-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Calendar, MapPin, AlertTriangle, Edit2, UserCheck } from "lucide-react";
import type { User, Team, ScheduleSlot, Station, Event } from "@shared/schema";
import { api } from "@shared/routes";

export default function ManagerAssignments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedEventId, setSelectedEventId } = useManagerEvent();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<number[]>([]);

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

  const { data: judges = [], isLoading: judgesLoading } = useQuery<User[]>({
    queryKey: ["/api/judges"],
  });

  const isDataLoading = teamsLoading || stationsLoading || slotsLoading || judgesLoading;

  const updateSlotMutation = useMutation({
    mutationFn: async ({ slotId, judgeIds, captainJudgeId }: { slotId: number; judgeIds: number[]; captainJudgeId?: number }) => {
      return apiRequest("PUT", `/api/slots/${slotId}`, { judgeIds, captainJudgeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", activeEvent?.id, "slots"] });
      toast({ title: "Assignment Updated", description: "Judges have been assigned to the slot." });
      setAssignDialogOpen(false);
      setSelectedSlot(null);
      setSelectedJudgeIds([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update assignment", variant: "destructive" });
    },
  });

  const openAssignDialog = (slot: ScheduleSlot) => {
    setSelectedSlot(slot);
    setSelectedJudgeIds(slot.judgeIds || []);
    setAssignDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedSlot) return;
    updateSlotMutation.mutate({
      slotId: selectedSlot.id,
      judgeIds: selectedJudgeIds,
      captainJudgeId: selectedJudgeIds[0],
    });
  };

  const getTeamById = (id: number) => teams.find((t) => t.id === id);
  const getStationById = (id: number) => stations.find((s) => s.id === id);
  const getJudgeById = (id: number) => judges.find((j) => j.id === id);

  const slotsByTeam = useMemo(() => {
    const grouped: Record<number, ScheduleSlot[]> = {};
    slots.forEach((slot) => {
      if (!grouped[slot.teamId]) grouped[slot.teamId] = [];
      grouped[slot.teamId].push(slot);
    });
    return grouped;
  }, [slots]);

  if (eventsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading events...</div>;
  }

  if (eventsError) {
    return <div className="p-8 text-center text-destructive">Failed to load events. Please try again.</div>;
  }

  if (events.length === 0) {
    return (
      <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <Calendar className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-bold">No Assigned Events</h3>
          <p className="text-muted-foreground">You have not been assigned to manage any events.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Team Assignments</h1>
          <p className="text-muted-foreground">Assign judges to teams for each station</p>
        </div>
      </div>

      {activeEvent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {activeEvent.name} - Team Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDataLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading assignment data...</div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No teams in this event yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Category</TableHead>
                    {stations.map((station) => (
                      <TableHead key={station.id} className="text-center">
                        {station.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id} data-testid={`row-team-${team.id}`}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.schoolName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{team.category}</Badge>
                      </TableCell>
                      {stations.map((station) => {
                        const teamSlots = slotsByTeam[team.id] || [];
                        const slot = teamSlots.find((s) => s.stationId === station.id);
                        
                        return (
                          <TableCell key={station.id} className="text-center">
                            {slot ? (
                              <div className="space-y-1">
                                {slot.judgeIds && slot.judgeIds.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {slot.judgeIds.map((jId) => {
                                      const judge = getJudgeById(jId);
                                      return (
                                        <Badge key={jId} variant="secondary" className="text-xs">
                                          {judge?.name?.split(" ")[0] || `Judge ${jId}`}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500">
                                    Unassigned
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openAssignDialog(slot)}
                                  data-testid={`button-assign-${slot.id}`}
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No slot</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Assign Judges
            </DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{getTeamById(selectedSlot.teamId)?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Station: {getStationById(selectedSlot.stationId)?.name}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Select Judges</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {judges.map((judge) => (
                    <div
                      key={judge.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`judge-${judge.id}`}
                        checked={selectedJudgeIds.includes(judge.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedJudgeIds([...selectedJudgeIds, judge.id]);
                          } else {
                            setSelectedJudgeIds(selectedJudgeIds.filter((id) => id !== judge.id));
                          }
                        }}
                        data-testid={`checkbox-judge-${judge.id}`}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`judge-${judge.id}`} className="font-medium cursor-pointer">
                          {judge.name}
                        </Label>
                        {judge.languages && judge.languages.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {judge.languages.map((lang) => (
                              <Badge key={lang} variant="outline" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(judge as any).restrictions && (
                          <div className="flex items-center gap-1 mt-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">{(judge as any).restrictions}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={updateSlotMutation.isPending}
              data-testid="button-confirm-assign"
            >
              Assign Judges
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
