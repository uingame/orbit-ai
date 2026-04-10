import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, User as UserIcon, Clock, CheckCircle, Mail, Search, ArrowUpDown, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-csv";
import type { User, Notification, Event } from "@shared/schema";
import { api } from "@shared/routes";
import { format } from "date-fns";
import { formatDateTimeIL } from "@/lib/format-date";

type SortColumn = "judge" | "message" | "date" | "status";
type SortOrder = "asc" | "desc";

export default function ManagerMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch(api.events.list.path);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const eventJudgeIds = useMemo(() => {
    const ids = new Set<number>();
    events.forEach((e) => {
      e.judgeIds?.forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [events]);

  const { data: allJudges = [] } = useQuery<User[]>({
    queryKey: ["/api/judges"],
  });

  const eventJudges = useMemo(() => {
    return allJudges.filter((j) => eventJudgeIds.includes(j.id));
  }, [allJudges, eventJudgeIds]);

  const { data: allNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/all"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/all");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  const myNotifications = useMemo(() => {
    return allNotifications.filter((n) => eventJudgeIds.includes(n.judgeId));
  }, [allNotifications, eventJudgeIds]);

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ judgeId, message }: { judgeId: number; message: string }) => {
      return apiRequest("POST", "/api/notifications/send", { judgeId, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/all"] });
      toast({ title: "Message Sent", description: "Your message has been delivered." });
      setComposeOpen(false);
      setSelectedJudgeId("");
      setMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!selectedJudgeId || !message.trim()) {
      toast({ title: "Error", description: "Please select a judge and enter a message", variant: "destructive" });
      return;
    }
    sendNotificationMutation.mutate({ judgeId: parseInt(selectedJudgeId), message: message.trim() });
  };

  const getJudgeById = (id: number) => allJudges.find((j) => j.id === id);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("desc");
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

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return myNotifications;
    const query = searchQuery.toLowerCase();
    return myNotifications.filter((n) => {
      const judge = getJudgeById(n.judgeId);
      return (
        n.message.toLowerCase().includes(query) ||
        (judge?.name?.toLowerCase()?.includes(query) ?? false) ||
        (judge?.username?.toLowerCase()?.includes(query) ?? false)
      );
    });
  }, [myNotifications, searchQuery, allJudges]);

  const flatMessages = useMemo(() => {
    return filteredNotifications.map(n => ({
      ...n,
      judge: getJudgeById(n.judgeId),
    }));
  }, [filteredNotifications, allJudges]);

  const sortedFlatMessages = useMemo(() => {
    let sorted = [...flatMessages];

    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortColumn === "judge") {
        aVal = a.judge?.name?.toLowerCase() || "";
        bVal = b.judge?.name?.toLowerCase() || "";
      } else if (sortColumn === "message") {
        aVal = a.message.toLowerCase();
        bVal = b.message.toLowerCase();
      } else if (sortColumn === "date") {
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
      } else if (sortColumn === "status") {
        aVal = a.isRead ? 1 : 0;
        bVal = b.isRead ? 1 : 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [flatMessages, sortColumn, sortOrder]);

  const groupedByJudge = useMemo(() => {
    const groups: Record<number, Notification[]> = {};
    filteredNotifications.forEach((n) => {
      if (!groups[n.judgeId]) groups[n.judgeId] = [];
      groups[n.judgeId].push(n);
    });
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    });
    return groups;
  }, [filteredNotifications]);

  const sortedJudgeIds = useMemo(() => {
    return Object.keys(groupedByJudge)
      .map(Number)
      .sort((a, b) => {
        const aLatest = groupedByJudge[a][0]?.createdAt;
        const bLatest = groupedByJudge[b][0]?.createdAt;
        return new Date(bLatest ?? 0).getTime() - new Date(aLatest ?? 0).getTime();
      });
  }, [groupedByJudge]);

  if (eventsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading messages...</div>;
  }

  if (eventsError) {
    return <div className="p-8 text-center text-destructive">Failed to load data. Please try again.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Complete history of messages sent to judges</p>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-compose">
              <Send className="mr-2 h-4 w-4" /> New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message to Judge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Judge</Label>
                <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
                  <SelectTrigger data-testid="select-judge">
                    <SelectValue placeholder="Choose a judge..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eventJudges.map((judge) => (
                      <SelectItem key={judge.id} value={String(judge.id)}>
                        {judge.name} ({judge.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                  data-testid="textarea-message"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSend}
                disabled={sendNotificationMutation.isPending}
                data-testid="button-send-message"
              >
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages or judges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-messages"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === "grouped" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grouped")}
            data-testid="button-view-grouped"
          >
            Grouped
          </Button>
          <Button 
            variant={viewMode === "flat" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("flat")}
            data-testid="button-view-flat"
          >
            Flat List
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToCSV("messages.csv", ["Judge", "Message", "Date", "Status"], sortedFlatMessages.map((notification) => [
              notification.judge?.name || "Unknown",
              notification.message,
              notification.createdAt ? formatDateTimeIL(notification.createdAt) : "Unknown",
              notification.isRead ? "Read" : "Unread",
            ]))
          }
        >
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <Badge variant="secondary">{myNotifications.length} total messages</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{myNotifications.length}</div>
            <p className="text-sm text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {myNotifications.filter((n) => n.isRead).length}
            </div>
            <p className="text-sm text-muted-foreground">Read</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">
              {myNotifications.filter((n) => !n.isRead).length}
            </div>
            <p className="text-sm text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
      </div>

      {sortedJudgeIds.length === 0 ? (
        <Card className="bg-card/50 border-dashed border-2 border-muted p-12 text-center">
          <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold">No Messages Yet</h3>
          <p className="text-muted-foreground">
            {searchQuery ? "No messages match your search." : "Send your first message to get started."}
          </p>
        </Card>
      ) : viewMode === "grouped" ? (
        <div className="space-y-4">
          {sortedJudgeIds.map((judgeId) => {
            const judge = getJudgeById(judgeId);
            const messages = groupedByJudge[judgeId];
            const unreadCount = messages.filter((m) => !m.isRead).length;

            return (
              <Card key={judgeId} data-testid={`card-judge-messages-${judgeId}`} className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0 pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{judge?.name || `Judge ${judgeId}`}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{messages.length} messages</Badge>
                      {unreadCount > 0 && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          {unreadCount} unread
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {messages.map((notification, idx) => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg animate-in fade-in duration-300 ${
                          notification.isRead ? "bg-muted/50" : "bg-primary/5 border border-primary/20"
                        }`}
                        data-testid={`message-${notification.id}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm flex-1">{notification.message}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            {notification.isRead ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.createdAt
                            ? formatDateTimeIL(notification.createdAt)
                            : "Unknown date"}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-primary/10 bg-gradient-to-br from-card/50 to-card/30">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              All Messages ({sortedFlatMessages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedFlatMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages match your search</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortHeader column="judge" label="Judge" />
                      <SortHeader column="message" label="Message" />
                      <SortHeader column="date" label="Date" />
                      <SortHeader column="status" label="Status" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFlatMessages.map((notification, idx) => (
                      <TableRow
                        key={notification.id}
                        data-testid={`message-${notification.id}`}
                        className="animate-in fade-in duration-300"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <UserIcon className="h-3 w-3 text-primary" />
                            </div>
                            {notification.judge?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-md line-clamp-2">{notification.message}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {notification.createdAt
                            ? formatDateTimeIL(notification.createdAt)
                            : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={notification.isRead ? "secondary" : "default"}
                            className={notification.isRead ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700" : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"}
                          >
                            <div className="flex items-center gap-1">
                              {notification.isRead ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {notification.isRead ? "Read" : "Unread"}
                            </div>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
