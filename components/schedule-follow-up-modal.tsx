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
import { Badge } from "@/components/ui/badge"; // Ensure you have this component
import { 
  Plus, Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown, 
  Phone, Users, Mail, MessageSquare, ExternalLink, CalendarCheck, Download, Flag
} from "lucide-react";
import { format, addDays, nextMonday, setHours, setMinutes, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  status: string; // Added status for context
}

interface ScheduleFollowUpModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultLeadId?: string;
  onScheduleSuccess?: () => void;
}

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

// Helper for Lead Status Colors
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'interested': return 'bg-green-100 text-green-800';
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'nr': return 'bg-gray-100 text-gray-800';
    default: return 'bg-slate-100 text-slate-800';
  }
};

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
  const [priority, setPriority] = useState("normal"); // normal | high
  
  // UI State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [successData, setSuccessData] = useState<{ google: string; ics: string } | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Reset logic
  useEffect(() => {
    if (isOpen) {
      fetchLeads();
      setLeadId(defaultLeadId || "");
      setSuccessData(null);
      setPriority("normal");
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
        .select("id, name, company, phone, status") // Added status
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

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

  // --- CALENDAR GENERATORS ---
  const generateGCalLink = (title: string, dateObj: Date) => {
    const start = dateObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(dateObj.getTime() + 30 * 60000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const details = encodeURIComponent(notes || "Follow up with client");
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${details}&sf=true&output=xml`;
  };

  const generateICSFile = (title: string, dateObj: Date) => {
    const start = dateObj.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(dateObj.getTime() + 30 * 60000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
URL:${document.location.href}
DTSTART:${start}
DTEND:${end}
SUMMARY:${title}
DESCRIPTION:${notes || "Follow up"}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    return URL.createObjectURL(blob);
  };

  // Check if a time slot is in the past (for Today)
  const isTimeSlotDisabled = (slot: string) => {
    if (!date || !isToday(date)) return false;
    const [h, m] = slot.split(':').map(Number);
    const slotDate = new Date();
    slotDate.setHours(h, m, 0, 0);
    return isPast(slotDate);
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
      
      // Prefix title with Priority if High
      const titlePrefix = priority === "high" ? "🔥 [URGENT] " : "";
      const title = `${titlePrefix}${activityLabel}: ${selectedLead?.name}`;

      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDateTime = setMinutes(setHours(date, hours), minutes);

      if (isPast(scheduledDateTime)) {
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
        status: "pending",
        priority: priority // Ensure your DB has this column or remove this line
      });

      if (error) throw error;

      // Success State Calculation
      const gLink = generateGCalLink(title, scheduledDateTime);
      const iLink = generateICSFile(title, scheduledDateTime);
      setSuccessData({ google: gLink, ics: iLink });
      
      toast.success("Scheduled Successfully", {
        description: `${format(scheduledDateTime, "MMM d, h:mm a")}`,
      });

      if (onScheduleSuccess) onScheduleSuccess();
      router.refresh();

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
        
        {successData ? (
          /* SUCCESS STATE VIEW */
          <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-xl text-slate-800">All Set!</h3>
              <p className="text-sm text-muted-foreground px-8">Reminder scheduled. Add it to your personal calendar to ensure you don't miss it.</p>
            </div>
            
            <div className="flex flex-col gap-2 w-full pt-4">
              <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => window.open(successData.google, "_blank")}>
                <ExternalLink className="h-4 w-4" /> Add to Google Calendar
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => window.open(successData.ics, "_self")}>
                <Download className="h-4 w-4" /> Download Outlook/iCal File
              </Button>
            </div>
            
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={() => { setOpen(false); setSuccessData(null); }}>
                Dismiss
            </Button>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="grid gap-5 py-4">
            {/* Activity Type Tabs */}
            <Tabs value={activityType} onValueChange={setActivityType} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {ACTIVITY_TYPES.map((type) => (
                  <TabsTrigger key={type.id} value={type.id} className="text-xs gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <type.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{type.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("tomorrow")} className="text-xs h-7 flex-1 bg-slate-50 border-dashed">Tomorrow</Button>
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("3days")} className="text-xs h-7 flex-1 bg-slate-50 border-dashed">In 3 Days</Button>
              <Button variant="outline" size="xs" onClick={() => setQuickSchedule("next_week")} className="text-xs h-7 flex-1 bg-slate-50 border-dashed">Next Week</Button>
            </div>

            {/* Lead Selection (Rich Context) */}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Select Lead</Label>
              <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={leadOpen} className="w-full justify-between h-10" disabled={!!defaultLeadId || fetching}>
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
                            <div className="flex flex-col flex-1">
                              <div className="flex justify-between items-center w-full">
                                <span className="font-medium">{lead.name}</span>
                                <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 font-normal", getStatusColor(lead.status))}>
                                    {lead.status}
                                </Badge>
                              </div>
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
                <Label className="text-xs font-semibold text-slate-500 uppercase">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !date && "text-muted-foreground")}>
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
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {TIME_SLOTS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel className="text-xs text-slate-400 font-normal mt-1 bg-slate-50 py-1 pl-2">{group.label}</SelectLabel>
                        {group.slots.map(slot => (
                          <SelectItem key={slot} value={slot} disabled={isTimeSlotDisabled(slot)}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes & Priority */}
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-500 uppercase">Notes</Label>
                <div className="flex gap-2 items-center">
                    {/* Priority Toggle */}
                    <div className="flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-medium">High Priority</span>
                        <input 
                            type="checkbox" 
                            checked={priority === "high"} 
                            onChange={(e) => setPriority(e.target.checked ? "high" : "normal")} 
                            className="h-3.5 w-3.5 accent-red-500"
                        />
                    </div>
                </div>
              </div>
              <Textarea 
                placeholder="Add agenda or details..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                className="resize-none" 
                rows={3} 
              />
              <div className="flex gap-1 flex-wrap mt-1">
                  {QUICK_NOTES.slice(0, 3).map(note => (
                    <button key={note} onClick={() => handleQuickNote(note)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-600 border border-slate-200">
                        {note}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {!successData && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={!date || !leadId || loading} className={cn(priority === "high" ? "bg-red-600 hover:bg-red-700" : "")}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {priority === "high" ? "Confirm Urgent Follow-up" : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
