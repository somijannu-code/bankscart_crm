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
import { AttendanceRecord, BreakRecord } from "@/lib/database-schema";
import { enhancedAttendanceService } from "@/lib/attendance-service-enhanced";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function EnhancedTelecallerAttendancePage() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [allBreakRecords, setAllBreakRecords] = useState<BreakRecord[]>([]); 
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [breakType, setBreakType] = useState("lunch");
  const [idleTime, setIdleTime] = useState(0);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  
  // FIX: Use useRef for lastActivity to prevent re-render loops
  const lastActivityRef = useRef<Date>(new Date());
  
  const supabase = createClient();

  // FIX: completely rewritten idle timer logic
  useEffect(() => {
    // Function to handle user activity
    const handleUserActivity = () => {
      lastActivityRef.current = new Date();
      // Only reset state if it was previously > 0 to avoid unnecessary renders
      setIdleTime((prev) => (prev > 0 ? 0 : prev));
    };

    // Events to track
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, true);
    });
    
    // Check for idle status every minute
    const intervalId = setInterval(() => {
      const now = new Date();
      // Calculate difference in minutes
      const diff = differenceInMinutes(now, lastActivityRef.current);
      
      // If idle for more than 5 minutes, update the state
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
  }, []); // Empty dependency array ensures this only runs once on mount

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

      const today = new Date();
      if (isAfter(today, dateRange.start) || isSameDay(today, dateRange.start)) {
          const todayRecord = await enhancedAttendanceService.getTodayAttendance(user.id);
          setTodayAttendance(todayRecord);
      } else {
          setTodayAttendance(null);
      }

      const history = await enhancedAttendanceService.getAttendanceHistory(
        user.id,
        startDateStr,
        endDateStr
      );
      setAttendanceHistory(history);

      const breaks = await enhancedAttendanceService.getBreakRecords(
         user.id,
         startDateStr, 
         endDateStr 
      );
      setAllBreakRecords(breaks);

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

      const attendance = await enhancedAttendanceService.checkIn(
        user.id,
        undefined, 
        undefined, 
        undefined, 
        notes
      );
      
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

      const attendance = await enhancedAttendanceService.checkOut(
        user.id,
        undefined, 
        undefined, 
        undefined, 
        notes
      );
      
      setTodayAttendance(attendance);
      setNotes("");
      setShowCheckOutDialog(false);
      loadAttendanceData(); 
    } catch (error) {
      console.error("Check-out failed:", error);
    }
  };

  const handleStartBreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !todayAttendance) return;

      await enhancedAttendanceService.startBreak(
        user.id,
        breakType,
        notes
      );
      
      const todayBreaks = await enhancedAttendanceService.getBreakRecords(
        user.id,
        todayAttendance.date,
        todayAttendance.date 
      );
      setAllBreakRecords(prev => prev.filter(b => b.date !== todayAttendance.date).concat(todayBreaks));
      
      const updatedAttendance = await enhancedAttendanceService.getTodayAttendance(user.id);
      setTodayAttendance(updatedAttendance);
      
      setNotes("");
      setShowBreakDialog(false);
    } catch (error) {
      console.error("Start break failed:", error);
    }
  };

  const handleEndBreak = async (breakId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !todayAttendance) return;

      await enhancedAttendanceService.endBreak(breakId, notes);
      
      const todayBreaks = await enhancedAttendanceService.getBreakRecords(
        user.id,
        todayAttendance.date,
        todayAttendance.date 
      );
      setAllBreakRecords(prev => prev.filter(b => b.date !== todayAttendance.date).concat(todayBreaks));
      
      const updatedAttendance = await enhancedAttendanceService.getTodayAttendance(user.id);
      setTodayAttendance(updatedAttendance);
      
      setNotes("");
    } catch (error) {
      console.error("End break failed:", error);
    }
  };

  const getWorkingHours = (record: AttendanceRecord) => {
    if (!record.check_in) return null;
    
    const checkInTime = new Date(record.check_in);
    const checkOutTime = record.check_out ? new Date(record.check_out) : new Date();
    
    let totalMinutes = differenceInMinutes(checkOutTime, checkInTime);
    
    const recordBreaks = allBreakRecords.filter(b => b.date === record.date);
    
    recordBreaks.forEach(breakRecord => {
      if (breakRecord.end_time) {
        totalMinutes -= differenceInMinutes(
          new Date(breakRecord.end_time),
          new Date(breakRecord.start_time)
        );
      } else if (isSameDay(parseISO(record.date), new Date())) {
        totalMinutes -= differenceInMinutes(
          new Date(), 
          new Date(breakRecord.start_time)
        );
      }
    });

    if (totalMinutes < 0) totalMinutes = 0;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  const todayBreakRecords = todayAttendance ? allBreakRecords.filter(b => b.date === todayAttendance.date) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-100 text-green-800";
      case "late": return "bg-yellow-100 text-yellow-800";
      case "absent": return "bg-red-100 text-red-800";
      case "half-day": return "bg-orange-100 text-orange-800";
      case "leave": return "bg-blue-100 text-blue-800";
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
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const calculateStats = () => {
    const presentDays = attendanceHistory.filter(a => a.status === 'present' || a.status === 'late').length;
    const absentDays = attendanceHistory.filter(a => a.status === 'absent').length;
    const lateDays = attendanceHistory.filter(a => a.status === 'late').length;
    const halfDays = attendanceHistory.filter(a => a.status === 'half-day').length;
    
    let totalOvertime = 0;
    attendanceHistory.forEach(record => {
      if (record.overtime_hours) {
        const parts = record.overtime_hours.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        totalOvertime += hours + (minutes / 60);
      }
    });
    
    return { presentDays, absentDays, lateDays, halfDays, totalOvertime };
  };

  const stats = calculateStats();

  const getTotalBreakTime = () => {
    let totalMinutes = 0;
    todayBreakRecords.forEach(breakRecord => {
      if (breakRecord.end_time) {
        totalMinutes += differenceInMinutes(
          new Date(breakRecord.end_time),
          new Date(breakRecord.start_time)
        );
      } else {
        totalMinutes += differenceInMinutes(
          new Date(),
          new Date(breakRecord.start_time)
        );
      }
    });
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  const breakTime = getTotalBreakTime();

  const quickDateRanges = [
    { label: "This Month", value: "current-month" },
    { label: "Last Month", value: "last-month" },
    { label: "Last 30 Days", value: "last-30-days" },
    { label: "Last 3 Months", value: "last-3-months" },
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
      case "last-3-months":
        start = new Date(today);
        start.setMonth(today.getMonth() - 3);
        end = today;
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }

    setDateRange({ start, end });
    setDateRangeOpen(false);
  };

  if (loading) {
    return <div className="p-6">Loading attendance data...</div>;
  }

  const isCheckedIn = !!todayAttendance?.check_in;
  const isCheckedOut = !!todayAttendance?.check_out;
  const isOnBreak = todayBreakRecords.some(b => !b.end_time);

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
                <span className="text-sm font-medium">Late:</span>
                <span className="text-yellow-600 font-semibold">{stats.lateDays} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Absent:</span>
                <span className="text-red-600 font-semibold">{stats.absentDays} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Half Days:</span>
                <span className="text-orange-600 font-semibold">{stats.halfDays} days</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Overtime:</span>
                <span className="font-semibold">{stats.totalOvertime.toFixed(1)} hours</span>
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
                      {todayAttendance!.location_check_in && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="text-xs">Office</span> 
                        </div>
                      )}
                      {todayAttendance!.ip_check_in && (
                        <div className="flex items-center gap-1">
                          <Wifi className="h-4 w-4 text-green-500" />
                          <span className="text-xs">
                            {todayAttendance!.ip_check_in.substring(0, 7) + "..."}
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

                {isCheckedIn && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Breaks:</span>
                      <span className="text-sm text-gray-500">
                        {todayBreakRecords.filter(b => b.end_time).length} taken
                      </span>
                    </div>
                    
                    {todayBreakRecords.map(breakRecord => (
                      <div key={breakRecord.id} className="flex items-center justify-between text-sm pl-4">
                        <div>
                          <span className="capitalize">{breakRecord.break_type}</span>
                          <span className="text-gray-500 ml-2">
                            {format(new Date(breakRecord.start_time), "hh:mm a")}
                            {breakRecord.end_time && ` - ${format(new Date(breakRecord.end_time), "hh:mm a")}`}
                          </span>
                        </div>
                        {!breakRecord.end_time && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEndBreak(breakRecord.id)}
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            End Break
                          </Button>
                        )}
                      </div>
                    ))}
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
                      {getWorkingHours(todayAttendance!)?.hours}h {getWorkingHours(todayAttendance!)?.minutes}m
                    </span>
                  </div>
                )}

                {todayBreakRecords.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Break Time:</span>
                    <span className="text-sm font-semibold">
                      {breakTime.hours}h {breakTime.minutes}m
                    </span>
                  </div>
                )}

                {todayAttendance?.overtime_hours && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overtime:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-green-600">{todayAttendance.overtime_hours}</span>
                    </div>
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
                ) : !isCheckedOut && !isOnBreak ? (
                  <>
                    <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <Coffee className="h-4 w-4 mr-2" />
                          Start Break
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Start Break</DialogTitle>
                          <DialogDescription>
                            Take a break from work.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Break Type</Label>
                            <Select value={breakType} onValueChange={setBreakType}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lunch">Lunch Break</SelectItem>
                                <SelectItem value="tea">Tea Break</SelectItem>
                                <SelectItem value="personal">Personal Break</SelectItem>
                                <SelectItem value="meeting">Meeting</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="break-notes">Notes (Optional)</Label>
                            <Textarea
                              id="break-notes"
                              placeholder="Any notes..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleStartBreak} className="w-full">
                            Start Break
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

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
                ) : isCheckedIn && isOnBreak && (
                    <Button disabled className="flex-1 bg-orange-500 hover:bg-orange-600">
                        <Pause className="h-4 w-4 mr-2" />
                        On Break
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
                <TableHead>Hours</TableHead>
                <TableHead>Breaks</TableHead>
                <TableHead>Overtime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceHistory.map(record => {
                const dateBreaks = allBreakRecords.filter(b => b.date === record.date);
                const totalBreakMinutes = dateBreaks.reduce((total, breakRecord) => {
                  if (breakRecord.end_time) {
                    return total + differenceInMinutes(
                      new Date(breakRecord.end_time),
                      new Date(breakRecord.start_time)
                    );
                  }
                  return total;
                }, 0);
                
                const breakHours = Math.floor(totalBreakMinutes / 60);
                const breakMinutes = totalBreakMinutes % 60;

                const displayHours = record.check_out 
                  ? record.total_hours
                  : (isSameDay(parseISO(record.date), new Date()) && record.check_in 
                      ? `${getWorkingHours(record)?.hours}h ${getWorkingHours(record)?.minutes}m` 
                      : record.total_hours || '-');
                
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
                          {record.status.replace('-', ' ')}
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
                      {displayHours}
                    </TableCell>
                    <TableCell>
                      {totalBreakMinutes > 0 ? `${breakHours}h ${breakMinutes}m` : '-'}
                    </TableCell>
                    <TableCell>
                      {record.overtime_hours ? (
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">{record.overtime_hours}</span>
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
