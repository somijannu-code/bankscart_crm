import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Users, BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link"; 
import { DrillDownSheet } from "@/components/admin/drill-down-sheet"; 
import { SummaryAnalytics } from "@/components/admin/summary-analytics"; // <--- NEW IMPORT

export const dynamic = 'force-dynamic';

const LEAD_STATUSES = [
  "new", "contacted", "Interested", "Documents_Sent", "Login",
  "nr", "self_employed", "Disbursed", "follow_up", "Not_Interested", "not_eligible"
];

// ... (Interface and getCellColor helper remain the same as before) ...
const getCellColor = (value: number, max: number) => {
  if (value === 0) return "";
  const intensity = Math.min((value / max) * 100, 100); 
  return `rgba(16, 185, 129, ${intensity * 0.005 + 0.05})`; 
};

/**
 * Fetch and Process Data (Same Logic)
 */
async function getTelecallerLeadSummary(searchParams: { from?: string; to?: string }) {
  const supabase = await createClient();

  // Date Logic
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(); 
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const fromDate = searchParams.from || firstDay;
  const toDate = searchParams.to || tomorrow.toISOString();

  const { data: users, error: userError } = await supabase.from("users").select("id, full_name");
  if (userError) return { data: [], grandTotals: {} };

  let query = supabase.from("leads").select("assigned_to, status").not('assigned_to', 'is', null)
    .gte('created_at', fromDate).lte('created_at', toDate);

  const { data: leads, error: leadsError } = await query.range(0, 9999);
  if (leadsError) return { data: [], grandTotals: {} };

  const summaryMap = new Map();
  const grandTotals: any = { total: 0 };
  LEAD_STATUSES.forEach(s => grandTotals[s] = 0);

  users?.forEach(user => {
    summaryMap.set(user.id, {
      telecallerId: user.id,
      telecallerName: user.full_name || "Unknown",
      statusCounts: {},
      totalLeads: 0,
      conversionRate: 0
    });
  });

  leads?.forEach((lead: any) => {
    const tid = lead.assigned_to;
    const status = lead.status;
    if (tid && summaryMap.has(tid)) {
      const summary = summaryMap.get(tid);
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      summary.totalLeads += 1;
      grandTotals[status] = (grandTotals[status] || 0) + 1;
      grandTotals['total'] += 1;
    }
  });

  const processed = Array.from(summaryMap.values())
    .filter((tc: any) => tc.totalLeads > 0)
    .map((tc: any) => {
      const disbursed = tc.statusCounts["Disbursed"] || 0;
      tc.conversionRate = tc.totalLeads > 0 ? (disbursed / tc.totalLeads) * 100 : 0;
      return tc;
    })
    .sort((a: any, b: any) => b.totalLeads - a.totalLeads);

  return { data: processed, grandTotals };
}

// --- Main Page Component ---
export default async function TelecallerLeadSummaryPage({ searchParams }: { searchParams: any }) {
  const { data: summaryData, grandTotals } = await getTelecallerLeadSummary(searchParams);
  const maxCellValue = Math.max(...summaryData.map((t: any) => Math.max(...Object.values(t.statusCounts as number[]))));

  return (
    <div className="space-y-6 p-8 bg-gray-50/50 min-h-screen">
      
      {/* 1. Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Performance Summary
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Analysis from <span className="font-mono text-gray-700 bg-gray-100 px-1 rounded">{searchParams.from ? new Date(searchParams.from).toLocaleDateString() : 'Start of Month'}</span> to <span className="font-mono text-gray-700 bg-gray-100 px-1 rounded">{searchParams.to ? new Date(searchParams.to).toLocaleDateString() : 'Now'}</span>.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" asChild><Link href="?">This Month</Link></Button>
           <Button variant="outline" size="sm" asChild><Link href="?from=2023-01-01">All Time</Link></Button>
        </div>
      </div>

      {/* 2. NEW: Analytics Section (Charts & KPIs) */}
      <SummaryAnalytics data={summaryData} grandTotals={grandTotals} />
      
      {/* 3. Detailed Table Card */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <span>Team Breakdown</span>
            </div>
            <div className="flex gap-4 text-xs font-normal text-gray-500">
               <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-200 border border-green-300"></span> <span>Disbursed</span></div>
               <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-100 border border-blue-200"></span> <span>Login</span></div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100 text-xs uppercase">
                  <TableHead className="min-w-[150px] font-bold text-gray-800">Telecaller</TableHead>
                  <TableHead className="text-right font-bold text-gray-900 bg-gray-200/50">Total</TableHead>
                  <TableHead className="text-right font-bold text-blue-700 bg-blue-50/50">Conv. %</TableHead>
                  {LEAD_STATUSES.map((status) => (
                    <TableHead key={status} className={`text-right font-bold whitespace-nowrap ${status === 'Disbursed' ? 'text-green-700 bg-green-50/50' : 'text-gray-600'}`}>
                      {status.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((telecaller: any) => (
                  <TableRow key={telecaller.telecallerId} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-900 text-sm sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {telecaller.telecallerName}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900 bg-gray-50 text-sm">{telecaller.totalLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600 bg-blue-50/30 text-sm">{telecaller.conversionRate.toFixed(1)}%</TableCell>
                    {LEAD_STATUSES.map((status) => {
                      const count = telecaller.statusCounts[status] || 0;
                      const isKeyMetric = status === 'Disbursed' || status === 'Login';
                      return (
                        <TableCell key={status} className="text-right text-gray-700 text-sm p-2"
                          style={{ backgroundColor: isKeyMetric && count > 0 ? (status === 'Disbursed' ? '#dcfce7' : '#dbeafe') : getCellColor(count, maxCellValue) }}>
                          <DrillDownSheet agentId={telecaller.telecallerId} agentName={telecaller.telecallerName} status={status} count={count} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-900 text-white hover:bg-slate-900">
                <TableRow>
                  <TableCell className="font-bold pl-4">Grand Total</TableCell>
                  <TableCell className="text-right font-bold text-white">{grandTotals['total'].toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-blue-300">
                    {grandTotals['total'] > 0 ? ((grandTotals['Disbursed'] / grandTotals['total']) * 100).toFixed(1) + "%" : "0%"}
                  </TableCell>
                  {LEAD_STATUSES.map(status => (
                    <TableCell key={status} className={`text-right font-bold ${status === 'Disbursed' ? 'text-green-300' : 'text-slate-300'}`}>
                      {grandTotals[status].toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
