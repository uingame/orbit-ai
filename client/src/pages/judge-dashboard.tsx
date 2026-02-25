import { useAuth } from "@/hooks/use-auth";
import { useStations } from "@/hooks/use-stations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, MapPin, Bot, Bell, Check, ChevronDown, Send, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { api } from "@shared/routes";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Notification, Event, Team, ScheduleSlot, Score } from "@shared/schema";

export default function JudgeDashboard() {
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Fetch judge's assigned events (not all events)
  const { data: judgeEvents, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/judge/events"],
    queryFn: async () => {
      const res = await fetch("/api/judge/events", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Auto-select event when events load
  useEffect(() => {
    if (judgeEvents && judgeEvents.length > 0 && !selectedEventId) {
      // Prefer active event, otherwise first event
      const activeEvent = judgeEvents.find(e => e.isActive);
      setSelectedEventId(activeEvent?.id || judgeEvents[0].id);
    }
  }, [judgeEvents, selectedEventId]);

  if (eventsLoading) {
    return <div className="p-4 text-center">Loading your assignments...</div>;
  }

  if (!judgeEvents || judgeEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">No Assignments</h2>
        <p className="text-muted-foreground">You have not been assigned to any events yet.</p>
      </div>
    );
  }

  const selectedEvent = judgeEvents.find(e => e.id === selectedEventId) || judgeEvents[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Event Selector (only shows if judge has multiple events) */}
      {judgeEvents.length > 1 && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-md">
          <Label className="text-sm font-medium whitespace-nowrap">Event:</Label>
          <Select 
            value={String(selectedEventId)} 
            onValueChange={(val) => setSelectedEventId(Number(val))}
          >
            <SelectTrigger className="w-full max-w-xs" data-testid="select-event">
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {judgeEvents.map(event => (
                <SelectItem key={event.id} value={String(event.id)}>
                  {event.name} {event.isActive && "(Active)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <JudgeEventView event={selectedEvent} userId={user!.id} />
    </div>
  );
}

function JudgeEventView({ event, userId }: { event: Event, userId: number }) {
  const queryClient = useQueryClient();
  
  // Use judge-scoped endpoints - only get data assigned to this judge
  const { data: mySlots = [], isLoading: slotsLoading } = useQuery<ScheduleSlot[]>({
    queryKey: ["/api/judge/events", event.id, "slots"],
    queryFn: async () => {
      const res = await fetch(`/api/judge/events/${event.id}/slots`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/judge/events", event.id, "teams"],
    queryFn: async () => {
      const res = await fetch(`/api/judge/events/${event.id}/teams`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: stations } = useStations(event.id);
  
  // Use judge-scoped scores endpoint
  const { data: scores = [] } = useQuery<Score[]>({
    queryKey: ["/api/judge/events", event.id, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/judge/events/${event.id}/scores`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch notifications for this judge
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const unreadNotifications = notifications.filter((n: Notification) => !n.isRead);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  if (slotsLoading) return <div className="p-4 text-center">Loading assignments...</div>;
  
  // Sort: Pending first, then by time
  const sortedSlots = [...mySlots].sort((a, b) => {
    const scoreA = scores?.find(s => s.slotId === a.id);
    const scoreB = scores?.find(s => s.slotId === b.id);
    if (!scoreA && scoreB) return -1;
    if (scoreA && !scoreB) return 1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Notifications Banner */}
      {unreadNotifications.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              {unreadNotifications.length} New Notification{unreadNotifications.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unreadNotifications.map((notification) => (
              <div key={notification.id} className="flex items-start justify-between gap-2 p-2 bg-background/50 rounded-md">
                <p className="text-sm flex-1">{notification.message}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => markAsReadMutation.mutate(notification.id)}
                  data-testid={`button-mark-read-${notification.id}`}
                >
                  <Check className="w-4 h-4 text-green-500" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-muted-foreground">Your Judging Schedule</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {mySlots.length} Assignments
        </Badge>
      </div>

      {/* Schedule Summary Section */}
      {sortedSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Your Schedule Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSlots.map((slot, idx) => {
                  const team = teams?.find(t => t.id === slot.teamId);
                  const station = stations?.find(s => s.id === slot.stationId);
                  const existingScore = scores?.find(s => s.slotId === slot.id);
                  const isComplete = !!existingScore;

                  return (
                    <TableRow key={slot.id}>
                      <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{team?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {station?.name ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {format(new Date(slot.startTime), "HH:mm")}–{format(new Date(slot.endTime), "HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        {isComplete ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Done</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold mt-4 mb-4">Detailed Assignments</h2>
        {sortedSlots.map(slot => {
          const team = teams?.find(t => t.id === slot.teamId);
          const station = stations?.find(s => s.id === slot.stationId);
          const existingScore = scores?.find(s => s.slotId === slot.id);
          const isComplete = !!existingScore;

          if (!team || !station) return null;

          return (
            <SlotCard 
              key={slot.id}
              slot={slot}
              team={team}
              station={station}
              event={event}
              existingScore={existingScore}
              userId={userId}
              isComplete={isComplete}
            />
          );
        })}
        
        {sortedSlots.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            You have no assigned slots for this event.
          </div>
        )}
      </div>
    </div>
  );
}

// SlotCard - wraps ScoreSheetDialog and AIAssistantButton to share state
function SlotCard({ slot, team, station, event, existingScore, userId, isComplete }: any) {
  const [pendingScores, setPendingScores] = useState<Record<string, number> | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<string>("");
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);

  const handleApplyScores = (scores: Record<string, number>, feedback: string) => {
    setPendingScores(scores);
    setPendingFeedback(feedback);
    setScoreDialogOpen(true); // Auto-open the scoring dialog
  };

  return (
    <Card className={`border-l-4 ${isComplete ? 'border-l-green-500 opacity-70' : 'border-l-foreground'}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock size={12} />
              {format(new Date(slot.startTime), "HH:mm")} - {format(new Date(slot.endTime), "HH:mm")}
            </div>
            <h3 className="font-bold text-lg">{team.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin size={12} />
              {station.name}
            </div>
          </div>
          {isComplete ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">Done</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
        </div>

        <div className="flex gap-2">
          <ScoreSheetDialog 
            slot={slot} 
            team={team} 
            station={station} 
            event={event} 
            existingScore={existingScore} 
            userId={userId}
            isOpen={scoreDialogOpen}
            onOpenChange={setScoreDialogOpen}
            pendingScores={pendingScores}
            pendingFeedback={pendingFeedback}
            onClearPending={() => { setPendingScores(null); setPendingFeedback(""); }}
          />
          <AIAssistantButton 
            slotId={slot.id} 
            team={{ name: team.name, schoolName: team.schoolName }}
            station={{ name: station.name, rubric: station.rubric }}
            onApplyScores={handleApplyScores}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreSheetDialog({ slot, team, station, event, existingScore, userId, isOpen, onOpenChange, pendingScores, pendingFeedback, onClearPending }: any) {
  const { mutate: submitScore, isPending } = useCreateScore();

  const rubric = station.rubric as { criteria: { name: string, maxPoints: number, note?: string }[] };

  const formSchema = z.object({
    scores: z.record(z.coerce.number().min(0).max(10)), // Simplified for dynamic keys
    feedback: z.string().optional(),
  });

  const form = useForm({
    defaultValues: {
      scores: existingScore?.scores || {},
      feedback: existingScore?.feedback || "",
    }
  });

  // Apply pending scores from AI assistant
  useEffect(() => {
    if (pendingScores && isOpen) {
      Object.entries(pendingScores).forEach(([key, value]) => {
        form.setValue(`scores.${key}`, value);
      });
      if (pendingFeedback) {
        form.setValue('feedback', pendingFeedback);
      }
      onClearPending?.();
    }
  }, [pendingScores, isOpen, form, pendingFeedback, onClearPending]);

  const onSubmit = (values: any) => {
    // Validate max points manually since zod schema is generic
    const scoreData: Record<string, number> = {};
    let isValid = true;
    
    rubric.criteria.forEach(c => {
      const val = Number(values.scores[c.name] || 0);
      if (val > c.maxPoints) {
        form.setError(`scores.${c.name}`, { message: `Max ${c.maxPoints}` });
        isValid = false;
      }
      scoreData[c.name] = val;
    });

    if (!isValid) return;

    submitScore({
      slotId: slot.id,
      teamId: team.id,
      stationId: station.id,
      judgeId: userId,
      scores: scoreData,
      feedback: values.feedback,
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex-1" variant={existingScore ? "outline" : "default"}>
          {existingScore ? "Edit Score" : "Grade Team"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grading: {team.name}</DialogTitle>
          <CardDescription>{station.name} Station</CardDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            {rubric.criteria.map((criterion, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>{criterion.name}</Label>
                  <span className="text-xs text-muted-foreground">Max: {criterion.maxPoints} pts</span>
                </div>
                {criterion.note && (
                  <p className="text-xs text-muted-foreground -mt-1" data-testid={`text-criteria-note-${idx}`}>{criterion.note}</p>
                )}
                <FormField
                  control={form.control}
                  name={`scores.${criterion.name}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="number" 
                            min="0" 
                            max={criterion.maxPoints}
                            className="text-lg font-mono"
                            {...field}
                          />
                          {/* Could add a slider here too for mobile friendliness */}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <FormField
              control={form.control}
              name="feedback"
              render={({ field }) => (
                <FormItem>
                  <Label>Judge Feedback</Label>
                  <FormControl>
                    <Textarea 
                      placeholder="Constructive feedback for the team..." 
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isPending ? "Submitting..." : "Submit Score"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// AI Feedback Assistant with real backend integration
function AIAssistantButton({ slotId, team, station, onApplyScores }: { 
  slotId: number; 
  team: { name: string; schoolName: string };
  station: { name: string; rubric: any };
  onApplyScores?: (scores: Record<string, number>, feedback: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedScores, setSuggestedScores] = useState<Record<string, number> | null>(null);
  const [suggestedFeedback, setSuggestedFeedback] = useState<string | null>(null);

  // Quick feedback keywords
  const quickKeywords = [
    "Excellent teamwork",
    "Creative solution", 
    "Needs improvement",
    "Good communication",
    "Strong presentation",
    "Technical mastery",
    "Time management issue",
    "Outstanding effort"
  ];

  // Initialize session when opened
  const initSession = async () => {
    if (sessionId) return;
    
    try {
      const res = await fetch(`/api/slots/${slotId}/ai-session`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session.id);
        // Load existing messages
        if (data.messages?.length > 0) {
          setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })));
        } else {
          setMessages([{ 
            role: 'assistant', 
            content: `Hi! I'm here to help you score ${team.name} at ${station.name}. Describe what you observed, tap a quick keyword, or ask me about the rubric criteria. I'll suggest scores and constructive feedback.`
          }]);
        }
        // Load suggested scores if they exist
        if (data.session.suggestedScores) {
          setSuggestedScores(data.session.suggestedScores);
          setSuggestedFeedback(data.session.suggestedFeedback);
        }
      }
    } catch (error) {
      console.error("Failed to init AI session:", error);
    }
  };

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent || input;
    if (!content.trim() || !sessionId) return;
    
    setMessages(prev => [...prev, { role: 'user', content }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/ai-sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.assistantMessage.content }]);
        
        if (data.suggestedScores) {
          setSuggestedScores(data.suggestedScores);
          setSuggestedFeedback(data.suggestedFeedback);
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I'm having trouble connecting. Please try again." 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Connection error. Please check your internet and try again." 
      }]);
    }
    
    setIsLoading(false);
  };

  const handleApplyScores = () => {
    if (suggestedScores && onApplyScores) {
      onApplyScores(suggestedScores, suggestedFeedback || "");
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (open) initSession(); }}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="border-primary/50 text-primary" data-testid={`button-ai-assistant-${slotId}`}>
          <Bot size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl sm:rounded-none sm:h-full sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="text-primary w-5 h-5" /> AI Feedback Assistant
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Scoring: {team.name} at {station.name}</p>
        </SheetHeader>
        
        <div className="flex flex-col h-full pb-4">
          {/* Suggested Scores Banner */}
          {suggestedScores && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-600">Suggested Scores Ready</span>
                <Button size="sm" onClick={handleApplyScores} className="bg-green-600 hover:bg-green-700" data-testid="button-apply-scores">
                  Apply to Form
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(suggestedScores).map(([criterion, score]) => (
                  <Badge key={criterion} variant="secondary" className="text-xs">
                    {criterion}: {score}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Quick Keywords */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2">Quick observations:</p>
            <div className="flex flex-wrap gap-1">
              {quickKeywords.map((keyword) => (
                <Button 
                  key={keyword} 
                  size="sm" 
                  variant="outline" 
                  className="text-xs py-1 px-2"
                  onClick={() => sendMessage(keyword)}
                  disabled={isLoading || !sessionId}
                  data-testid={`button-keyword-${keyword.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {keyword}
                </Button>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 pr-2 mb-3">
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-muted rounded-tl-none'
                    }`}
                  >
                    {m.content.replace(/\{"suggestedScores"[\s\S]*?\}/, '').trim() || m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2 rounded-tl-none flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '75ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="flex gap-2 mt-auto">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Describe what you observed..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={isLoading || !sessionId}
              data-testid="input-ai-message"
            />
            <Button size="icon" onClick={() => sendMessage()} disabled={isLoading || !sessionId} data-testid="button-send-ai-message">
              <Send size={16} />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function useCreateScore() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/scores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to submit score");
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.scores.list.path] });
        },
    });
}
