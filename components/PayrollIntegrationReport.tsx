"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// 1. Define Props to accept the filter values
interface PayrollIntegrationReportProps {
  month: number; // 0 = Jan, 11 = Dec
  year: number;
}

interface PayrollRow {
  id: string;
  name: string;
  department: string;
  present: number;
  absent: number;
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

  // 2. Wrap loadPayroll in useCallback so it updates when month/year changes
  const loadPayroll = useCallback(async () => {
    setLoading(true);
    
    // Calculate Date Range for Filter
    // Start Date: e.g., "2025-02-01"
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    
    // End Date: Last day of the month
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    console.log(`Fetching Payroll for: ${startDate} to ${endDate}`);

    // Fetch Users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name, department, base_salary")
      .eq("is_active", true); // Optional: Only show active employees

    if (userError) {
      console.error("User fetch error:", userError);
      setLoading(false);
      return;
    }

    // 3. Fetch Attendance with DATE FILTERS
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("user_id, check_in, check_out, status, date")
      .gte("date", startDate) // Filter Start
      .lte("date", endDate);  // Filter End

    if (attError) {
      console.error("Attendance fetch error:", attError);
      setLoading(false);
      return;
    }

    const workingDays = 26;
    const overtimeRate = 200; // ₹200 per hour

    const map: { [id: string]: PayrollRow } = {};

    // Initialize Map with Users
    users?.forEach((u) => {
      map[u.id] = {
        id: u.id,
        name: u.full_name || "Unknown",
        department: u.department || "N/A",
        present: 0,
        absent: 0,
        workingHours: 0,
        overtimeHours: 0,
        baseSalary: u.base_salary || 25000, // Default salary if null
        overtimeRate,
        totalPay: 0,
      };
    });

    // Process Attendance Data
    attendance?.forEach((r) => {
      const emp = map[r.user_id];
      if (!emp) return;

      if (r.status === "absent") {
        emp.absent += 1;
      } else {
        // Assume anything else (present, late) counts as present for base pay
        emp.present += 1;
      }

      // Calculate Hours
      if (r.check_in && r.check_out) {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        const diffMs = checkOut.getTime() - checkIn.getTime();
        
        // Only count valid positive duration
        if (diffMs > 0) {
            const hrs = diffMs / 3600000;
            emp.workingHours += hrs;
            
            // Simple Overtime logic: > 9 hours in a day
            if (hrs > 9) {
                emp.overtimeHours += (hrs - 9);
            }
        }
      }
    });

    // Final Calculation
    Object.values(map).forEach((emp) => {
      // Logic: Pay = (Base / 26 * Present Days) + Overtime
      // Alternatively (Deduction Logic): Pay = Base - (Base/26 * Absent)
      
      const perDay = emp.baseSalary / workingDays;
      
      // Calculate Pay based on presence (This handles new joiners better than deduction)
      const basePayEarned = perDay * emp.present; 
      
      const overtimePay = emp.overtimeHours * emp.overtimeRate;
      emp.totalPay = basePayEarned + overtimePay;
    });

    setRows(Object.values(map));
    setLoading(false);
  }, [month, year, supabase]); // Dependencies ensure it runs when filter changes

  // 4. Trigger loadPayroll whenever month/year changes
  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const handleEdit = (row: PayrollRow) => {
    setEditingId(row.id);
    setNewSalary(row.baseSalary);
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from("users")
      .update({ base_salary: newSalary })
      .eq("id", id);

    if (error) {
      console.error("Error updating salary:", error);
    } else {
        setEditingId(null);
        loadPayroll(); // Refresh data
    }
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
                <th className="text-left p-3 font-medium text-gray-500">Present (Days)</th>
                <th className="text-left p-3 font-medium text-gray-500">Hours</th>
                <th className="text-left p-3 font-medium text-gray-500">Base Salary</th>
                <th className="text-left p-3 font-medium text-gray-500">Overtime (₹)</th>
                <th className="text-left p-3 font-medium text-gray-900">Total Pay</th>
                <th className="text-left p-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                  <tr>
                      <td colSpan={8} className="p-4 text-center text-gray-500">No attendance data found for this month.</td>
                  </tr>
              ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50/50">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-gray-500">{row.department}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                            {row.present}
                        </span>
                      </td>
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
                          <Button size="sm" onClick={() => handleSave(row.id)} className="h-8">
                            Save
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(row)}
                            className="h-8 text-blue-600 hover:text-blue-700"
                          >
                            Edit Salary
                          </Button>
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
