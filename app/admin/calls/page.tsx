// This file runs entirely on the server to fetch data efficiently using Next.js Server Components.

import { createClient } from "@/lib/supabase/server";
// Import UI components used in your other files (assuming shadcn/ui components)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Users, BarChart3 } from "lucide-react";


// Force dynamic rendering to prevent build errors related to data fetching 
// if cookies() or other dynamic functions are used elsewhere in your app.
export const dynamic = 'force-dynamic';


// --- Data Structures ---

// Define a common set of lead statuses for consistent column headers.
const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Follow Up",
  "Closed/Converted",
  "Not Interested",
  "Junk",
];

interface TelecallerSummary {
  telecallerId: string;
  telecallerName: string;
  statusCounts: { [status: string]: number };
  totalLeads: number;
}


/**
 * FINAL REVISED: Fetches lead counts by status. 
 * Fetches users first for mapping and filtering, then performs the aggregate count.
 */
async function getTelecallerLeadSummary(): Promise<TelecallerSummary[]> {
  const supabase = await createClient();

  // 1. Fetch all users (telecallers) to get their full names and IDs
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name");
  
  if (userError) {
    console.error("Error fetching users:", userError);
    return []; 
  }

  const telecallerIds = users.map(u => u.id);

  // 2. Fetch the aggregate counts using an 'in' filter and the count aggregate.
  // This is the most reliable way to perform this operation via PostgREST/Supabase.
  const { data: leadCountsRaw, error: countError } = await supabase
    .from("leads")
    // Use the 'in' filter to only count leads assigned to known telecallers
    .in('assigned_to', telecallerIds) 
    // Select the columns to group by + the count aggregate.
    // 'count' is a special keyword for the aggregate function.
    .select("assigned_to, status, count") 
    .returns<Array<{ assigned_to: string, status: string, count: number }>>()
    
  if (countError) {
    console.error("Error fetching lead counts:", countError);
    // Log the actual error to help with RLS debugging if needed
    return [];
  }

  // 3. Process raw data into the final structured format
  const summaryMap = new Map<string, TelecallerSummary>();

  // Initialize the map with all users (even those with 0 leads)
  users.forEach(user => {
    summaryMap.set(user.id, {
      telecallerId: user.id,
      telecallerName: user.full_name || "Unknown Telecaller",
      statusCounts: {},
      totalLeads: 0,
    });
  });

  // Populate counts from the query result
  leadCountsRaw.forEach(item => {
    const telecallerId = item.assigned_to;
    const count = item.count;
    const status = item.status; 

    if (telecallerId && summaryMap.has(telecallerId) && status) {
      const summary = summaryMap.get(telecallerId)!;
      // Add the count to the specific status
      summary.statusCounts[status] = count;
      // Accumulate to the total leads
      summary.totalLeads += count;
    }
  });

  // Convert map to array and sort by total leads (descending)
  const summaryArray = Array.from(summaryMap.values())
    .sort((a, b) => b.totalLeads - a.totalLeads);

  return summaryArray;
}


// --- Next.js Page Component ---
export default async function TelecallerLeadSummaryPage() {
  const summaryData = await getTelecallerLeadSummary();
  const allStatuses = LEAD_STATUSES; 

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          Telecaller Lead Status Summary
        </h1>
      </div>

      <p className="text-gray-500">
        This table displays the **total available leads** for each telecaller, broken down by their current **status**, showing only the numbers (counts) as requested.
      </p>
      
      {/* Summary Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lead Distribution by Telecaller
            <Badge variant="secondary" className="ml-2">
              Showing {summaryData.length} Telecallers
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50/90">
                  <TableHead className="w-[180px] font-semibold text-gray-700">Telecaller</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 w-[100px] whitespace-nowrap">TOTAL LEADS</TableHead>
                  {/* Column for each defined lead status */}
                  {allStatuses.map((status) => (
                    <TableHead 
                      key={status} 
                      className="text-right font-semibold text-gray-700 whitespace-nowrap"
                    >
                      {status}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((telecaller) => (
                  <TableRow key={telecaller.telecallerId}>
                    <TableCell className="font-medium text-gray-900">{telecaller.telecallerName}</TableCell>
                    {/* Total Leads Column - Highlighted */}
                    <TableCell className="text-right font-bold text-lg text-primary bg-primary/5">
                      {telecaller.totalLeads.toLocaleString()}
                    </TableCell>
                    {/* Status Count Columns (showing only numbers) */}
                    {allStatuses.map((status) => {
                      const count = telecaller.statusCounts[status] || 0;
                      return (
                        <TableCell 
                          key={status} 
                          className={`text-right ${count > 0 ? 'font-semibold text-gray-800' : 'text-gray-400'}`}
                        >
                          {count.toLocaleString()}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                
                {/* Empty State */}
                {summaryData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={allStatuses.length + 2} className="h-24 text-center text-gray-500">
                            No assigned leads found for any telecaller.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
