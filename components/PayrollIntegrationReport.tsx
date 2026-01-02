"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface PayrollIntegrationReportProps {
  month: number;
  year: number;
}

interface PayrollRow {
  id: string;
  name: string;
  department: string;
  present: number;
  absent: number;
  holidays: number; // Added to track holidays separately
  workingHours: number;
  overtimeHours: number;
  baseSalary: number;
  overtimeRate: number;
  totalPay: number;
}

export function PayrollIntegrationReport({ month, year }: PayrollIntegrationReportProps) {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSalary, setNewSalary] = useState<number>(0);
  const supabase = createClient();

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    
    // Calculate Date Range
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Fetch Users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name, department, base_salary")
      .eq("is_active", true);

    if (userError) {
      console.error("User fetch error:", userError);
      setLoading(false);
      return;
    }

    // Fetch Attendance
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("user_id, check_in, check_out, status, date")
      .gte("date", startDate)
      .lte("date", endDate);

    if (attError) {
      console.error("Attendance fetch error:", attError);
      setLoading(false);
      return;
    }

    const workingDays = 26; // Standard working days for calculation
    const overtimeRate = 200; 

    const map: { [id: string]: PayrollRow } = {};

    // Initialize Map
    users?.forEach((u) => {
      map[u.id] = {
        id: u.id,
        name: u.full_name || "Unknown",
        department: u.department || "N/A",
        present: 0,
        absent: 0,
        holidays: 0,
        workingHours: 0,
        overtimeHours: 0,
        baseSalary: u.base_salary || 15000, 
        overtimeRate,
        totalPay: 0,
      };
    });

    // Process Attendance
    attendance?.forEach((r) => {
      const emp = map[r.user_id];
      if (!emp) return;

      const status = (r.status || "").toLowerCase();

      // --- FIX: STRICT STATUS CHECKING ---
      if (['present', 'late', 'work_from_home', 'checked_in'].includes(status)) {
        emp.present += 1;
      } 
      else if (status === 'half_day') {
        emp.present += 0.5;
      } 
      else if (status === 'absent') {
        emp.absent += 1;
      } 
      else if (['holiday', 'week_off', 'festival'].includes(status)) {
        emp.holidays += 1; // Track but don't count as "Present"
      }
      
      // Calculate Hours (Only if both check-in and check-out exist)
      if (r.check_in && r.check_out) {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        const diffMs = checkOut.getTime() - checkIn.getTime();
        
        if (diffMs > 0) {
            const hrs = diffMs / 3600000;
            emp.workingHours += hrs;
            
            if (hrs > 9) {
                emp.overtimeHours += (hrs - 9);
            }
        }
      }
    });

    // Final Pay Calculation
    Object.values(map).forEach((emp) => {
      const perDay = emp.baseSalary / workingDays;
      
      // NOTE: This calculates pay based ONLY on days marked Present.
      // If you want to pay for holidays too, change this to: (emp.present + emp.holidays)
      const basePayEarned = perDay * emp.present; 
      
      const overtimePay = emp.overtimeHours * emp.overtimeRate;
      emp.totalPay = basePayEarned + overtimePay;
    });

    setRows(Object.values(map));
    setLoading(false);
  }, [month, year, supabase]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const handleEdit = (row: PayrollRow) => {
    setEditingId(row.id);
    setNewSalary(row.baseSalary);
  };

  const handleSave = async (id: string) => {
    await supabase.from("users").update({ base_salary: newSalary }).eq("id", id);
    setEditingId(null);
    loadPayroll();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            Payroll Integration Report
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-gray-500">Employee</th>
                <th className="text-left p-3 font-medium text-gray-500">Dept</th>
                <th className="text-left p-3 font-medium text-gray-900">Present</th>
                <th className="text-left p-3 font-medium text-gray-500">Holiday</th>
                <th className="text-left p-3 font-medium text-gray-500">Hours</th>
                <th className="text-left p-3 font-medium text-gray-500">Base Salary</th>
                <th className="text-left p-3 font-medium text-gray-500">Overtime</th>
                <th className="text-left p-3 font-medium text-gray-900">Total Pay</th>
                <th className="text-left p-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                  <tr><td colSpan={9} className="p-4 text-center text-gray-500">No data found.</td></tr>
              ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50/50">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-gray-500">{row.department}</td>
                      
                      {/* Fixed Present Count */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-bold">
                            {row.present}
                        </span>
                      </td>
                      
                      {/* New Holiday Column */}
                      <td className="p-3 text-gray-500">{row.holidays}</td>
                      
                      <td className="p-3">{row.workingHours.toFixed(1)}</td>
                      <td className="p-3">
                        {editingId === row.id ? (
                          <Input
                            type="number"
                            value={newSalary}
                            onChange={(e) => setNewSalary(Number(e.target.value))}
                            className="w-24 h-8"
                          />
                        ) : (
                          `₹${row.baseSalary.toLocaleString()}`
                        )}
                      </td>
                      <td className="p-3 text-gray-600">
                        {row.overtimeHours > 0 ? `+₹${(row.overtimeHours * row.overtimeRate).toFixed(0)}` : '-'}
                      </td>
                      <td className="p-3 font-bold text-green-700">
                        ₹{row.totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3">
                        {editingId === row.id ? (
                          <Button size="sm" onClick={() => handleSave(row.id)} className="h-8">Save</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(row)} className="h-8 text-blue-600">Edit</Button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
