"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown, Clock } from "lucide-react";
import { format, addDays, nextMonday, setHours, setMinutes } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
}

interface ScheduleFollowUpModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultLeadId?: string;
  onScheduleSuccess?: () => void; // Callback to refresh parent data
}

// Generate time slots (09:00 to 19:00 in 30 min increments)
const TIME_SLOTS = Array.from({ length: 21 }).map((_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

export function ScheduleFollowUpModal({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  defaultLeadId,
  onScheduleSuccess
}: ScheduleFollowUpModalProps) {
  // Logic to handle controlled vs uncontrolled state
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  // Form State
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");
  
  // Data & UI State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false); // For Combobox

  const supabase = createClient();
  const router = useRouter();

  // Reset and Fetch logic
  useEffect(() => {
    if (isOpen) {
      fetchLeads();
      setLeadId(defaultLeadId || "");
      
      // Default to tomorrow if no date set
      if (!date) {
        const tomorrow = addDays(new Date(), 1);
        setDate(tomorrow);
      }
    } else {
      // Cleanup on close
      if (!defaultLeadId) setLeadId("");
      setNotes("");
    }
  }, [isOpen, defaultLeadId]);

  const fetchLeads = async () => {
    setFetching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: leadsData, error } = await supabase
        .from("leads")
        .select("id, name, company, phone")
        .eq("assigned_to", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads list");
    } finally {
      setFetching(false);
    }
  };

  // Quick Action Handlers
  const setQuickSchedule = (type: "tomorrow" | "3days" | "next_week") => {
    const now = new Date();
    let newDate = new Date();

    switch (type) {
      case "tomorrow":
        newDate = addDays(now, 1);
        setTime("10:00");
        break;
      case "3days":
        newDate = addDays(now, 3);
        setTime("11:00");
        break;
      case "next_week":
        newDate = nextMonday(now);
        setTime("10:00");
        break;
    }
    setDate(newDate);
  };

  const handleSchedule = async () => {
    if (!date || !leadId) {
      toast.error("Missing Information", { description: "Please select both a lead and a date." });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Session expired. Please login.");
        return;
      }

      const selectedLead = leads.find(lead => lead.id === leadId);
      const title = selectedLead ? `Follow-up: ${selectedLead.name}` : "Follow-up";

      // Combine Date and Time
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDateTime = setMinutes(setHours(date, hours), minutes);

      // Past date validation
      if (scheduledDateTime < new Date()) {
        toast.error("Invalid Time", { description: "You cannot schedule a follow-up in the past." });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("follow_ups")
        .insert({
          lead_id: leadId,
          user_id: user.id,
          title: title,
          scheduled_at: scheduledDateTime.toISOString(),
          notes: notes,
          status: "pending"
        });

      if (error) throw error;

      toast.success("Follow-up Scheduled", { description: `Reminding you on ${format(scheduledDateTime, "MMM d 'at' h:mm a")}` });
      
      setOpen(false);
      if (onScheduleSuccess) onScheduleSuccess();
      router.refresh();

    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to schedule", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {!controlledOpen && (
          <Button variant="secondary" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>
            Set a reminder to call or contact this lead.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="xs" onClick={() => setQuickSchedule("tomorrow")} className="text-xs h-7">
              Tomorrow AM
            </Button>
            <Button variant="outline" size="xs" onClick={() => setQuickSchedule("3days")} className="text-xs h-7">
              In 3 Days
            </Button>
            <Button variant="outline" size="xs" onClick={() => setQuickSchedule("next_week")} className="text-xs h-7">
              Next Monday
            </Button>
          </div>

          {/* Lead Selection (Combobox) */}
          <div className="grid gap-2">
            <Label>Select Lead</Label>
            <Popover open={leadOpen} onOpenChange={setLeadOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadOpen}
                  className="w-full justify-between"
                  disabled={!!defaultLeadId || fetching}
                >
                  {leadId
                    ? leads.find((lead) => lead.id === leadId)?.name
                    : fetching ? "Loading leads..." : "Search leads..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0">
                <Command>
                  <CommandInput placeholder="Search lead name..." />
                  <CommandList>
                    <CommandEmpty>No lead found.</CommandEmpty>
                    <CommandGroup>
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.name}
                          onSelect={() => {
                            setLeadId(lead.id);
                            setLeadOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              leadId === lead.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{lead.name}</span>
                            {lead.company && <span className="text-xs text-muted-foreground">{lead.company}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Time</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Discuss loan interest rates..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!date || !leadId || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
