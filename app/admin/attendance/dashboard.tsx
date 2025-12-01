"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, // Renamed to avoid conflict
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
  TrendingDown,
  Activity,
  UserCheck,
  Pause,
  Monitor,
  LogOut, // Added for Check-out
  PlayCircle // Added for Resume/End Break
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
import { Calendar } from "@/components/ui/calendar"; // UI Component
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover"; // UI Component
import { createClient } from "@/lib/supabase/client";
import { User, AttendanceRecord } from "@/lib/database-schema";

// Helper type for the unified feed
type ActivityItem = {
  id: string;
  type: 'check-in' | 'check-out' | 'break-start' | 'break-end';
  user_name: string;
  time: string;
  timestamp: number; // for sorting
};

export function AdminAttendanceDashboard() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [users, setUsers] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  
  // New state for the unified activity feed
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<number>(0);
  const [employeesOnBreak, setEmployeesOnBreak] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    loadData();
    
    // Set up real-time subscription
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

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // 2. Fetch Attendance Data for Selected Range
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select(`*, user:users!attendance_user_id_fkey(full_name, email, role, department)`)
        .gte("date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("date", format(dateRange.end, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (attendanceError) throw attendanceError;
      setAttendanceData(attendanceData || []);

      // 3. Process Live Activity Feed (Today's Data Only)
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      // Fetch specifically for "Today" to build the live feed
      const { data: todayData } = await supabase
        .from("attendance")
        .select(`*, user:users!attendance_user_id_fkey(full_name)`)
        .eq("date", todayStr);

      if (todayData) {
        let feed: ActivityItem[] = [];
        let activeCount = 0;
        let breakCount = 0;

        todayData.forEach((record) => {
          // Track counts
          if (record.check_in && !record.check_out) activeCount++;
          if (record.on_break) breakCount++;

          // Add Check-in Event
          if (record.check_in) {
            feed.push({
              id: `${record.id}-in`,
              type: 'check-in',
              user_name: record.user?.full_name || 'Unknown',
              time: record.check_in,
              timestamp: new Date(record.check_in).getTime()
            });
          }

          // Add Check-out Event
          if (record.check_out) {
            feed.push({
              id: `${record.id}-out`,
              type: 'check-out',
              user_name: record.user?.full_name || 'Unknown',
              time: record.check_out,
              timestamp: new Date(record.check_out).getTime()
            });
          }

          // Add Break Event (If strictly tracking break start/end requires separate columns)
          // Assuming 'updated_at' reflects the last status change if on_break is true
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

        // Sort by timestamp descending (newest first)
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
      case "half-day": return "bg-orange-100 text-orange-800";
      case "leave": return "bg-blue-100 text-blue-800";
      case "holiday": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "late": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "absent": return <XCircle className="h-4 w-4 text-red-500" />;
      case "half-day": return <Clock className="h-4 w-4 text-orange-500" />;
      case "leave": return <Coffee className="h-4 w-4 text-blue-500" />;
      case "holiday": return <CalendarIcon className="h-4 w-4 text-purple-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = parseISO(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const navigateDateRange = (direction: 'prev' | 'next') => {
    if (view === 'daily') {
      const newDate = direction === 'prev' 
        ? new Date(dateRange.start.setDate(dateRange.start.getDate() - 1))
        : new Date(dateRange.start.setDate(dateRange.start.getDate() + 1));
      
      setDateRange({ start: newDate, end: newDate });
    } else {
      const newStart = direction === 'prev' 
        ? subMonths(dateRange.start, 1)
        : addMonths(dateRange.start, 1);
      
      setDateRange({ start: startOfMonth(newStart), end: endOfMonth(newStart) });
    }
  };

  // Stats calculation
  const getStats = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayRecords = attendanceData.filter(record => record.date === today);
    return {
      present: todayRecords.filter(r => r.status === "present" || r.status === "late").length,
      absent: todayRecords.filter(r => r.status === "absent").length,
      late: todayRecords.filter(r => r.status === "late").length
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

  const exportData = (format: 'csv' | 'excel' | 'pdf') => {
    console.log(`Exporting data in ${format} format`);
  };

  if (loading && users.length === 0) {
    return <div className="p-6">Loading attendance data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Attendance Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and manage team attendance</p>
        </div>
        <div className="flex gap-2">
          <Select value={view} onValueChange={(v) => setView(v as 'daily' | 'monthly')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily View</SelectItem>
              <SelectItem value="monthly">Monthly View</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => navigateDateRange('prev')}>
            Previous
          </Button>
          
          {/* FIXED: Interactive Date Picker Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={!dateRange ? "text-muted-foreground" : ""}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {view === 'daily' 
                  ? format(dateRange.start, "EEE, MMM dd, yyyy")
                  : format(dateRange.start, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.start}
                onSelect={(date) => {
                  if (date) {
                    if (view === 'daily') {
                      setDateRange({ start: date, end: date });
                    } else {
                      setDateRange({ start: startOfMonth(date), end: endOfMonth(date) });
                    }
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" onClick={() => navigateDateRange('next')}>
            Next
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportData('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData('excel')}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData('pdf')}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Real-Time Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Team */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Team</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Active team members</p>
            </CardContent>
          </Card>

          {/* Present Today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                Updated just now
              </div>
            </CardContent>
          </Card>

          {/* Late Today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Today</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                Monitor punctuality
              </div>
            </CardContent>
          </Card>

          {/* Absent Today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                Review leave requests
              </div>
            </CardContent>
          </Card>
        </div>

        {/* UPDATED: Live Activity Feed */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Activity Feed
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
                        {getTimeAgo(item.time)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(item.time), "hh:mm a")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees working now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Break</CardTitle>
            <Coffee className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{employeesOnBreak}</div>
            <p className="text-xs text-muted-foreground">Employees currently on break</p>
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

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>
              {view === 'daily' 
                ? `Attendance for ${format(dateRange.start, "EEEE, MMMM dd, yyyy")}`
                : `Attendance for ${format(dateRange.start, "MMMM yyyy")}`}
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Dept" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
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
                // For daily view find exact match, for monthly just take the latest or aggregate
                const record = view === 'daily' 
                  ? userRecords.find(r => isSameDay(parseISO(r.date), dateRange.start))
                  : userRecords[0]; 
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.department || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(record?.status || 'absent')}
                        <Badge className={getStatusColor(record?.status || 'absent')}>
                          {record?.status ? record.status.replace('-', ' ') : 'Absent'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record?.check_in ? format(new Date(record.check_in), "hh:mm a") : '-'}
                    </TableCell>
                    <TableCell>
                      {record?.check_out ? format(new Date(record.check_out), "hh:mm a") : '-'}
                    </TableCell>
                    <TableCell>
                      {record?.total_hours || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {record?.overtime_hours ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            {record.overtime_hours}
                          </>
                        ) : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record?.location_check_in ? (
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3 text-blue-500" />
                          Office
                        </div>
                      ) : record?.location_check_in === null ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Monitor className="h-3 w-3 text-gray-500" />
                          Remote
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {record?.ip_check_in ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Wifi className="h-3 w-3 text-green-500" />
                          {record.ip_check_in.substring(0, 7) + "..."}
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
