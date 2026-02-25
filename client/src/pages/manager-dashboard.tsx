import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScores } from "@/hooks/use-scores";
import { useTeams } from "@/hooks/use-teams";
import { useStations } from "@/hooks/use-stations";
import { useSlots } from "@/hooks/use-slots";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Calendar, AlertCircle, Edit2, Clock, MessageSquare, Send, User, Loader2, MapPin, Users, Star, School, Phone, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScoringMatrix } from "@/components/scoring-matrix";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType, ScheduleSlot, Station } from "@shared/schema";

const SLOT_COLORS = [
  "bg-blue-500/15 border-blue-500/30",
  "bg-purple-500/15 border-purple-500/30",
  "bg-emerald-500/15 border-emerald-500/30",
  "bg-amber-500/15 border-amber-500/30",
  "bg-rose-500/15 border-rose-500/30",
  "bg-cyan-500/15 border-cyan-500/30",
  "bg-indigo-500/15 border-indigo-500/30",
  "bg-orange-500/15 border-orange-500/30",
];

function getStationColor(stationId: number) {
  return SLOT_COLORS[stationId % SLOT_COLORS.length];
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const { data: managerEvents, isLoading } = useQuery({
    queryKey: [`/api/events`],
    queryFn: async () => {
      const res = await fetch(api.events.list.path);
      if (!res.ok) throw new Error("Failed to fetch events");
      const allEvents = await res.json();
      return allEvents.filter((e: any) => e.managerId === user?.id);
    },
  });

  const activeEvent = useMemo(() => {
    if (!selectedEventId && managerEvents?.length) {
      setSelectedEventId(managerEvents[0].id);
      return managerEvents[0];
    }
    return managerEvents?.find((e: any) => e.id === selectedEventId);
  }, [managerEvents, selectedEventId]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading your event...</div>;

  if (!managerEvents?.length) {
    return (
      <Card className="border-dashed border-2 border-muted p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Calendar size={32} />
          </div>
          <h3 className="text-xl font-bold">No Assigned Events</h3>
          <p className="text-muted-foreground max-w-sm">
            You have not been assigned to manage any events yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Event Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-event-name">
              {activeEvent?.name}
            </h1>
            {managerEvents.length > 1 && (
              <Select
                value={selectedEventId?.toString() || ""}
                onValueChange={(val) => setSelectedEventId(Number(val))}
              >
                <SelectTrigger className="w-48" data-testid="select-event">
                  <SelectValue placeholder="Switch event" />
                </SelectTrigger>
                <SelectContent>
                  {managerEvents.map((e: any) => (
                    <SelectItem key={e.id} value={e.id.toString()} data-testid={`option-event-${e.id}`}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {activeEvent && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(activeEvent.date).toLocaleDateString()}
              </span>
              {activeEvent.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {activeEvent.location}
                </span>
              )}
            </div>
          )}
        </div>
        <Link href="/leaderboard">
          <Button variant="outline" data-testid="button-view-results">
            <Star className="mr-2 h-4 w-4" /> View Results
          </Button>
        </Link>
      </div>

      {activeEvent && (
        <UnifiedEventView eventId={activeEvent.id} eventName={activeEvent.name} />
      )}
    </div>
  );
}

function UnifiedEventView({ eventId, eventName }: { eventId: number; eventName: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: scores } = useScores(eventId);
  const { data: teams } = useTeams(eventId);
  const { data: stations } = useStations(eventId);
  const { data: slots } = useSlots(eventId);

  const { data: allJudges = [] } = useQuery({
    queryKey: ["/api/judges"],
    queryFn: async () => {
      const res = await fetch("/api/judges");
      if (!res.ok) throw new Error("Failed to fetch judges");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: allEvents } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const currentEvent = allEvents?.find((e: any) => e.id === eventId);

  const scoreList = scores || [];
  const teamList = teams || [];
  const stationList = stations || [];
  const slotList = slots || [];

  const totalExpected = teamList.length * stationList.length;
  const completedCount = scoreList.length;
  const progress = totalExpected > 0 ? (completedCount / totalExpected) * 100 : 0;

  const judgeMap = useMemo(() => {
    const map = new Map<number, any>();
    allJudges.forEach((j: any) => map.set(j.id, j));
    return map;
  }, [allJudges]);

  const teamMap = useMemo(() => {
    const map = new Map<number, any>();
    teamList.forEach((t: any) => map.set(t.id, t));
    return map;
  }, [teamList]);

  const stationMap = useMemo(() => {
    const map = new Map<number, any>();
    stationList.forEach((s: any) => map.set(s.id, s));
    return map;
  }, [stationList]);

  const slotsByTime = useMemo(() => {
    const grouped = new Map<string, any[]>();
    const sortedSlots = [...slotList].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    sortedSlots.forEach((slot) => {
      const timeKey = new Date(slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (!grouped.has(timeKey)) grouped.set(timeKey, []);
      grouped.get(timeKey)!.push(slot);
    });
    return grouped;
  }, [slotList]);

  const judgeStatus = useMemo(() => {
    const judgeIds = new Set<number>();
    slotList.forEach((slot) => {
      slot.judgeIds?.forEach((id: number) => judgeIds.add(id));
    });
    return Array.from(judgeIds).map((judgeId) => {
      const judge = judgeMap.get(judgeId);
      const slotsForJudge = slotList.filter((s) => s.judgeIds?.includes(judgeId));
      const completedForJudge = slotsForJudge.filter((s) =>
        scoreList.some((sc) => sc.slotId === s.id && sc.judgeId === judgeId)
      ).length;
      const isBehind = slotsForJudge.some((s) => {
        const now = new Date();
        return new Date(s.endTime) < now && !scoreList.some((sc) => sc.slotId === s.id && sc.judgeId === judgeId);
      });
      return {
        id: judgeId,
        name: judge?.name || judge?.username || `Judge ${judgeId}`,
        username: judge?.username || "",
        phone: judge?.phone || "",
        assigned: slotsForJudge.length,
        completed: completedForJudge,
        isBehind,
      };
    });
  }, [slotList, scoreList, judgeMap]);

  // Judge management state
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<number[]>([]);
  const [selectedJudge, setSelectedJudge] = useState<any | null>(null);
  const [message, setMessage] = useState("Ensure your scores are up to date");
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);

  const { mutate: updateJudges, isPending: isUpdatingJudges } = useMutation({
    mutationFn: async (judgeIds: number[]) => {
      const res = await fetch(`/api/events/${eventId}/judges`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update judges");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsManageOpen(false);
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ judgeId, message }: { judgeId: number; message: string }) => {
      return apiRequest("POST", `/api/notifications/send`, { judgeId, message });
    },
    onSuccess: () => {
      toast({ title: "Notification Sent", description: `Message sent to ${selectedJudge?.username || selectedJudge?.name}` });
      setNotifyDialogOpen(false);
      setMessage("Ensure your scores are up to date");
    },
    onError: () => {
      toast({ title: "Notification Failed", description: "Could not send notification. SMS not configured.", variant: "destructive" });
    },
  });

  const handleManageOpen = (open: boolean) => {
    if (open) setSelectedJudgeIds(currentEvent?.judgeIds || []);
    setIsManageOpen(open);
  };

  const toggleJudge = (judgeId: number) => {
    setSelectedJudgeIds((prev) =>
      prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId]
    );
  };

  const handleNotify = (judge: any) => {
    setSelectedJudge(judge);
    setMessage("Ensure your scores are up to date");
    setNotifyDialogOpen(true);
  };

  const handleSend = () => {
    if (selectedJudge) {
      sendNotificationMutation.mutate({ judgeId: selectedJudge.id, message });
    }
  };

  const getLastSlotForJudge = (judgeId: number) => {
    const judgeSlots = slotList.filter((s: ScheduleSlot) => s.judgeIds?.includes(judgeId) || s.captainJudgeId === judgeId);
    if (judgeSlots.length === 0) return null;
    return judgeSlots.sort((a: ScheduleSlot, b: ScheduleSlot) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )[0];
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Progress" value={`${Math.round(progress)}%`} subtitle={`${completedCount}/${totalExpected}`} color="text-primary" />
        <StatCard title="Teams" value={teamList.length.toString()} subtitle="Competing" color="text-blue-400" />
        <StatCard title="Stations" value={stationList.length.toString()} subtitle="Active" color="text-emerald-400" />
        <StatCard title="Judges" value={judgeStatus.length.toString()} subtitle="Assigned" color="text-amber-400" />
      </div>

      {/* === UNIFIED CARD: Judges, Teams, Schedule === */}
      <Card>
        <CardContent className="p-0">

          {/* ── JUDGES SECTION ── */}
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Judges ({judgeStatus.length})
              </h3>
              <Dialog open={isManageOpen} onOpenChange={handleManageOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-manage-judges">
                    <Edit2 className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Assigned Judges</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    {allJudges.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No judges available</p>
                    ) : (
                      allJudges.map((judge: any) => (
                        <div key={judge.id} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover-elevate" onClick={() => toggleJudge(judge.id)}>
                          <input
                            type="checkbox"
                            checked={selectedJudgeIds.includes(judge.id)}
                            onChange={() => toggleJudge(judge.id)}
                            className="w-4 h-4 rounded"
                            data-testid={`checkbox-judge-${judge.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{judge.name || judge.username}</p>
                            <p className="text-xs text-muted-foreground">@{judge.username}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsManageOpen(false)}>Cancel</Button>
                    <Button onClick={() => updateJudges(selectedJudgeIds)} disabled={isUpdatingJudges}>
                      {isUpdatingJudges && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      {isUpdatingJudges ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {judgeStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No judges assigned to this event yet.</p>
            ) : (
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow>
                    <TableHead>Judge</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Station</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {judgeStatus.map((judge) => {
                    const lastSlot = getLastSlotForJudge(judge.id);
                    const lastStation = lastSlot ? stationMap.get(lastSlot.stationId) : null;
                    const progressPct = judge.assigned > 0 ? (judge.completed / judge.assigned) * 100 : 0;

                    return (
                      <TableRow key={judge.id} data-testid={`judge-row-${judge.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                            {judge.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={progressPct} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {judge.completed}/{judge.assigned}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {judge.isBehind ? (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertCircle className="w-3 h-3" />Behind
                            </Badge>
                          ) : judge.completed === judge.assigned && judge.assigned > 0 ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <CheckCircle className="w-3 h-3" />Done
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">In Progress</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lastStation ? lastStation.name : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleNotify(judgeMap.get(judge.id) || judge)}
                            data-testid={`button-notify-judge-${judge.id}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="border-t" />

          {/* ── TEAMS SECTION ── */}
          <div className="p-4 md:p-6">
            <h3 className="font-semibold flex items-center gap-2 text-base mb-4">
              <School className="h-4 w-4" />
              Teams ({teamList.length})
            </h3>
            {teamList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No teams registered for this event.</p>
            ) : (
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamList.map((team: any) => {
                    const teamSlots = slotList.filter((s: any) => s.teamId === team.id);
                    const teamScored = teamSlots.filter((s: any) =>
                      scoreList.some((sc: any) => sc.slotId === s.id)
                    ).length;
                    const pct = teamSlots.length > 0 ? (teamScored / teamSlots.length) * 100 : 0;
                    return (
                      <TableRow key={team.id} data-testid={`team-card-${team.id}`}>
                        <TableCell className="font-medium" data-testid={`text-team-name-${team.id}`}>{team.name}</TableCell>
                        <TableCell className="text-muted-foreground">{team.schoolName || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{team.city || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={pct} className="h-1.5 w-20" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{teamScored}/{teamSlots.length}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="border-t" />

          {/* ── SCHEDULE TIMELINE SECTION ── */}
          <div className="p-4 md:p-6">
            <h3 className="font-semibold flex items-center gap-2 text-base mb-4">
              <Clock className="h-4 w-4" />
              Schedule Timeline
            </h3>

            {slotsByTime.size === 0 ? (
              <div className="text-center py-6">
                <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No time slots have been created for this event.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Judges</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(slotsByTime.entries()).flatMap(([time, timeSlots]) =>
                    timeSlots.map((slot: any) => {
                      const team = teamMap.get(slot.teamId);
                      const station = stationMap.get(slot.stationId);
                      const slotJudges = (slot.judgeIds || []).map((id: number) => judgeMap.get(id)).filter(Boolean);
                      const isScored = scoreList.some((sc) => sc.slotId === slot.id);

                      return (
                        <TableRow key={slot.id} data-testid={`slot-card-${slot.id}`} className={isScored ? "opacity-60" : ""}>
                          <TableCell className="font-mono text-sm text-muted-foreground whitespace-nowrap">{time}</TableCell>
                          <TableCell className="font-medium" data-testid={`slot-team-${slot.id}`}>
                            {team?.name || "Unknown Team"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{team?.schoolName || "—"}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {station?.name || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {slotJudges.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {slotJudges.map((j: any) => (
                                  <Badge key={j.id} variant="secondary" className="text-xs">{j.name || j.username}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isScored ? (
                              <Badge variant="default" className="text-xs">Scored</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{slot.status || "Pending"}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Send Notification to {selectedJudge?.name || selectedJudge?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Phone Number</Label>
              <Input value={selectedJudge?.phone || "Not set"} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Message</Label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                data-testid="input-notification-message"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sendNotificationMutation.isPending}
              className="w-full"
              data-testid="button-send-notification"
            >
              {sendNotificationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sendNotificationMutation.isPending ? "Sending..." : "Send Notification"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scoring Matrix */}
      <ScoringMatrix
        teams={teamList}
        stations={stationList}
        slots={slotList}
        scores={scoreList}
        judges={allJudges}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
        <h2 className={`text-2xl font-bold mb-0.5 ${color}`}>{value}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
