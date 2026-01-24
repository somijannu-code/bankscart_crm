"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isSameDay, setHours, setMinutes, isAfter } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, Users, Clock, CheckCircle, XCircle, AlertCircle, 
  MapPin, Wifi, Coffee, TrendingUp, Activity, UserCheck, LogOut, 
  FileSpreadsheet, Search 
} from "lucide-react";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; 
import { createClient } from "@/lib/supabase/client";

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
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Stats
  const [activeEmployees, setActiveEmployees] = useState<number>(0);
  const [employeesOnBreak, setEmployeesOnBreak] = useState<number>(0);

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('attendance-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        loadData(); 
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

      // PARALLEL FETCHING
      const [usersRes, attendanceRes, feedRes] = await Promise.all([
        supabase.from("users").select("*").eq("is_active", true).order("full_name"),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name, email, department)`).gte("date", startDateStr).lte("date", endDateStr).order("date", { ascending: false }),
        supabase.from("attendance").select(`*, user:users!attendance_user_id_fkey(full_name)`).eq("date", feedDateStr)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      setUsers(usersRes.data || []);

      const processedAttendance = (attendanceRes.data || []).map(record => ({
        ...record,
        status: determineStatus(record)
      }));
      setAttendanceData(processedAttendance);

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

  // --- HELPERS ---
  const determineStatus = (record: any) => {
    if (!record.check_in) return "absent";
    const checkInTime = parseISO(record.check_in);
    const hours = checkInTime.getHours();
    const minutes = checkInTime.getMinutes();
    if (hours > 9 || (hours === 9 && minutes > 30)) return "late";
    return "present";
  };

  const getLocationUrl = (data: any) => {
    if (!data) return null;
    try {
      const loc = typeof data === 'string' ? JSON.parse(data) : data;
      // FIX: Corrected Template Literals for Google Maps
      if (loc.latitude && loc.longitude) {
        return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
      }
      if (loc.coordinates) {
         return `https://www.google.com/maps?q=${loc.coordinates}`;
      }
    } catch (e) { return null; }
    return null;
  };

  const formatLocationText = (data: any) => {
    if (!data) return "-";
    if (typeof data === 'string') return data.substring(0, 20) + "...";
    if (data.address) return data.address.substring(0, 20) + "...";
    return "Coordinates";
  };

  // --- FILTERING ---
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === "all" || user.department === departmentFilter;
    
    if (statusFilter === "all") return matchesSearch && matchesDept;

    const userRecord = attendanceData.find(a => a.user_id === user.id && isSameDay(parseISO(a.date), dateRange.start));
    const status = userRecord ? userRecord.status : 'absent';
    return matchesSearch && matchesDept && status === statusFilter;
  });

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

  // --- CSV EXPORT ---
  const handleExport = () => {
    setIsExporting(true);
    try {
      const headers = view === 'daily' 
        ? ["Employee", "Department", "Date", "Status", "Check In", "Check Out", "Hours", "Overtime"]
        : ["Employee", "Department", "Month", "Days Present", "Lates", "Total Hours", "Avg Hours/Day"];

      const rows = filteredUsers.map(user => {
        const userRecords = attendanceData.filter(a => a.user_id === user.id);
        
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

  // --- STATS ---
  const stats = useMemo(() => {
    if (view === 'monthly') return { present: 0, late: 0, absent: 0 };
    const dailyRecords = attendanceData.filter(r => isSameDay(parseISO(r.date), dateRange.start));
    return {
      present: dailyRecords.filter(r => r.status === 'present').length,
      late: dailyRecords.filter(r => r.status === 'late').length,
      absent: users.length - dailyRecords.length 
    };
  }, [attendanceData, users.length, view, dateRange]);

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

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Attendance Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage team presence and working hours</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={view} onValueChange={(v: any) => setView(v)}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily View</SelectItem>
              <SelectItem value="monthly">Monthly View</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center bg-white rounded-md border shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')}>&lt;</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-40 font-medium">
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                  {view === 'daily' ? format(dateRange.start, "MMM dd, yyyy") : format(dateRange.start, "MMMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateRange.start} onSelect={(d) => d && setDateRange(view === 'daily' ? {start: d, end: d} : {start: startOfMonth(d), end: endOfMonth(d)})} />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')}>&gt;</Button>
          </div>

          <Button variant="outline" onClick={handleExport} disabled={isExporting} className="bg-white">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI CARDS (Only visible in Daily View) */}
      {view === 'daily' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-4 pt-6">
              <div className="flex justify-between">
                <div><p className="text-sm font-medium text-gray-500">Total Staff</p><h2 className="text-2xl font-bold">{users.length}</h2></div>
                <Users className="h-8 w-8 text-blue-100" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-4 pt-6">
              <div className="flex justify-between">
                <div><p className="text-sm font-medium text-gray-500">Present</p><h2 className="text-2xl font-bold text-green-600">{stats.present}</h2></div>
                <CheckCircle className="h-8 w-8 text-green-100" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 shadow-sm">
            <CardContent className="p-4 pt-6">
              <div className="flex justify-between">
                <div><p className="text-sm font-medium text-gray-500">Late Arrival</p><h2 className="text-2xl font-bold text-yellow-600">{stats.late}</h2></div>
                <Clock className="h-8 w-8 text-yellow-100" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="p-4 pt-6">
              <div className="flex justify-between">
                <div><p className="text-sm font-medium text-gray-500">Absent</p><h2 className="text-2xl font-bold text-red-600">{stats.absent}</h2></div>
                <XCircle className="h-8 w-8 text-red-100" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT: TABLE AREA */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Attendance Records
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search employee..." className="pl-9 w-48 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Dept" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Depts</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  {view === 'daily' && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="absent">Absent</SelectItem></SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[200px]">Employee</TableHead>
                    {view === 'daily' ? (
                      <>
                        <TableHead>Status</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Check-Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Location</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Days Present</TableHead>
                        <TableHead>Late Days</TableHead>
                        <TableHead>Avg Hours</TableHead>
                        <TableHead>Total OT</TableHead>
                        <TableHead>Efficiency</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={6}><div className="h-8 bg-gray-100 rounded animate-pulse" /></TableCell></TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No employees found.</TableCell></TableRow>
                  ) : (
                    filteredUsers.map(user => {
                      const userRecords = attendanceData.filter(a => a.user_id === user.id);

                      // --- RENDER DAILY ROW ---
                      if (view === 'daily') {
                        const record = userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start));
                        const status = record ? record.status : 'absent';
                        
                        return (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.department}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status === 'absent' ? 'destructive' : status === 'late' ? 'secondary' : 'default'} className={status === 'late' ? 'bg-yellow-100 text-yellow-800' : status === 'present' ? 'bg-green-100 text-green-800' : ''}>
                                {status === 'late' ? 'Late' : status === 'present' ? 'Present' : 'Absent'}
                              </Badge>
                            </TableCell>
                            <TableCell>{record?.check_in ? format(new Date(record.check_in), "hh:mm a") : "-"}</TableCell>
                            <TableCell>{record?.check_out ? format(new Date(record.check_out), "hh:mm a") : "-"}</TableCell>
                            <TableCell>{record?.total_hours ? <span className="font-mono">{record.total_hours}h</span> : "-"}</TableCell>
                            <TableCell>
                              {record?.location_check_in ? (
                                <a 
                                  href={getLocationUrl(record.location_check_in) || '#'} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                >
                                  <MapPin className="h-3 w-3" /> {formatLocationText(record.location_check_in)}
                                </a>
                              ) : <span className="text-xs text-gray-400">Remote/N/A</span>}
                            </TableCell>
                          </TableRow>
                        );
                      } 
                      
                      // --- RENDER MONTHLY ROW ---
                      else {
                        const present = userRecords.filter(r => r.status !== 'absent').length;
                        const lates = userRecords.filter(r => r.status === 'late').length;
                        const totalHrs = userRecords.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
                        const totalOT = userRecords.reduce((acc, r) => acc + (Number(r.overtime_hours) || 0), 0);
                        const avgHrs = present > 0 ? (totalHrs / present).toFixed(1) : "0";

                        return (
                          <TableRow key={user.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.department}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{present}</span>
                                <span className="text-xs text-gray-400">/ {new Date(dateRange.end).getDate()}</span>
                              </div>
                            </TableCell>
                            <TableCell className={lates > 0 ? "text-yellow-600 font-medium" : "text-gray-400"}>{lates}</TableCell>
                            <TableCell><span className="font-mono text-sm">{avgHrs}h</span></TableCell>
                            <TableCell className={totalOT > 0 ? "text-green-600 font-medium" : "text-gray-400"}>{totalOT > 0 ? `+${totalOT.toFixed(1)}` : "-"}</TableCell>
                            <TableCell>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-blue-500 h-full rounded-full" 
                                  style={{ width: `${Math.min(100, (Number(avgHrs) / 9) * 100)}%` }} 
                                />
                              </div>
                            </TableCell>
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

        {/* RIGHT: ACTIVITY FEED (Only on Daily View or General) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Live Status */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="py-4 border-b bg-gray-50"><CardTitle className="text-sm">Live Status</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-500"/><span className="text-sm">Active Now</span></div>
                <span className="font-bold text-lg">{activeEmployees}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Coffee className="h-4 w-4 text-orange-500"/><span className="text-sm">On Break</span></div>
                <span className="font-bold text-lg">{employeesOnBreak}</span>
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="shadow-sm border-gray-200 flex-1 h-[500px]">
            <CardHeader className="py-4 border-b"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4"/> Activity Feed</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-y-auto h-[440px]">
              {activityFeed.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-xs">No activity yet today.</div>
              ) : (
                <div className="divide-y">
                  {activityFeed.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-gray-50 flex gap-3">
                      <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${item.type.includes('in') ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">{item.user_name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          {item.type === 'check-in' ? 'Checked In' : item.type === 'check-out' ? 'Checked Out' : 'Break'} 
                          <span>•</span> 
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
    </div>
  );
}
