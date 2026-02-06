"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { 
  CheckCircle, XCircle, Clock, Search, Filter, 
  Calendar, User, MoreHorizontal, FileText, Check, X 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { approveLeave, rejectLeave } from "@/app/actions/leave";

// --- Types ---
// (Reusing the types from your original code for consistency)
interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface LeaveRecord {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  rejection_reason?: string;
  user?: User;
}

interface AdminLeaveDashboardProps {
  leaves: LeaveRecord[];
  currentUserId: string;
}

export function AdminLeaveDashboard({ leaves, currentUserId }: AdminLeaveDashboardProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; leaveId: string | null }>({
    isOpen: false,
    leaveId: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Filtering Logic ---
  const filteredLeaves = leaves.filter((leave) => {
    const matchesTab = activeTab === "all" ? true : leave.status === activeTab;
    const matchesSearch = 
      leave.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.leave_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // --- Stats Calculation ---
  const stats = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    todayOnLeave: leaves.filter((l) => {
      const today = new Date().toISOString().split("T")[0];
      return l.status === "approved" && l.start_date <= today && l.end_date >= today;
    }).length,
  };

  // --- Handlers ---
  const handleApprove = async (id: string) => {
    try {
      setIsProcessing(true);
      await approveLeave(id, currentUserId);
      toast.success("Leave approved successfully");
    } catch (error) {
      toast.error("Failed to approve leave");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.leaveId || !rejectionReason.trim()) return;
    try {
      setIsProcessing(true);
      await rejectLeave(rejectDialog.leaveId, currentUserId, rejectionReason);
      toast.success("Leave rejected");
      setRejectDialog({ isOpen: false, leaveId: null });
      setRejectionReason("");
    } catch (error) {
      toast.error("Failed to reject leave");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
    };
    const icons: Record<string, any> = {
      approved: CheckCircle,
      pending: Clock,
      rejected: XCircle,
    };
    const Icon = icons[status] || Clock;
    
    return (
      <Badge variant="outline" className={`flex w-fit items-center gap-1.5 px-2.5 py-0.5 capitalize ${styles[status]}`}>
        <Icon className="h-3.5 w-3.5" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- Stats Cards --- */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
            <CardTitle className="text-3xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Approved (Total)</CardDescription>
            <CardTitle className="text-3xl">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>On Leave Today</CardDescription>
            <CardTitle className="text-3xl">{stats.todayOnLeave}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* --- Main Content --- */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>Manage and track employee leave applications</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  className="pl-9 w-[200px] lg:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending">Pending Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All History</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                  <FileText className="h-12 w-12 mb-3 opacity-20" />
                  <p>No leave records found for this category.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="grid grid-cols-1 divide-y">
                    {filteredLeaves.map((leave) => {
                      const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
                      return (
                        <div key={leave.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          {/* User Info */}
                          <div className="flex items-center gap-4 min-w-[200px]">
                            <Avatar>
                              <AvatarFallback className="bg-indigo-100 text-indigo-700 font-medium">
                                {leave.user?.full_name?.substring(0, 2).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{leave.user?.full_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{leave.leave_type} Leave</p>
                            </div>
                          </div>

                          {/* Date & Reason */}
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col justify-center">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>
                                  {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d, yyyy")}
                                </span>
                                <Badge variant="secondary" className="text-[10px] ml-1">{days} Day{days > 1 ? 's' : ''}</Badge>
                              </div>
                            </div>
                            <div className="text-sm text-slate-600 flex items-center">
                              <p className="truncate max-w-[250px]" title={leave.reason}>
                                "{leave.reason}"
                              </p>
                            </div>
                          </div>

                          {/* Actions / Status */}
                          <div className="flex items-center gap-3 justify-end min-w-[140px]">
                            {leave.status === "pending" ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                  onClick={() => handleApprove(leave.id)}
                                  disabled={isProcessing}
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  onClick={() => setRejectDialog({ isOpen: true, leaveId: leave.id })}
                                  disabled={isProcessing}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              getStatusBadge(leave.status)
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  // Could open a details modal here
                                  toast.info(`Details: ${leave.reason}`);
                                }}>
                                  View Details
                                </DropdownMenuItem>
                                {leave.rejection_reason && (
                                  <DropdownMenuItem className="text-red-600">
                                    Reason: {leave.rejection_reason}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.isOpen} onOpenChange={(open) => !open && setRejectDialog({ isOpen: false, leaveId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ isOpen: false, leaveId: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim() || isProcessing}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
