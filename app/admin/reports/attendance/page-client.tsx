"use client";

import { useState } from "react";
import { PayrollIntegrationReport } from "@/components/PayrollIntegrationReport";
import { SummaryReport } from "@/components/SummaryReport";
import { DetailedReport } from "@/components/DetailedReport";
import { TrendsReport } from "@/components/TrendsReport";
import { DailyLateReport } from "@/components/DailyLateReport"; // New Component

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Download } from "lucide-react";

export default function AttendanceReportsPageClient() {
  // View State (includes new 'late_checkins' option)
  const [view, setView] = useState<"summary" | "detailed" | "trends" | "payroll" | "late_checkins">("payroll");

  // Date Filter State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth())); // 0 = Jan, 11 = Dec
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));

  // Generate Year Options (Last 2 years + Next year)
  const currentYearInt = currentDate.getFullYear();
  const years = [currentYearInt - 1, currentYearInt, currentYearInt + 1];

  const months = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Reports</h1>
          <p className="text-muted-foreground">
            Analyze attendance trends, payroll, and punctuality.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          {/* YEAR SELECTOR */}
          <div className="flex items-center gap-2 bg-white border rounded-md px-2 shadow-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[80px] border-0 focus:ring-0 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                    {y}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>

          {/* MONTH SELECTOR */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] bg-white shadow-sm h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* REPORT VIEW SELECTOR */}
          <Select value={view} onValueChange={(val) => setView(val as any)}>
            <SelectTrigger className="w-[180px] bg-white shadow-sm h-10 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="detailed">Detailed History</SelectItem>
              <SelectItem value="trends">Trends Analysis</SelectItem>
              <SelectItem value="payroll">Payroll (Salary)</SelectItem>
              <SelectItem value="late_checkins" className="text-red-600 focus:text-red-700">
                🔴 Late Check-ins
              </SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2 shadow-sm">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* DYNAMIC REPORT RENDERING */}
      <div className="min-h-[500px]">
        {view === "summary" && (
          <SummaryReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />
        )}
        
        {view === "detailed" && (
          <DetailedReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />
        )}
        
        {view === "trends" && (
          <TrendsReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />
        )}
        
        {view === "payroll" && (
          <PayrollIntegrationReport month={parseInt(selectedMonth)} year={parseInt(selectedYear)} />
        )}

        {view === "late_checkins" && (
          <DailyLateReport />
        )}
      </div>
    </div>
  );
}
