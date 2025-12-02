"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isSameDay, setHours, setMinutes, isAfter } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon,
  Users, 
  Clock, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  MapPin, 
  Wifi, 
  Coffee,
  TrendingUp,
  Activity,
  UserCheck,
  Pause,
  Monitor,
  LogOut,
  Globe
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar"; 
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { User, AttendanceRecord } from "@/lib/database-schema";

// Updated ActivityItem type
type ActivityItem = {
  id: string;
  type: 'check-in' | 'check-out' | 'break-start' | 'break-end';
  user_name: string;
  time: string;
  timestamp: number;
  location?: any; // Changed to any to handle JSONB
  ip?: string | null;
};

export function AdminAttendanceDashboard() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  });
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [users, setUsers] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<number>(0);
  const [employeesOnBreak, setEmployeesOnBreak] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, view]);

  // --- Helper to safely extract string from Location JSON/String ---
  const getLocationString = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    // Check if it's the object structure we defined { coordinates: "..." }
    if (typeof data === 'object' && data !== null) {
      if (data.coordinates) return data.coordinates;
      // Fallback: try to stringify or return a placeholder
      return JSON.stringify(data);
    }
    return String(data);
  };

  // --- Helper to shorten the display text ---
  const formatLocationData = (data: any) => {
    const text = getLocationString(data);
    if (!text || text === 'null' || text === '{}') return '-';
    return text.length > 25 ? text.substring(0, 25) + '...' : text;
  };

  const determineStatus = (record: AttendanceRecord) => {
    if (!record.check_in) return "absent";
    const checkInTime = parseISO(record.check_in);
    const lateThreshold = setMinutes(setHours(checkInTime, 9), 30); 
    if (isAfter(checkInTime, lateThreshold)) return "late";
    return "present";
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (usersError) throw usersError;
      setUsers(usersData || []);

      const startDateStr = format(dateRange.start, "yyyy-MM-dd");
      const endDateStr = format(dateRange.end, "yyyy-MM-dd");

      const { data: rawAttendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(`*, user:users!attendance_user_id_fkey(full_name, email, role, department)`)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      if (attendanceError) throw attendanceError;

      const processedData = (rawAttendanceData || []).map(record => ({
        ...record,
        status: determineStatus(record)
      }));

      setAttendanceData(processedData);

      const feedDateStr = view === 'daily' ? startDateStr : format(new Date(), "yyyy-MM-dd");
      const { data: feedData } = await supabase
        .from("attendance")
        .select(`*, user:users!attendance_user_id_fkey(full_name)`)
        .eq("date", feedDateStr);

      if (feedData) {
        let feed: ActivityItem[] = [];
        let activeCount = 0;
        let breakCount = 0;

        feedData.forEach((record) => {
          if (record.check_in && !record.check_out) activeCount++;
          if (record.on_break) breakCount++;

          if (record.check_in) {
            feed.push({
              id: `${record.id}-in`,
              type: 'check-in',
              user_name: record.user?.full_name || 'Unknown',
              time: record.check_in,
              timestamp: new Date(record.check_in).getTime(),
              location: record.location_check_in,
              ip: record.ip_check_in
            });
          }
          if (record.check_out) {
            feed.push({
              id: `${record.id}-out`,
              type: 'check-out',
              user_name: record.user?.full_name || 'Unknown',
              time: record.check_out,
              timestamp: new Date(record.check_out).getTime()
            });
          }
          if (record.on_break && record.updated_at) {
             feed.push({
              id: `${record.id}-break-start`,
              type: 'break-start',
              user_name: record.user?.full_name || 'Unknown',
              time: record.updated_at,
              timestamp: new Date(record.updated_at).getTime()
            });
          }
        });

        feed.sort((a, b) => b.timestamp - a.timestamp);
        setActivityFeed(feed);
        setActiveEmployees(activeCount);
        setEmployeesOnBreak(breakCount);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-800";
      case "late": return "bg-yellow-100 text-yellow-800";
      case "absent": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "late": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "absent": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const navigateDateRange = (direction: 'prev' | 'next') => {
    const newDate = new Date(dateRange.start);
    if (view === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      setDateRange({ start: newDate, end: newDate });
    } else {
      const newStart = direction === 'prev' ? subMonths(dateRange.start, 1) : addMonths(dateRange.start, 1);
      setDateRange({ start: startOfMonth(newStart), end: endOfMonth(newStart) });
    }
  };

  const getStats = () => {
    const totalUsers = users.length;
    const currentRecords = view === 'daily' 
      ? attendanceData.filter(r => isSameDay(parseISO(r.date), dateRange.start))
      : attendanceData;

    const presentCount = currentRecords.filter(r => r.status === "present").length;
    const lateCount = currentRecords.filter(r => r.status === "late").length;
    const absentCount = totalUsers - (presentCount + lateCount);

    return {
      present: presentCount,
      late: lateCount,
      absent: Math.max(0, absentCount)
    };
  };
  
  const stats = getStats();

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const departments = Array.from(new Set(users.map(user => user.department).filter(Boolean))) as string[];

  if (loading && users.length === 0) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Attendance Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and manage team attendance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={view} onValueChange={(v) => setView(v as 'daily' | 'monthly')}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily View</SelectItem>
              <SelectItem value="monthly">Monthly View</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigateDateRange('prev')}>Previous</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={!dateRange ? "text-muted-foreground" : ""}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {view === 'daily' ? format(dateRange.start, "EEE, MMM dd, yyyy") : format(dateRange.start, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateRange.start}
                onSelect={(date) => date && setDateRange(view === 'daily' ? { start: date, end: date } : { start: startOfMonth(date), end: endOfMonth(date) })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => navigateDateRange('next')}>Next</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Team</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Active members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                On time
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Today</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
              <p className="text-xs text-muted-foreground">After 09:30 AM</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
              <p className="text-xs text-muted-foreground">No check-in</p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Feed ({format(dateRange.start, "MMM dd")})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length > 0 ? (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {activityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                    <div className="flex-shrink-0 mt-1">
                      {item.type === 'check-in' && <UserCheck className="h-4 w-4 text-green-500" />}
                      {item.type === 'check-out' && <LogOut className="h-4 w-4 text-gray-500" />}
                      {item.type === 'break-start' && <Coffee className="h-4 w-4 text-orange-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.user_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.type === 'check-in' && "Checked in"}
                        {item.type === 'check-out' && "Checked out"}
                        {item.type === 'break-start' && "Started break"}
                        <span className="mx-1">•</span>
                        {format(new Date(item.time), "hh:mm a")}
                      </p>
                      {/* FIX: Use helper function to render location string */}
                      {item.type === 'check-in' && (item.location || item.ip) && (
                        <div className="flex gap-2 mt-1">
                          {item.location && (
                            <div className="flex items-center text-[10px] text-gray-400 bg-gray-100 px-1 rounded" title={getLocationString(item.location) || ''}>
                              <MapPin className="h-3 w-3 mr-1" />
                              {formatLocationData(item.location)}
                            </div>
                          )}
                          {item.ip && (
                            <div className="flex items-center text-[10px] text-gray-400 bg-gray-100 px-1 rounded">
                              <Wifi className="h-3 w-3 mr-1" />
                              {item.ip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity recorded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Break</CardTitle>
            <Coffee className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{employeesOnBreak}</div>
            <p className="text-xs text-muted-foreground">Employees paused</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Idle Time</CardTitle>
            <Pause className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">0</div>
            <p className="text-xs text-muted-foreground">Minutes detected</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>{view === 'daily' ? `Attendance for ${format(dateRange.start, "EEEE, MMMM dd, yyyy")}` : `Attendance for ${format(dateRange.start, "MMMM yyyy")}`}</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Dept" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => {
                const userRecords = attendanceData.filter(a => a.user_id === user.id);
                const record = view === 'daily' 
                  ? userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start))
                  : userRecords[0]; 

                const displayStatus = record ? record.status : 'absent';
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.department || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(displayStatus)}
                        <Badge className={getStatusColor(displayStatus)}>
                          {displayStatus === 'late' ? 'Late' : (displayStatus === 'present' ? 'Present' : 'Absent')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{record?.check_in ? format(new Date(record.check_in), "hh:mm a") : '-'}</TableCell>
                    <TableCell>{record?.check_out ? format(new Date(record.check_out), "hh:mm a") : '-'}</TableCell>
                    <TableCell>{record?.total_hours || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {record?.overtime_hours ? <><TrendingUp className="h-4 w-4 text-green-500" />{record.overtime_hours}</> : '-'}
                      </div>
                    </TableCell>
                    
                    {/* FIX: Handle JSONB location safely */}
                    <TableCell>
                      {record?.location_check_in ? (
                        <div className="flex items-center gap-1 text-xs" title={getLocationString(record.location_check_in) || ''}>
                          <MapPin className="h-3 w-3 text-blue-500" />
                          {formatLocationData(record.location_check_in)}
                        </div>
                      ) : record?.check_in ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe className="h-3 w-3" />
                          Remote
                        </div>
                      ) : '-'}
                    </TableCell>

                    <TableCell>
                      {record?.ip_check_in ? (
                        <div className="flex items-center gap-1 text-xs" title={record.ip_check_in}>
                          <Wifi className="h-3 w-3 text-green-500" />
                          {record.ip_check_in}
                        </div>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
