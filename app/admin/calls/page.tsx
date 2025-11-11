// This file runs entirely on the server to fetch data efficiently.

import { createClient } from "@/lib/supabase/server";
// Assuming these are available from your component library
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Users, BarChart3 } from "lucide-react";


// CRITICAL FIX: Ensures this page runs dynamically at request time, 
// preventing production build errors related to dynamic server usage (like cookies()).
export const dynamic = 'force-dynamic';


// --- Data Structures ---

// Define a common set of lead statuses for consistent column headers.
const LEAD_STATUSES = [
  "new",
  "contacted",
  "Interested",
  "Interested",
  "nr",
  "Not_Interested",
  "Junk",
];

interface Lead {
  assigned_to: string;
  status: string;
}

interface TelecallerSummary {
  telecallerId: string;
  telecallerName: string;
  statusCounts: { [status: string]: number };
  totalLeads: number;
}


/**
 * STABLE FUNCTION: Fetches all leads and processes the counts locally 
 * in the server component. This avoids RLS restrictions on aggregate queries.
 */
async function getTelecallerLeadSummary(): Promise<TelecallerSummary[]> {
  try {
    const supabase = await createClient();

    // 1. Fetch all users (telecallers) to get names and IDs
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name");
    
    if (userError) {
      console.error("Error fetching users:", userError);
      return []; 
    }
    
    // 2. Fetch ALL leads with minimal columns (similar to working pages)
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("assigned_to, status") // Only need these two columns for counting
      .not('assigned_to', 'is', null) // Only leads assigned to someone
      .returns<Lead[]>()

    if (leadsError) {
        console.error("CRITICAL LEAD FETCH ERROR (RLS likely blocking simple SELECT, or credential issue):", leadsError);
        return [];
    }

    // 3. --- Grouping Logic (in Next.js Server Component) ---
    const summaryMap = new Map<string, TelecallerSummary>();

    // Initialize map with all users
    users.forEach(user => {
      summaryMap.set(user.id, {
        telecallerId: user.id,
        telecallerName: user.full_name || "Unknown Telecaller",
        statusCounts: {},
        totalLeads: 0,
      });
    });

    // Process leads and populate counts
    leads.forEach(lead => {
      const telecallerId = lead.assigned_to;
      const status = lead.status;

      // Check if the assigned ID is a recognized user and the status is valid
      if (telecallerId && summaryMap.has(telecallerId) && status) {
        const summary = summaryMap.get(telecallerId)!;
        
        // Increment the count for the specific status
        summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
        
        // Increment the total count
        summary.totalLeads += 1;
      }
    });

    // Final array, filter for users with leads, and sort by total leads (descending)
    return Array.from(summaryMap.values())
      .filter(tc => tc.totalLeads > 0) 
      .sort((a, b) => b.totalLeads - a.totalLeads);

  } catch (e) {
    // Catch any unexpected runtime errors
    console.error("CRITICAL UNHANDLED ERROR IN getTelecallerLeadSummary:", e);
    return [];
  }
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
        This table displays the **total available leads** for each telecaller, broken down by their current **status**, showing only the numbers (counts).
      </p>
      
      {/* Summary Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lead Distribution by Telecaller
            <Badge variant="secondary" className="ml-2">
              Showing {summaryData.length} Telecallers with Leads
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
                            No assigned leads found or a data fetching error occurred.
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
