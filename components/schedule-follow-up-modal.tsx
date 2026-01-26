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
  SelectGroup,
  SelectLabel
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { 
  Plus, Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown, 
  Phone, Users, Mail, MessageSquare, ExternalLink, CalendarCheck 
} from "lucide-react";
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
  onScheduleSuccess?: () => void;
}

// Generate grouped time slots
const TIME_SLOTS = [
  { label: "Morning", slots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"] },
  { label: "Afternoon", slots: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"] },
  { label: "Evening", slots: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"] },
];

const ACTIVITY_TYPES = [
  { id: "call", label: "Call", icon: Phone },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "email", label: "Email", icon: Mail },
];

const QUICK_NOTES = ["Discuss Rates", "Collect Docs", "Negotiation", "Final Closing", "Intro Call"];

export function ScheduleFollowUpModal({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  defaultLeadId,
  onScheduleSuccess
}: ScheduleFollowUpModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  // Form State
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [leadId, setLeadId] = useState("");
  const [notes, setNotes] = useState("");
  const [activityType, setActivityType] = useState("call");
  
  // UI State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [gcalLink, setGcalLink] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Reset logic
  useEffect(() => {
    if (isOpen) {
      fetchLeads();
      setLeadId(defaultLeadId || "");
      setGcalLink(null);
      if (!date) {
        const tomorrow = addDays(new Date(), 1);
        setDate(tomorrow);
      }
    } else {
      if (!defaultLeadId) setLeadId("");
      setNotes("");
      setActivityType("call");
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
    } finally {
      setFetching(false);
    }
  };

  const setQuickSchedule = (type: "tomorrow" | "3days" | "next_week") => {
    const now = new Date();
    let newDate = new Date();

    switch (type) {
      case "tomorrow": newDate = addDays(now, 1); setTime("10:00"); break;
      case "3days": newDate = addDays(now, 3); setTime("11:00"); break;
      case "next_week": newDate = nextMonday(now); setTime("10:00"); break;
    }
    setDate(newDate);
  };

  const handleQuickNote = (text: string) => {
    setNotes(prev => prev ? `${prev}, ${text}` : text);
  };

  const generateGCalLink = (title: string, dateObj: Date) => {
    const start = dateObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(dateObj.getTime() + 30 * 60000).toISOString().replace(/-|:|\.\d\d\d/g, ""); // +30 mins
    const details = encodeURIComponent(notes || "Follow up with client");
    const location = encodeURIComponent("Phone / Online");
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${details}&location=${location}&sf=true&output=xml`;
  };

  const handleSchedule = async () => {
    if (!date || !leadId) {
      toast.error("Missing Info", { description: "Select a lead and date." });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Session expired"); return; }

      const selectedLead = leads.find(lead => lead.id === leadId);
      const activityLabel = ACTIVITY_TYPES.find(a => a.id === activityType)?.label || "Follow-up";
      const title = `${activityLabel}: ${selectedLead?.name}`;

      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDateTime = setMinutes(setHours(date, hours), minutes);

      if (scheduledDateTime < new Date()) {
        toast.error("Invalid Time", { description: "Cannot schedule in the past." });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("follow_ups").insert({
        lead_id: leadId,
        user_id: user.id,
        title: title,
        scheduled_at: scheduledDateTime.toISOString(),
        notes: notes,
        status: "pending"
      });

      if (error) throw error;

      // Success State
      const link = generateGCalLink(title, scheduledDateTime);
      setGcalLink(link); // Show the GCal button
      
      toast.success("Scheduled Successfully", {
        description: `${format(scheduledDateTime, "MMM d, h:mm a")} - ${title}`,
        action: {
          label: "Add to Calendar",
          onClick: () => window.open(link, "_blank")
        }
      });

      if (onScheduleSuccess) onScheduleSuccess();
      router.refresh();
      
      // Don't close immediately if we want them to click GCal link, 
      // but usually standard behavior is to close. Uncomment next line to close auto.
      // setOpen(false); 

    } catch (error: any) {
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
            <Plus className="h-4 w-4 mr-2" /> Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>Set a reminder for your next interaction.</DialogDescription>
        </DialogHeader>
        
        {gcalLink ? (
          /* SUCCESS STATE VIEW */
          <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Reminder Set!</h3>
              <p className="text-sm text-muted-foreground">Would you like to add this to your calendar?</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setGcalLink(null); }}>
                Close
              </Button>
              <Button className="flex-1 gap-2" onClick={() => window.open(gcalLink, "_blank")}>
                <ExternalLink className="h-4 w-4" /> Google Calendar
              </Button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="grid gap-5 py-4">
            {/* Activity Type Tabs */}
            <Tabs value={activityType} onValueChange={setActivityType} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {ACTIVITY_TYPES.map((type) => (
                  <TabsTrigger key={type.id} value={type.id} className="text-xs gap-1.5">
                    <type.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{type.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("tomorrow")} className="text-xs h-7 flex-1 bg-slate-50">Tomorrow AM</Button>
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("3days")} className="text-xs h-7 flex-1 bg-slate-50">In 3 Days</Button>
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("next_week")} className="text-xs h-7 flex-1 bg-slate-50">Next Week</Button>
            </div>

            {/* Lead Selection */}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Select Lead</Label>
              <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={leadOpen} className="w-full justify-between" disabled={!!defaultLeadId || fetching}>
                    {leadId ? leads.find((lead) => lead.id === leadId)?.name : fetching ? "Loading..." : "Search lead..."}
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
                          <CommandItem key={lead.id} value={lead.name} onSelect={() => { setLeadId(lead.id); setLeadOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", leadId === lead.id ? "opacity-100" : "opacity-0")} />
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

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold text-slate-500 uppercase">Time</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {TIME_SLOTS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs text-slate-400 font-normal mt-1">{group.label}</SelectLabel>
                        {group.slots.map(slot => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-500 uppercase">Notes</Label>
                <div className="flex gap-1">
                  {QUICK_NOTES.slice(0, 3).map(note => (
                    <button key={note} onClick={() => handleQuickNote(note)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600">{note}</button>
                  ))}
                </div>
              </div>
              <Textarea placeholder="Add details..." value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" rows={3} />
            </div>
          </div>
        )}

        {!gcalLink && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={!date || !leadId || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
