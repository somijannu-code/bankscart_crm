"use client";

import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { 
  Calendar as CalendarIcon, Plus, CheckCircle, Clock, XCircle, 
  Briefcase, Palmtree, Baby, Stethoscope, AlertCircle 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { createLeaveRequest } from "@/app/actions/leave";

// Types
interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
}

export function LeaveManagement() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    type: "casual",
    start: "",
    end: "",
    reason: ""
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
      
    if (data) setLeaves(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.start || !formData.end || !formData.reason) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await createLeaveRequest(user.id, formData);
      
      toast.success("Leave request submitted!");
      setShowApplyDialog(false);
      setFormData({ type: "casual", start: "", end: "", reason: "" });
      loadData(); // Refresh list
    } catch (error) {
      toast.error("Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats for the employee
  const stats = {
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  };

  const getLeaveIcon = (type: string) => {
    switch(type) {
      case 'sick': return <Stethoscope className="h-4 w-4" />;
      case 'casual': return <Palmtree className="h-4 w-4" />;
      case 'maternity': case 'paternity': return <Baby className="h-4 w-4" />;
      default: return <Briefcase className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">Pending Requests</p>
              <h2 className="text-3xl font-bold text-indigo-900 mt-2">{stats.pending}</h2>
            </div>
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">Approved Leaves</p>
              <h2 className="text-3xl font-bold text-emerald-900 mt-2">{stats.approved}</h2>
            </div>
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total History</p>
              <h2 className="text-3xl font-bold text-slate-900 mt-2">{leaves.length}</h2>
            </div>
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Main Action & List */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <CardTitle>My Leave History</CardTitle>
            <CardDescription className="mt-1">View status of your requests</CardDescription>
          </div>
          
          <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request Time Off</DialogTitle>
                <DialogDescription>
                  Fill in the details below. Admin approval is required.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Leave Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(val) => setFormData({...formData, type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">🌴 Casual Leave</SelectItem>
                      <SelectItem value="sick">🤒 Sick Leave</SelectItem>
                      <SelectItem value="paid">💰 Paid Leave</SelectItem>
                      <SelectItem value="emergency">🚨 Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input 
                      type="date" 
                      value={formData.start}
                      onChange={(e) => setFormData({...formData, start: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input 
                      type="date" 
                      value={formData.end}
                      onChange={(e) => setFormData({...formData, end: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Textarea 
                    placeholder="Briefly describe why..." 
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
              <Palmtree className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No leaves yet</h3>
              <p className="text-slate-500">You haven't applied for any leave.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaves.map((leave) => (
                <div 
                  key={leave.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full mt-1 ${
                      leave.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                      leave.status === 'rejected' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {getLeaveIcon(leave.leave_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 capitalize">
                          {leave.leave_type} Leave
                        </span>
                        <Badge variant="outline" className={`capitalize ${
                          leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          leave.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {leave.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {format(new Date(leave.start_date), "MMM d, yyyy")} — {format(new Date(leave.end_date), "MMM d, yyyy")}
                      </p>
                      <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded inline-block">
                        "{leave.reason}"
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right mt-4 sm:mt-0">
                    <p className="text-xs text-slate-400">Applied on {format(new Date(leave.created_at), "MMM d")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
