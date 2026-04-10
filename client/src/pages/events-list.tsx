import { useEvents, useCreateEvent } from "@/hooks/use-events";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema } from "@shared/schema";
import { Calendar, Plus, MapPin, Search, ArrowUpDown, CheckCircle, Circle, Trash2, Edit2 } from "lucide-react";
import { useState, useMemo } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { formatDateIL } from "@/lib/format-date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SortColumn = "name" | "date" | "location" | "status";
type SortOrder = "asc" | "desc";

export default function EventsList() {
  const { data: events, isLoading } = useEvents();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { mutate: createEvent } = useCreateEvent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      name: "",
      location: "",
      isActive: true,
      date: new Date(),
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Success", description: "Event deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
    },
  });

  const onSubmit = (values: any) => {
    const eventData = {
      ...values,
      date: values.date instanceof Date ? values.date : new Date(values.date),
    };
    createEvent(eventData, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset();
      }
    });
  };

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = (events || []).filter(event =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "location":
          aValue = a.location || "";
          bValue = b.location || "";
          break;
        case "status":
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [events, searchTerm, sortColumn, sortOrder]);

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

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Events</h1>
          <p className="text-muted-foreground">Manage all space olympics competitions</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Create Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Event</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Galactic Championship 2025" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Mars Base Alpha" {...field} value={field.value || ''} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-gradient-to-br from-card/50 to-card/30 border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              All Events ({filteredAndSortedEvents.length})
            </CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-primary/20"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{events?.length === 0 ? "No events yet. Create one to get started." : "No events match your search."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/30 bg-card/20">
              <Table>
                <TableHeader className="bg-gradient-to-r from-primary/5 to-primary/0">
                  <TableRow className="border-primary/10 hover:bg-primary/5">
                    <SortHeader column="name" label="Event Name" />
                    <SortHeader column="date" label="Date" />
                    <SortHeader column="location" label="Location" />
                    <SortHeader column="status" label="Status" />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedEvents.map((event, idx) => (
                    <TableRow 
                      key={event.id} 
                      className="border-border/30 hover:bg-primary/5 transition-colors animate-in fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <TableCell className="font-semibold">{event.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDateIL(event.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {event.location || "TBD"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.isActive ? "default" : "secondary"} className="gap-1">
                          {event.isActive ? (
                            <><CheckCircle className="h-3 w-3" />Active</>
                          ) : (
                            <><Circle className="h-3 w-3" />Archived</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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