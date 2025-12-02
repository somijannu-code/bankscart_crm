"use client";

import { useState } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { Button } from "@/components/ui/button"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge"; // Added Badge for Late status
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Clock, 
  Coffee, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  MapPin, // Added MapPin icon
  AlertTriangle, // Added Alert icon for Late status
  Loader2 // Added Loader for location fetching
} from "lucide-react";
import { format, differenceInMinutes, setHours, setMinutes, isAfter } from "date-fns";

export function AttendanceWidget() {
  const {
    todayAttendance,
    loading,
    checkIn,
    checkOut,
    startLunchBreak,
    endLunchBreak,
  } = useAttendance();

  const [notes, setNotes] = useState("");
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  
  // New State for Location handling
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Helper: Get Browser Location
  const getCurrentLocation = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Format: "Lat, Long"
          const coords = `${position.coords.latitude}, ${position.coords.longitude}`;
          resolve(coords);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Unable to retrieve your location");
          resolve(null); // Resolve null so check-in can still proceed if needed
        }
      );
    });
  };

  const handleCheckIn = async () => {
    setIsLocating(true);
    setLocationError(null);
    
    try {
      // 1. Fetch Location first
      const locationString = await getCurrentLocation();
      
      // 2. Pass notes AND location to the checkIn function
      // Note: Ensure your useAttendance hook's checkIn function accepts location as a second argument
      await checkIn(notes, locationString); 
      
      setNotes("");
      setShowCheckInDialog(false);
    } catch (error) {
      console.error("Check-in failed:", error);
    } finally {
      setIsLocating(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut(notes);
      setNotes("");
      setShowCheckOutDialog(false);
    } catch (error) {
      console.error("Check-out failed:", error);
    }
  };

  const handleStartLunchBreak = async () => {
    try {
      await startLunchBreak();
      setShowBreakDialog(false);
    } catch (error) {
      console.error("Lunch break start failed:", error);
    }
  };

  const handleEndLunchBreak = async () => {
    try {
      await endLunchBreak();
      setShowBreakDialog(false);
    } catch (error) {
      console.error("Lunch break end failed:", error);
    }
  };

  const getWorkingHours = () => {
    if (!todayAttendance?.check_in) return null;
    
    const checkInTime = new Date(todayAttendance.check_in);
    const checkOutTime = todayAttendance.check_out ? new Date(todayAttendance.check_out) : new Date();
    
    let totalMinutes = differenceInMinutes(checkOutTime, checkInTime);
    
    // Subtract break time
    if (todayAttendance.lunch_start) {
      const breakStart = new Date(todayAttendance.lunch_start);
      const breakEnd = todayAttendance.lunch_end ? new Date(todayAttendance.lunch_end) : new Date();
      totalMinutes -= differenceInMinutes(breakEnd, breakStart);
    }
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  // Helper: Check if it is currently "Late" (After 09:30 AM)
  const isLateNow = () => {
    const now = new Date();
    const lateThreshold = setMinutes(setHours(now, 9), 30); // 09:30 AM Today
    return isAfter(now, lateThreshold);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attendance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </div>
            {/* Show Date */}
            <span className="text-sm font-normal text-muted-foreground">
              {format(new Date(), "EEEE, MMM dd")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Check-in Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Check-in:</span>
              {todayAttendance?.check_in ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{format(new Date(todayAttendance.check_in), "hh:mm a")}</span>
                  {/* Show Visual Late Badge if they were late */}
                  {isAfter(new Date(todayAttendance.check_in), setMinutes(setHours(new Date(todayAttendance.check_in), 9), 30)) && (
                     <Badge variant="secondary" className="text-yellow-700 bg-yellow-100 text-[10px] h-5 px-1 ml-1">
                        Late
                     </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <XCircle className="h-4 w-4" />
                  <span>Not checked in</span>
                </div>
              )}
            </div>

            {/* Lunch Break Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lunch Break:</span>
              {todayAttendance?.lunch_start ? (
                <div className="flex items-center gap-2">
                  {todayAttendance.lunch_end ? (
                    <div className="text-green-600">
                      <span>
                        {format(new Date(todayAttendance.lunch_start), "hh:mm a")} -{" "}
                        {format(new Date(todayAttendance.lunch_end), "hh:mm a")}
                      </span>
                    </div>
                  ) : (
                    <div className="text-orange-600 animate-pulse">
                      <span>On Break ({format(new Date(todayAttendance.lunch_start), "hh:mm a")})</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">Not taken</span>
              )}
            </div>

            {/* Check-out Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Check-out:</span>
              {todayAttendance?.check_out ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{format(new Date(todayAttendance.check_out), "hh:mm a")}</span>
                </div>
              ) : (
                <span className="text-gray-500">Not checked out</span>
              )}
            </div>

            {/* Working Hours */}
            {todayAttendance?.check_in && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Total Working Hours:</span>
                <span className="text-sm font-bold text-primary">
                  {getWorkingHours()?.hours}h {getWorkingHours()?.minutes}m
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 flex-wrap">
            {!todayAttendance?.check_in ? (
              <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
                <DialogTrigger asChild>
                  <Button className="flex-1" size="lg">
                    <LogIn className="h-4 w-4 mr-2" />
                    Check In
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Check In</DialogTitle>
                    <DialogDescription>
                      Start your work day. Location will be captured automatically.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {/* Late Warning */}
                  {isLateNow() && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-sm text-yellow-700 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div>
                            <p className="font-semibold">You are checking in late.</p>
                            <p className="text-xs opacity-90">Standard check-in time is before 09:30 AM.</p>
                        </div>
                    </div>
                  )}

                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="checkin-notes">Notes (Optional)</Label>
                      <Textarea
                        id="checkin-notes"
                        placeholder="Any plans for today?..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    
                    {/* Location Status Indicator */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                        <MapPin className="h-3 w-3" />
                        {isLocating ? "Acquiring accurate location..." : "Location permission required"}
                    </div>
                    {locationError && (
                        <p className="text-xs text-red-500">{locationError}</p>
                    )}

                    <Button onClick={handleCheckIn} className="w-full" disabled={isLocating}>
                      {isLocating ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Getting Location...
                        </>
                      ) : (
                        "Confirm Check In"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : !todayAttendance.check_out && (
              <>
                <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <Coffee className="h-4 w-4 mr-2" />
                      {todayAttendance.lunch_start && !todayAttendance.lunch_end ? "End Break" : "Start Break"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {todayAttendance.lunch_start && !todayAttendance.lunch_end ? "End Lunch Break" : "Start Lunch Break"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>
                        {todayAttendance.lunch_start && !todayAttendance.lunch_end
                          ? "Are you sure you want to end your lunch break?"
                          : "Are you sure you want to start your lunch break?"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowBreakDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={todayAttendance.lunch_start && !todayAttendance.lunch_end ? handleEndLunchBreak : handleStartLunchBreak}
                          className="flex-1"
                        >
                          Confirm
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1" variant="destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Check Out
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Check Out</DialogTitle>
                      <DialogDescription>
                        End your work day.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="checkout-notes">End of Day Report (Optional)</Label>
                        <Textarea
                          id="checkout-notes"
                          placeholder="What did you accomplish today?..."
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
