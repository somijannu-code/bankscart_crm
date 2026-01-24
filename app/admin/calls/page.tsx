import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link"; 
import { SummaryAnalytics } from "@/components/admin/summary-analytics"; 
import { TelecallerTable } from "@/components/admin/telecaller-table"; // <--- NEW IMPORT

export const dynamic = 'force-dynamic';

const LEAD_STATUSES = [
  "new", "contacted", "Interested", "Documents_Sent", "Login",
  "nr", "self_employed", "Disbursed", "follow_up", "Not_Interested", "not_eligible"
];

// --- Data Fetching Logic ---
async function getTelecallerLeadSummary(searchParams: { from?: string; to?: string }) {
  const supabase = await createClient();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(); 
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  
  const fromDate = searchParams.from || firstDay;
  const toDate = searchParams.to || tomorrow.toISOString();

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name");

  if (userError) return { data: [], grandTotals: {} };

  let query = supabase
    .from("leads")
    .select("assigned_to, status")
    .not('assigned_to', 'is', null)
    .gte('created_at', fromDate)
    .lte('created_at', toDate);

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
export default async function TelecallerLeadSummaryPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { data: summaryData, grandTotals } = await getTelecallerLeadSummary(searchParams);

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
            Analysis from <span className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border">{searchParams.from ? new Date(searchParams.from).toLocaleDateString() : 'Start of Month'}</span> to <span className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border">{searchParams.to ? new Date(searchParams.to).toLocaleDateString() : 'Now'}</span>.
          </p>
        </div>

        <div className="flex gap-2">
           <Button variant="outline" size="sm" asChild>
             <Link href="?">This Month</Link>
           </Button>
           <Button variant="outline" size="sm" asChild>
             <Link href="?from=2023-01-01">All Time</Link>
           </Button>
        </div>
      </div>

      {/* 1. Analytics Section */}
      <SummaryAnalytics data={summaryData} grandTotals={grandTotals} />
      
      {/* 2. Interactive Data Table */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-4">
          <TelecallerTable 
            data={summaryData} 
            grandTotals={grandTotals} 
            statuses={LEAD_STATUSES} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
