import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Users, BarChart3, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link"; 
import { DrillDownSheet } from "@/components/admin/drill-down-sheet"; // <--- IMPORT CLIENT COMPONENT

export const dynamic = 'force-dynamic';

// --- Configuration ---
const LEAD_STATUSES = [
  "new", "contacted", "Interested", "Documents_Sent", "Login",
  "nr", "self_employed", "Disbursed", "follow_up", "Not_Interested", "not_eligible"
];

interface TelecallerSummary {
  telecallerId: string;
  telecallerName: string;
  statusCounts: { [status: string]: number };
  totalLeads: number;
  conversionRate: number;
}

// --- Helper: Heatmap Color ---
const getCellColor = (value: number, max: number) => {
  if (value === 0) return "";
  const intensity = Math.min((value / max) * 100, 100); 
  return `rgba(16, 185, 129, ${intensity * 0.005 + 0.05})`; 
};

/**
 * Fetch and Process Data
 */
async function getTelecallerLeadSummary(searchParams: { from?: string; to?: string }) {
  const supabase = await createClient();

  // 1. Date Filter Logic
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(); 
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  
  const fromDate = searchParams.from || firstDay;
  const toDate = searchParams.to || tomorrow.toISOString();

  // 2. Fetch Users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name");

  if (userError) return { data: [], grandTotals: {} };

  // 3. Fetch Leads with Date Filter
  let query = supabase
    .from("leads")
    .select("assigned_to, status")
    .not('assigned_to', 'is', null)
    .gte('created_at', fromDate)
    .lte('created_at', toDate);

  const { data: leads, error: leadsError } = await query.range(0, 9999);

  if (leadsError) {
    console.error("Lead fetch error", leadsError);
    return { data: [], grandTotals: {} };
  }

  // 4. Processing
  const summaryMap = new Map<string, TelecallerSummary>();
  const grandTotals: { [key: string]: number } = { total: 0 };
  
  // Init Grand Totals
  LEAD_STATUSES.forEach(s => grandTotals[s] = 0);

  // Init Map
  users?.forEach(user => {
    summaryMap.set(user.id, {
      telecallerId: user.id,
      telecallerName: user.full_name || "Unknown",
      statusCounts: {},
      totalLeads: 0,
      conversionRate: 0
    });
  });

  // Aggregate
  leads?.forEach((lead: any) => {
    const tid = lead.assigned_to;
    const status = lead.status;

    if (tid && summaryMap.has(tid)) {
      const summary = summaryMap.get(tid)!;
      
      // Update User Stats
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
      summary.totalLeads += 1;

      // Update Grand Totals
      grandTotals[status] = (grandTotals[status] || 0) + 1;
      grandTotals['total'] += 1;
    }
  });

  // Calculate Metrics & Sort
  const processed = Array.from(summaryMap.values())
    .filter(tc => tc.totalLeads > 0)
    .map(tc => {
      const disbursed = tc.statusCounts["Disbursed"] || 0;
      tc.conversionRate = tc.totalLeads > 0 ? (disbursed / tc.totalLeads) * 100 : 0;
      return tc;
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);

  return { data: processed, grandTotals };
}


// --- Page Component ---
export default async function TelecallerLeadSummaryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { data: summaryData, grandTotals } = await getTelecallerLeadSummary(searchParams);
  
  // Find max value in a single cell for heatmap scaling
  const maxCellValue = Math.max(
    ...summaryData.map(t => Math.max(...Object.values(t.statusCounts)))
  );

  return (
    <div className="space-y-6 p-8 bg-gray-50/50 min-h-screen">
      
      {/* Header & Controls */}
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

        {/* Quick Filters */}
        <div className="flex gap-2">
           <Button variant="outline" size="sm" asChild>
             <Link href="?">This Month</Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link href="?from=2023-01-01">All Time</Link>
           </Button>
        </div>
      </div>
      
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <span>Team Performance</span>
            </div>
            <div className="flex gap-4 text-xs font-normal text-gray-500">
               <div className="flex items-center gap-1">
                 <span className="w-2 h-2 rounded-full bg-green-200 border border-green-300"></span> 
                 <span>Disbursed</span>
               </div>
               <div className="flex items-center gap-1">
                 <span className="w-2 h-2 rounded-full bg-blue-100 border border-blue-200"></span> 
                 <span>Login</span>
               </div>
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
                    <TableHead 
                      key={status} 
                      className={`text-right font-bold whitespace-nowrap ${status === 'Disbursed' ? 'text-green-700 bg-green-50/50' : 'text-gray-600'}`}
                    >
                      {status.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((telecaller) => (
                  <TableRow key={telecaller.telecallerId} className="hover:bg-gray-50 transition-colors">
                    {/* Name Cell - Sticky */}
                    <TableCell className="font-medium text-gray-900 text-sm sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {telecaller.telecallerName}
                    </TableCell>
                    
                    {/* Total Leads */}
                    <TableCell className="text-right font-bold text-gray-900 bg-gray-50 text-sm">
                      {telecaller.totalLeads.toLocaleString()}
                    </TableCell>

                    {/* Conversion Rate */}
                    <TableCell className="text-right font-bold text-blue-600 bg-blue-50/30 text-sm">
                      {telecaller.conversionRate.toFixed(1)}%
                    </TableCell>

                    {/* Status Columns with Drill-Down & Heatmap */}
                    {LEAD_STATUSES.map((status) => {
                      const count = telecaller.statusCounts[status] || 0;
                      const isKeyMetric = status === 'Disbursed' || status === 'Login';
                      
                      return (
                        <TableCell 
                          key={status} 
                          className="text-right text-gray-700 text-sm p-2"
                          style={{ 
                            backgroundColor: isKeyMetric && count > 0 
                              ? (status === 'Disbursed' ? '#dcfce7' : '#dbeafe')
                              : getCellColor(count, maxCellValue)
                          }}
                        >
                          <DrillDownSheet 
                            agentId={telecaller.telecallerId}
                            agentName={telecaller.telecallerName}
                            status={status}
                            count={count}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              
              {/* Grand Totals Footer */}
              <TableFooter className="bg-slate-900 text-white hover:bg-slate-900">
                <TableRow>
                  <TableCell className="font-bold pl-4">Grand Total</TableCell>
                  <TableCell className="text-right font-bold text-white">{grandTotals['total'].toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-blue-300">
                    {grandTotals['total'] > 0 
                      ? ((grandTotals['Disbursed'] / grandTotals['total']) * 100).toFixed(1) + "%" 
                      : "0%"}
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
