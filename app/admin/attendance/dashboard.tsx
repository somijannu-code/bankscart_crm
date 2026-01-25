"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isSameDay, setHours, setMinutes, isAfter, eachDayOfInterval, differenceInMinutes, getDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, Users, Clock, CheckCircle, XCircle, AlertCircle, 
  MapPin, Coffee, TrendingUp, Activity, UserCheck, 
  FileSpreadsheet, Search, Settings, ChevronRight, BarChart3, List, Edit2, Save, X, MessageSquare, Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar"; 
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { toast } from "sonner";

// --- TYPES ---
type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status?: string; 
  location_check_in?: any;
  ip_check_in?: string;
  on_break?: boolean;
  updated_at?: string;
  admin_note?: string; 
  user?: User;
};

type ActivityItem = {
  id: string;
  type: 'check-in' | 'check-out' | 'break-start';
  user_name: string;
  time: string;
  timestamp: number;
  location?: any;
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

// --- MAIN COMPONENT ---
export function AdminAttendanceDashboard() {
  const supabase = createClient();

  // --- STATE ---
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [users, setUsers] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filters & Config
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lateThresholdHour, setLateThresholdHour] = useState(9);
  const [lateThresholdMinute, setLateThresholdMinute] = useState(30);
  
  // Modal Data State (NEW)
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMonthData, setUserMonthData] = useState<AttendanceRecord[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const [activeEmployees, setActiveEmployees] = useState<number>(0);
  const [employeesOnBreak, setEmployeesOnBreak] = useState<number>(0);

  // Edit Mode State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editNote, setEditNote] = useState("");

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('attendance-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        loadData();
        // Refresh modal data if open
        if(selectedUser) openUserModal(selectedUser);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange, view]);

  // --- DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    try {
      const startDateStr = format(dateRange.start, "yyyy-MM-dd");
      const endDateStr = format(dateRange.end, "yyyy-MM-dd");
      const feedDateStr = format(new Date(), "yyyy-MM-dd"); 

      const [usersRes, attendanceRes, feedRes] = await Promise.all([
        supabase.from("users").select("*").eq("is_active", true).order("full_name"),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name, email, department)`).gte("date", startDateStr).lte("date", endDateStr).order("date", { ascending: false }),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name)`).eq("date", feedDateStr)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      setUsers(usersRes.data || []);
      setAttendanceData(attendanceRes.data || []);

      if (feedRes.data) {
        let feed: ActivityItem[] = [];
        let activeCount = 0;
        let breakCount = 0;

        feedRes.data.forEach((record) => {
          if (record.check_in && !record.check_out) activeCount++;
          if (record.on_break) breakCount++;

          if (record.check_in) {
            feed.push({ id: `${record.id}-in`, type: 'check-in', user_name: record.user?.full_name || 'Unknown', time: record.check_in, timestamp: new Date(record.check_in).getTime(), location: record.location_check_in });
          }
          if (record.check_out) {
            feed.push({ id: `${record.id}-out`, type: 'check-out', user_name: record.user?.full_name || 'Unknown', time: record.check_out, timestamp: new Date(record.check_out).getTime() });
          }
        });

        feed.sort((a, b) => b.timestamp - a.timestamp);
        setActivityFeed(feed);
        setActiveEmployees(activeCount);
        setEmployeesOnBreak(breakCount);
      }
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: FETCH FULL MONTH FOR MODAL ---
  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    setLoadingModal(true);
    
    // Always fetch the FULL month for the modal calendar, regardless of main dashboard view
    const monthStart = format(startOfMonth(dateRange.start), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(dateRange.start), "yyyy-MM-dd");

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    if (data) {
        // Process status immediately for the modal
        const processed = data.map(r => ({ ...r, status: determineStatus(r) }));
        setUserMonthData(processed);
    } else {
        setUserMonthData([]);
    }
    setLoadingModal(false);
  };

  // --- HELPERS ---
  const determineStatus = (record: any) => {
    if (!record.check_in) return "absent";
    const checkInTime = parseISO(record.check_in);
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    const thresholdMinutes = lateThresholdHour * 60 + lateThresholdMinute;
    if (checkInMinutes > thresholdMinutes) return "late";
    return "present";
  };

  const calculateLateMinutes = (checkInTime: string) => {
    const time = parseISO(checkInTime);
    const checkInMinutes = time.getHours() * 60 + time.getMinutes();
    const thresholdMinutes = lateThresholdHour * 60 + lateThresholdMinute;
    return Math.max(0, checkInMinutes - thresholdMinutes);
  };

  const getReliabilityScore = (userRecords: AttendanceRecord[]) => {
    if (userRecords.length === 0) return 0;
    const present = userRecords.filter(r => r.status !== 'absent').length;
    const lates = userRecords.filter(r => r.status === 'late').length;
    
    // Simple Score: Present is good, Late is slight penalty
    const rawScore = ((present * 3) - (lates * 1)); 
    const basis = Math.max(userRecords.length, 5) * 3; 
    
    let score = (rawScore / basis) * 100;
    return Math.min(100, Math.max(0, Math.round(score)));
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 75) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getLocationUrl = (data: any) => {
    if (!data) return null;
    try {
      const loc = typeof data === 'string' ? JSON.parse(data) : data;
      if (loc.latitude && loc.longitude) return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
      if (loc.coordinates) return `https://www.google.com/maps/search/?api=1&query=${loc.coordinates}`;
    } catch (e) { return null; }
    return null;
  };

  const formatLocationText = (data: any) => {
    if (!data) return "-";
    if (typeof data === 'string') return data.substring(0, 15) + "...";
    if (data.address) return data.address.substring(0, 15) + "...";
    return "Coordinates";
  };

  // --- MEMOIZED DATA PROCESSING ---
  const processedData = useMemo(() => {
    return attendanceData.map(record => ({
      ...record,
      status: determineStatus(record)
    }));
  }, [attendanceData, lateThresholdHour, lateThresholdMinute]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === "all" || user.department === departmentFilter;
      if (statusFilter === "all") return matchesSearch && matchesDept;
      
      const userRecords = processedData.filter(a => a.user_id === user.id);
      if (view === 'daily') {
        const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
        const status = record ? record.status : 'absent';
        return matchesSearch && matchesDept && status === statusFilter;
      }
      return matchesSearch && matchesDept;
    });
  }, [users, searchTerm, departmentFilter, statusFilter, processedData, view, dateRange]);

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

  // --- CHART DATA ---
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const trend = days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const records = processedData.filter(r => r.date === dayStr);
      return {
        date: format(day, "MMM dd"),
        present: records.filter(r => r.status === 'present').length,
        late: records.filter(r => r.status === 'late').length,
        absent: users.length - records.length
      };
    }).slice(-14);

    const deptStats: any = {};
    processedData.forEach(r => {
      if (!r.user?.department) return;
      if (!deptStats[r.user.department]) deptStats[r.user.department] = { name: r.user.department, value: 0 };
      if (r.status !== 'absent') deptStats[r.user.department].value += 1;
    });
    const deptPie = Object.values(deptStats);

    const lateCounts: Record<string, number> = {};
    processedData.filter(r => r.status === 'late').forEach(r => {
        const name = r.user?.full_name || 'Unknown';
        lateCounts[name] = (lateCounts[name] || 0) + 1;
    });
    const topViolators = Object.entries(lateCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);

    return { trend, deptPie, topViolators };
  }, [processedData, users.length, dateRange]);

  // --- ACTIONS ---
  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditCheckIn(record.check_in ? format(parseISO(record.check_in), "HH:mm") : "");
    setEditCheckOut(record.check_out ? format(parseISO(record.check_out), "HH:mm") : "");
    setEditNote(record.admin_note || "");
  };

  const saveEdit = async () => {
    if (!editingRecord) return;
    try {
        const datePart = editingRecord.date; 
        const updates: any = { admin_note: editNote };
        if (editCheckIn) updates.check_in = `${datePart}T${editCheckIn}:00`;
        if (editCheckOut) updates.check_out = `${datePart}T${editCheckOut}:00`;
        
        if (updates.check_in && updates.check_out) {
            const start = new Date(updates.check_in);
            const end = new Date(updates.check_out);
            const diffMs = end.getTime() - start.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            updates.total_hours = parseFloat(diffHours.toFixed(2));
            updates.overtime_hours = Math.max(0, parseFloat((diffHours - 9).toFixed(2))); 
        }

        const { error } = await supabase.from('attendance').update(updates).eq('id', editingRecord.id);
        if (error) throw error;
        
        // Refresh both main list and modal list
        loadData(); 
        if(selectedUser) openUserModal(selectedUser);

        setEditingRecord(null);
        toast("Record updated.");
    } catch (e) { console.error(e); toast("Failed to update."); }
  };

  // --- STATS ---
  const stats = useMemo(() => {
    if (view === 'monthly') {
       return {
         present: processedData.filter(r => r.status === 'present').length,
         late: processedData.filter(r => r.status === 'late').length,
         absent: (users.length * 30) - processedData.length 
       };
    }
    const dailyRecords = processedData.filter(r => isSameDay(parseISO(r.date), dateRange.start));
    return {
      present: dailyRecords.filter(r => r.status === 'present').length,
      late: dailyRecords.filter(r => r.status === 'late').length,
      absent: users.length - dailyRecords.length 
    };
  }, [processedData, users.length, view, dateRange]);

  const navigate = (dir: 'prev' | 'next') => {
    if (view === 'daily') {
      const d = new Date(dateRange.start);
      d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
      setDateRange({ start: d, end: d });
    } else {
      const d = dir === 'prev' ? subMonths(dateRange.start, 1) : addMonths(dateRange.start, 1);
      setDateRange({ start: startOfMonth(d), end: endOfMonth(d) });
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const headers = view === 'daily' 
        ? ["Employee", "Department", "Date", "Status", "Check In", "Check Out", "Hours", "Overtime"]
        : ["Employee", "Department", "Month", "Days Present", "Lates", "Total Hours", "Avg Hours/Day"];

      const rows = filteredUsers.map(user => {
        const userRecords = processedData.filter(a => a.user_id === user.id);
        
        if (view === 'daily') {
          const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
          return [
            user.full_name,
            user.department,
            format(dateRange.start, "yyyy-MM-dd"),
            record ? record.status : "absent",
            record?.check_in ? format(new Date(record.check_in), "HH:mm") : "-",
            record?.check_out ? format(new Date(record.check_out), "HH:mm") : "-",
            record?.total_hours || "0",
            record?.overtime_hours || "0"
          ];
        } else {
          const presentCount = userRecords.filter(r => r.status !== 'absent').length;
          const lateCount = userRecords.filter(r => r.status === 'late').length;
          const totalHrs = userRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
          const avgHrs = presentCount > 0 ? (totalHrs / presentCount).toFixed(1) : "0";
          
          return [
            user.full_name,
            user.department,
            format(dateRange.start, "MMMM yyyy"),
            presentCount,
            lateCount,
            totalHrs.toFixed(1),
            avgHrs
          ];
        }
      });

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `attendance_${view}_${format(dateRange.start, "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { console.error(e); } 
    finally { setIsExporting(false); }
  };

  const getDayStatusColor = (day: Date, userRecords: AttendanceRecord[]) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const record = userRecords.find(r => r.date === dayStr);
    if (!record) return 'bg-slate-50 text-slate-300 border-slate-100'; 
    if (record.status === 'late') return 'bg-yellow-50 text-yellow-700 border-yellow-200 font-medium';
    if (record.status === 'present') return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
    return 'bg-slate-50 text-slate-400';
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Attendance Manager</h1>
          <p className="text-slate-500 mt-1">Real-time team tracking and analytics</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="icon"><Settings className="h-4 w-4 text-slate-600"/></Button></PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium leading-none">Configuration</h4>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-slate-500">Late Threshold</span><span className="text-sm font-bold">{lateThresholdHour}:{lateThresholdMinute.toString().padStart(2, '0')} AM</span></div>
                  <Slider value={[lateThresholdHour]} min={7} max={11} step={1} onValueChange={(v) => setLateThresholdHour(v[0])} className="py-1" />
                  <Slider value={[lateThresholdMinute]} min={0} max={59} step={5} onValueChange={(v) => setLateThresholdMinute(v[0])} className="py-1" />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center bg-white rounded-md border shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')}><span className="sr-only">Prev</span>{"<"}</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-44 font-medium justify-start px-3">
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                  {view === 'daily' ? format(dateRange.start, "MMM dd, yyyy") : format(dateRange.start, "MMMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateRange.start} onSelect={(d) => d && setDateRange(view === 'daily' ? {start: d, end: d} : {start: startOfMonth(d), end: endOfMonth(d)})} />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')}><span className="sr-only">Next</span>{">"}</Button>
          </div>

          <Button variant="outline" onClick={handleExport} disabled={isExporting} className="bg-white">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Export
          </Button>
        </div>
      </div>

      {/* TABS LAYOUT */}
      <Tabs defaultValue="roster" className="w-full">
        <div className="flex justify-between items-center mb-4">
           <TabsList className="bg-white border">
             <TabsTrigger value="roster" className="gap-2"><List className="h-4 w-4"/> Roster</TabsTrigger>
             <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4"/> Analytics</TabsTrigger>
           </TabsList>
           
           <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <Button variant={view === 'daily' ? 'default' : 'ghost'} size="sm" onClick={() => setView('daily')} className="text-xs h-7">Daily</Button>
              <Button variant={view === 'monthly' ? 'default' : 'ghost'} size="sm" onClick={() => setView('monthly')} className="text-xs h-7">Monthly</Button>
           </div>
        </div>

        {/* --- TAB 1: ROSTER VIEW --- */}
        <TabsContent value="roster" className="space-y-6">
          {view === 'daily' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500 shadow-sm"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Total Staff</p><h2 className="text-2xl font-bold">{users.length}</h2></div><div className="p-2 bg-blue-50 rounded-full"><Users className="h-6 w-6 text-blue-500" /></div></CardContent></Card>
              <Card className="border-l-4 border-l-green-500 shadow-sm"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Present</p><h2 className="text-2xl font-bold text-green-600">{stats.present}</h2></div><div className="p-2 bg-green-50 rounded-full"><CheckCircle className="h-6 w-6 text-green-500" /></div></CardContent></Card>
              <Card className="border-l-4 border-l-yellow-500 shadow-sm"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Late</p><h2 className="text-2xl font-bold text-yellow-600">{stats.late}</h2></div><div className="p-2 bg-yellow-50 rounded-full"><Clock className="h-6 w-6 text-yellow-500" /></div></CardContent></Card>
              <Card className="border-l-4 border-l-red-500 shadow-sm"><CardContent className="p-4 pt-6 flex justify-between items-center"><div><p className="text-sm font-medium text-slate-500">Absent</p><h2 className="text-2xl font-bold text-red-600">{stats.absent}</h2></div><div className="p-2 bg-red-50 rounded-full"><XCircle className="h-6 w-6 text-red-500" /></div></CardContent></Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Team Attendance</CardTitle>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search..." className="pl-9 w-40 h-9 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-32 h-9 bg-white"><SelectValue placeholder="Dept" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Depts</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      {view === 'daily' && (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-32 h-9 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="absent">Absent</SelectItem></SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[200px]">Employee</TableHead>
                        {view === 'daily' ? (
                          <>
                            <TableHead>Status</TableHead>
                            <TableHead>Check-In</TableHead>
                            <TableHead>Check-Out</TableHead>
                            <TableHead>Shift Progress</TableHead>
                            <TableHead>Location</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Reliability Score</TableHead>
                            <TableHead>Days Present</TableHead>
                            <TableHead>Lates</TableHead>
                            <TableHead>Avg Hrs</TableHead>
                            <TableHead>Action</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><div className="h-8 bg-slate-100 rounded animate-pulse" /></TableCell></TableRow>)
                      ) : filteredUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No records found.</TableCell></TableRow>
                      ) : (
                        filteredUsers.map(user => {
                          const userRecords = processedData.filter(a => a.user_id === user.id);

                          if (view === 'daily') {
                            const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
                            const status = record ? record.status : 'absent';
                            const progress = Math.min(100, (Number(record?.total_hours || 0) / 9) * 100);
                            
                            return (
                              <TableRow key={user.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openUserModal(user)}>
                                <TableCell>
                                  <div className="font-medium text-slate-900">{user.full_name}</div>
                                  <div className="text-xs text-slate-500">{user.department}</div>
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className={status === 'late' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 cursor-help' : status === 'present' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                          {status === 'late' ? 'Late' : status === 'present' ? 'Present' : 'Absent'}
                                        </Badge>
                                      </TooltipTrigger>
                                      {status === 'late' && record?.check_in && (
                                        <TooltipContent><p>Late by {calculateLateMinutes(record.check_in)} mins</p></TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{record?.check_in ? format(new Date(record.check_in), "hh:mm a") : "-"}</TableCell>
                                <TableCell className="font-mono text-xs">{record?.check_out ? format(new Date(record.check_out), "hh:mm a") : "-"}</TableCell>
                                <TableCell>
                                   <div className="flex items-center gap-2">
                                      <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                                      </div>
                                      <span className="text-xs font-mono">{record?.total_hours || 0}h</span>
                                   </div>
                                </TableCell>
                                <TableCell>
                                  {record?.location_check_in ? (
                                    <a href={getLocationUrl(record.location_check_in) || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs" onClick={(e) => e.stopPropagation()}>
                                      <MapPin className="h-3 w-3" /> View
                                    </a>
                                  ) : <span className="text-xs text-slate-400">N/A</span>}
                                </TableCell>
                              </TableRow>
                            );
                          } else {
                            const present = userRecords.filter(r => r.status !== 'absent').length;
                            const lates = userRecords.filter(r => r.status === 'late').length;
                            const totalHrs = userRecords.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
                            const avgHrs = present > 0 ? (totalHrs / present).toFixed(1) : "0";
                            const score = getReliabilityScore(userRecords);

                            return (
                              <TableRow key={user.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openUserModal(user)}>
                                <TableCell>
                                  <div className="font-medium text-slate-900">{user.full_name}</div>
                                  <div className="text-xs text-slate-500">{user.department}</div>
                                </TableCell>
                                <TableCell>
                                   <Badge variant="outline" className={`${getScoreColor(score)} font-bold`}>{score}%</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700">{present}</span>
                                    <span className="text-xs text-slate-400">days</span>
                                  </div>
                                </TableCell>
                                <TableCell className={lates > 0 ? "text-yellow-600 font-medium" : "text-slate-400"}>{lates} Late</TableCell>
                                <TableCell><span className="font-mono text-sm">{avgHrs}h</span></TableCell>
                                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4 text-slate-400"/></Button></TableCell>
                              </TableRow>
                            )
                          }
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-4 border-b bg-slate-50/50"><CardTitle className="text-sm font-semibold">Live Snapshot</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-500"/><span className="text-sm text-slate-600">Active Now</span></div>
                    <span className="font-bold text-lg">{activeEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><Coffee className="h-4 w-4 text-orange-500"/><span className="text-sm text-slate-600">On Break</span></div>
                    <span className="font-bold text-lg">{employeesOnBreak}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 flex-1 h-[500px]">
                <CardHeader className="py-4 border-b"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4"/> Activity Feed</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-y-auto h-[440px]">
                  {activityFeed.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">No activity yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activityFeed.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-slate-50 flex gap-3">
                          <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${item.type.includes('in') ? 'bg-green-500' : 'bg-slate-400'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{item.user_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              {item.type === 'check-in' ? 'Checked In' : item.type === 'check-out' ? 'Checked Out' : 'Break'} 
                              <span className="text-slate-300">•</span> 
                              {format(new Date(item.time), "hh:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: ANALYTICS VIEW --- */}
        <TabsContent value="analytics" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-base">Attendance Trend</CardTitle><CardDescription>Present vs Late over time</CardDescription></CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData.trend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} />
                          <Legend />
                          <Bar dataKey="present" fill="#10b981" radius={[4,4,0,0]} stackId="a" />
                          <Bar dataKey="late" fill="#f59e0b" radius={[4,4,0,0]} stackId="a" />
                          <Bar dataKey="absent" fill="#ef4444" radius={[4,4,0,0]} stackId="a" />
                       </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>

              {/* NEW: TOP VIOLATORS */}
              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500"/> Frequent Latecomers</CardTitle><CardDescription>Top employees late this month</CardDescription></CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                       {chartData.topViolators.map((user, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-700">{idx+1}</div>
                                <span className="font-medium text-sm">{user.name}</span>
                             </div>
                             <Badge variant="outline" className="bg-red-50 text-red-700">{user.count} Late</Badge>
                          </div>
                       ))}
                       {chartData.topViolators.length === 0 && <div className="text-center text-slate-400 py-8">No late arrivals recorded.</div>}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>

      {/* --- EMPLOYEE MODAL (WITH CALENDAR & EDIT) --- */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (() => {
             const userRecords = userMonthData;
             const presentCount = userRecords.filter(r => r.status !== 'absent').length;
             const lateCount = userRecords.filter(r => r.status === 'late').length;
             const totalHrs = userRecords.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
             const monthStart = startOfMonth(dateRange.start);
             const monthEnd = endOfMonth(dateRange.start);
             const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

             return (
               <>
                 <DialogHeader className="mb-4">
                   <div className="flex justify-between items-start">
                     <div>
                       <DialogTitle className="flex items-center gap-2 text-2xl">
                         {selectedUser.full_name}
                         <Badge variant="secondary" className="font-normal">{selectedUser.department}</Badge>
                       </DialogTitle>
                       <DialogDescription>Attendance Report for {format(dateRange.start, "MMMM yyyy")}</DialogDescription>
                     </div>
                   </div>
                 </DialogHeader>
                 
                 {loadingModal ? (
                    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-slate-400"/></div>
                 ) : (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 space-y-6">
                       <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                             <div className="text-[10px] text-blue-500 font-bold uppercase">Total Hours</div>
                             <div className="text-xl font-bold text-blue-700">{totalHrs.toFixed(1)}</div>
                          </div>
                          <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-center">
                             <div className="text-[10px] text-yellow-500 font-bold uppercase">Lates</div>
                             <div className="text-xl font-bold text-yellow-700">{lateCount}</div>
                          </div>
                       </div>

                       <div className="border rounded-md">
                          <div className="bg-slate-50 p-2 border-b font-semibold text-xs uppercase text-slate-500">Recent Activity</div>
                          <div className="max-h-[300px] overflow-y-auto">
                             {userRecords.slice(0, 10).map(r => (
                                <div key={r.id} className="p-3 border-b text-sm flex justify-between items-center hover:bg-slate-50 cursor-pointer" onClick={() => handleEdit(r)}>
                                   <div>
                                      <div className="font-medium">{format(parseISO(r.date), "MMM dd")}</div>
                                      <div className="text-xs text-slate-400">{r.check_in ? format(parseISO(r.check_in), "hh:mm a") : "-"}</div>
                                   </div>
                                   <div className="flex flex-col items-end gap-1">
                                      <Badge variant="outline" className={r.status === 'late' ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50"}>{r.status}</Badge>
                                      {r.admin_note && <div className="text-[9px] text-slate-400 flex items-center gap-1"><MessageSquare className="w-2 h-2"/> Note</div>}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="col-span-2">
                       <div className="border rounded-xl p-4 shadow-sm">
                          <div className="font-semibold mb-4 text-center">{format(monthStart, "MMMM yyyy")}</div>
                          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-400 mb-2">
                             {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                          </div>
                          <div className="grid grid-cols-7 gap-2">
                             {Array.from({ length: getDay(monthStart) }).map((_, i) => <div key={`empty-${i}`} />)}
                             {monthDays.map(day => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                const record = userRecords.find(r => r.date === dayStr);
                                const color = record ? (record.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200') : 'bg-slate-50 text-slate-300';
                                
                                return (
                                   <div 
                                     key={dayStr} 
                                     onClick={() => record && handleEdit(record)}
                                     className={`h-16 border rounded-lg p-1 flex flex-col justify-between cursor-pointer hover:ring-2 ring-blue-200 transition-all ${color}`}
                                   >
                                      <div className="text-right font-bold text-xs">{format(day, "d")}</div>
                                      {record && (
                                         <div className="text-[9px] leading-tight font-mono text-center">
                                            <div>{record.check_in ? format(parseISO(record.check_in), "HH:mm") : ""}</div>
                                         </div>
                                      )}
                                   </div>
                                )
                             })}
                          </div>
                       </div>
                    </div>
                 </div>
                 )}
               </>
             )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- EDIT DIALOG --- */}
      <Dialog open={!!editingRecord} onOpenChange={(o) => !o && setEditingRecord(null)}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Edit Attendance</DialogTitle>
               <DialogDescription>Correction for {editingRecord && format(parseISO(editingRecord.date), "MMM dd, yyyy")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="in" className="text-right">Check In</Label>
                  <Input id="in" type="time" value={editCheckIn} onChange={e => setEditCheckIn(e.target.value)} className="col-span-3" />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="out" className="text-right">Check Out</Label>
                  <Input id="out" type="time" value={editCheckOut} onChange={e => setEditCheckOut(e.target.value)} className="col-span-3" />
               </div>
               <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="note" className="text-right mt-2">Reason</Label>
                  <Textarea id="note" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="e.g. System glitch, forgot ID..." className="col-span-3" />
               </div>
            </div>
            <DialogFooter>
               <Button type="submit" onClick={saveEdit}>Save changes</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
}
