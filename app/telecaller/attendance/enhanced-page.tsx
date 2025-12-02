"use client";

import { useState, useEffect, useRef } from "react";
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes, subMonths, isAfter, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  BarChart3, 
  MapPin, 
  Wifi, 
  Coffee, 
  LogIn, 
  LogOut,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Monitor,
  ChevronDown
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Import your specific service and types
import { attendanceService, AttendanceRecord } from "@/lib/attendance-service";

export default function EnhancedTelecallerAttendancePage() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [idleTime, setIdleTime] = useState(0);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  
  // FIX: Stable ref for activity tracking to prevent re-render loops
  const lastActivityRef = useRef<Date>(new Date());
  
  const supabase = createClient();

  // FIX: Simplified Idle Timer Logic
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = new Date();
      // Only reset if currently showing idle time to prevent constant re-renders
      setIdleTime((prev) => (prev > 0 ? 0 : prev));
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, true);
    });
    
    const intervalId = setInterval(() => {
      const now = new Date();
      const diff = differenceInMinutes(now, lastActivityRef.current);
      if (diff >= 5) {
        setIdleTime(diff - 5);
      }
    }, 60000); // Check every 1 minute
    
    return () => {
      clearInterval(intervalId);
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [dateRange]);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDateStr = format(dateRange.start, "yyyy-MM-dd");
      const endDateStr = format(dateRange.end, "yyyy-MM-dd");

      // Load Today's Record
      const today = new Date();
      if (isAfter(today, dateRange.start) || isSameDay(today, dateRange.start)) {
          const todayRecord = await attendanceService.getTodayAttendance(user.id);
          setTodayAttendance(todayRecord);
      } else {
          setTodayAttendance(null);
      }

      // Load History
      const history = await attendanceService.getAttendanceHistory(
        user.id,
        startDateStr,
        endDateStr
      );
      setAttendanceHistory(history);

    } catch (error) {
      console.error("Error loading attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // NOTE: We pass 'Office' as hardcoded location since browser geo-location 
      // requires extra permission handling logic not present in your snippet.
      const attendance = await attendanceService.checkIn(user.id, notes, "Office");
      
      setTodayAttendance(attendance);
      setNotes("");
      setShowCheckInDialog(false);
      loadAttendanceData(); 
    } catch (error) {
      console.error("Check-in failed:", error);
    }
  };

  const handleCheckOut = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const attendance = await attendanceService.checkOut(user.id, notes);
      
      setTodayAttendance(attendance);
      setNotes("");
      setShowCheckOutDialog(false);
      loadAttendanceData(); 
    } catch (error) {
      console.error("Check-out failed:", error);
    }
  };

  const handleStartLunch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const attendance = await attendanceService.startLunchBreak(user.id);
      
      setTodayAttendance(attendance);
      setShowBreakDialog(false);
    } catch (error) {
      console.error("Start break failed:", error);
    }
  };

  const handleEndLunch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const attendance = await attendanceService.endLunchBreak(user.id);
      
      setTodayAttendance(attendance);
    } catch (error) {
      console.error("End break failed:", error);
    }
  };

  // Helper to calculate hours live on the client side
  const getLiveWorkingHours = (record: AttendanceRecord) => {
    if (!record.check_in) return { hours: 0, minutes: 0 };
    
    const checkInTime = new Date(record.check_in);
    const checkOutTime = record.check_out ? new Date(record.check_out) : new Date();
    
    let totalMinutes = differenceInMinutes(checkOutTime, checkInTime);
    
    // Calculate break deductions
    if (record.lunch_start) {
        if (record.lunch_end) {
            // Completed break
            const breakDuration = differenceInMinutes(new Date(record.lunch_end), new Date(record.lunch_start));
            totalMinutes -= breakDuration;
        } else {
            // Ongoing break - subtract time from start of break to NOW
            // Because 'checkOutTime' (now) keeps advancing, we must remove the break portion
            const breakDuration = differenceInMinutes(new Date(), new Date(record.lunch_start));
            totalMinutes -= breakDuration;
        }
    }

    if (totalMinutes < 0) totalMinutes = 0;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
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
      case "late": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "absent": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const calculateStats = () => {
    const presentDays = attendanceHistory.filter(a => a.status === 'present').length;
    // Assuming absent/late logic is handled by your backend or simplified here
    const totalDays = attendanceHistory.length;
    
    return { presentDays, totalDays };
  };

  const stats = calculateStats();

  const quickDateRanges = [
    { label: "This Month", value: "current-month" },
    { label: "Last Month", value: "last-month" },
    { label: "Last 30 Days", value: "last-30-days" },
  ];

  const handleQuickDateRange = (range: string) => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case "current-month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "last-month":
        const lastMonth = subMonths(today, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "last-30-days":
        start = new Date(today);
        start.setDate(today.getDate() - 30);
        end = today;
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }

    setDateRange({ start, end });
    setDateRangeOpen(false);
  };

  if (loading && !todayAttendance && attendanceHistory.length === 0) {
    return <div className="p-6">Loading attendance data...</div>;
  }

  const isCheckedIn = !!todayAttendance?.check_in;
  const isCheckedOut = !!todayAttendance?.check_out;
  const isOnLunch = !!todayAttendance?.lunch_start && !todayAttendance?.lunch_end;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-1">Track your daily attendance and working hours</p>
        </div>
        
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(dateRange.start, "MMM dd")} - {format(dateRange.end, "MMM dd, yyyy")}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-4 border-b">
              <h4 className="font-medium mb-2">Quick Select</h4>
              <div className="space-y-1">
                {quickDateRanges.map((range) => (
                  <Button
                    key={range.value}
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => handleQuickDateRange(range.value)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <h4 className="font-medium mb-2">Custom Range</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">From Date</Label>
                  <input
                    id="start-date"
                    type="date"
                    className="w-full p-2 border rounded-md"
                    value={format(dateRange.start, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const newStart = e.target.value ? new Date(e.target.value) : dateRange.start;
                      setDateRange(prev => ({ ...prev, start: newStart }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">To Date</Label>
                  <input
                    id="end-date"
                    type="date"
                    className="w-full p-2 border rounded-md"
                    value={format(dateRange.end, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const newEnd = e.target.value ? new Date(e.target.value) : dateRange.end;
                      setDateRange(prev => ({ ...prev, end: newEnd }));
                    }}
                  />
                </div>
                <Button 
                  onClick={() => setDateRangeOpen(false)}
                  className="w-full"
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Stats for Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Present:</span>
                <span className="text-green-600 font-semibold">{stats.presentDays} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Working Days:</span>
                <span className="text-gray-600 font-semibold">{stats.totalDays} days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Status - {format(new Date(), "EEEE, MMM dd")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Check-in:</span>
                  {isCheckedIn ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{format(new Date(todayAttendance!.check_in!), "hh:mm a")}</span>
                      {todayAttendance!.ip_check_in && (
                        <div className="flex items-center gap-1">
                          <Wifi className="h-4 w-4 text-green-500" />
                          <span className="text-xs">
                            {todayAttendance!.ip_check_in}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <XCircle className="h-4 w-4" />
                      <span>Not checked in</span>
                    </div>
                  )}
                </div>

                {/* Lunch Break Section based on simple schema */}
                {isCheckedIn && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Lunch Break:</span>
                      <span className="text-sm text-gray-500">
                         {todayAttendance?.lunch_start ? (
                            todayAttendance.lunch_end ? "Completed" : "In Progress"
                         ) : "Not taken"}
                      </span>
                    </div>
                    
                    {todayAttendance?.lunch_start && (
                      <div className="flex items-center justify-between text-sm pl-4">
                        <div>
                          <span className="capitalize">Lunch</span>
                          <span className="text-gray-500 ml-2">
                            {format(new Date(todayAttendance.lunch_start), "hh:mm a")}
                            {todayAttendance.lunch_end && ` - ${format(new Date(todayAttendance.lunch_end), "hh:mm a")}`}
                          </span>
                        </div>
                        {!todayAttendance.lunch_end && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleEndLunch}
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            End Lunch
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                 {isCheckedIn && !isCheckedOut && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Idle Time:</span>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {idleTime > 0 ? `${idleTime} min` : "Active"}
                      </span>
                      {idleTime > 0 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Pause className="h-3 w-3" />
                          <span className="text-xs">Idle</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Check-out:</span>
                  {isCheckedOut ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{format(new Date(todayAttendance!.check_out!), "hh:mm a")}</span>
                    </div>
                  ) : isCheckedIn ? (
                    <span className="text-sm font-medium text-blue-500">Currently Clocked In</span>
                  ) : (
                    <span className="text-gray-500">Not checked out</span>
                  )}
                </div>

                {isCheckedIn && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Working Hours:</span>
                    <span className="text-sm font-semibold">
                      {getLiveWorkingHours(todayAttendance!).hours}h {getLiveWorkingHours(todayAttendance!).minutes}m
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6 flex-wrap">
                {!isCheckedIn ? (
                  <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex-1">
                        <LogIn className="h-4 w-4 mr-2" />
                        Check In
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Check In</DialogTitle>
                        <DialogDescription>
                          Start your work day. You can add optional notes.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="checkin-notes">Notes (Optional)</Label>
                          <Textarea
                            id="checkin-notes"
                            placeholder="Any notes for today..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleCheckIn} className="w-full">
                          Confirm Check In
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : !isCheckedOut && !isOnLunch ? (
                  <>
                    {!todayAttendance?.lunch_start && (
                        <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1">
                            <Coffee className="h-4 w-4 mr-2" />
                            Start Lunch
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                            <DialogTitle>Start Lunch Break</DialogTitle>
                            <DialogDescription>
                                Take a lunch break.
                            </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                            <Button onClick={handleStartLunch} className="w-full">
                                Confirm Start Lunch
                            </Button>
                            </div>
                        </DialogContent>
                        </Dialog>
                    )}

                    <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
                      <DialogTrigger asChild>
                        <Button className="flex-1">
                          <LogOut className="h-4 w-4 mr-2" />
                          Check Out
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Check Out</DialogTitle>
                          <DialogDescription>
                            End your work day. You can add notes about your day.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="checkout-notes">Notes (Optional)</Label>
                            <Textarea
                              id="checkout-notes"
                              placeholder="How was your day?..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleCheckOut} className="w-full">
                            Confirm Check Out
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : isCheckedIn && isOnLunch && (
                    <Button disabled className="flex-1 bg-orange-500 hover:bg-orange-600">
                        <Pause className="h-4 w-4 mr-2" />
                        On Lunch Break
                    </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Attendance History - {format(dateRange.start, "MMM dd")} to {format(dateRange.end, "MMM dd, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Break</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceHistory.map(record => {
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(record.date), "EEE, MMM dd")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(record.status)}
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.check_in ? format(new Date(record.check_in), "hh:mm a") : '-'}
                    </TableCell>
                    <TableCell>
                      {record.check_out ? format(new Date(record.check_out), "hh:mm a") : '-'}
                    </TableCell>
                    <TableCell>
                      {record.total_hours || '-'}
                    </TableCell>
                    <TableCell>
                      {record.break_hours || '-'}
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
