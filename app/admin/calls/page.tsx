// This file runs entirely on the server to fetch data efficiently.

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Users, BarChart3 } from "lucide-react";

// CRITICAL FIX: Ensures this page runs dynamically at request time.
export const dynamic = 'force-dynamic';

// --- Data Structures ---

// UPDATED: Comprehensive list of statuses matching 'leads-table (17).tsx'
// This ensures all leads are counted in their respective columns.
const LEAD_STATUSES = [
  "new",
  "contacted",
  "Interested",
  "Documents_Sent",
  "Login",
  "nr",
  "self_employed",
  "Disbursed",
  "follow_up",
  "Not_Interested",
  "not_eligible"
];

interface TelecallerSummary {
  telecallerId: string;
  telecallerName: string;
  statusCounts: { [status: string]: number };
  totalLeads: number;
}

/**
 * Fetches all leads and users to generate a summary.
 */
async function getTelecallerLeadSummary(): Promise<TelecallerSummary[]> {
  try {
    const supabase = await createClient();

    // 1. Fetch all users (telecallers)
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name");
    
    if (userError) {
      console.error("Error fetching users:", userError);
      return []; 
    }
    
    // 2. Fetch ALL assigned leads
    // We only need status and assigned_to to perform the count
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("assigned_to, status")
      .not('assigned_to', 'is', null);

    if (leadsError) {
        console.error("Error fetching leads:", leadsError);
        return [];
    }

    // 3. --- Grouping Logic ---
    const summaryMap = new Map<string, TelecallerSummary>();

    // Initialize map with all users to ensure even users with 0 leads show up (optional)
    // or strictly those who are assigned leads.
    users?.forEach(user => {
      summaryMap.set(user.id, {
        telecallerId: user.id,
        telecallerName: user.full_name || "Unknown User",
        statusCounts: {},
        totalLeads: 0,
      });
    });

    // Process leads
    leads?.forEach((lead: any) => {
      const telecallerId = lead.assigned_to;
      const status = lead.status;

      // Only process if we have a valid telecaller ID in our map
      if (telecallerId && summaryMap.has(telecallerId)) {
        const summary = summaryMap.get(telecallerId)!;
        
        // Normalize status to handle potential case sensitivity issues if DB is messy
        // (Though strictly matching the array is usually best)
        
        // Increment specific status count
        summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
        
        // Increment total
        summary.totalLeads += 1;
      }
    });

    // Convert to array, filter out users with 0 leads (optional, keeps table clean), and sort
    const results = Array.from(summaryMap.values())
      .filter(tc => tc.totalLeads > 0) 
      .sort((a, b) => b.totalLeads - a.totalLeads);

    return results;

  } catch (e) {
    console.error("CRITICAL UNHANDLED ERROR:", e);
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
        This table displays the **total available leads** for each telecaller, broken down by their current **status**.
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
                  <TableHead className="min-w-[180px] font-semibold text-gray-700">Telecaller</TableHead>
                  <TableHead className="text-right font-semibold text-gray-900 w-[100px] whitespace-nowrap bg-gray-100/50">TOTAL</TableHead>
                  {/* Column for each defined lead status */}
                  {allStatuses.map((status) => (
                    <TableHead 
                      key={status} 
                      className="text-right font-semibold text-gray-700 whitespace-nowrap capitalize"
                    >
                      {status.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((telecaller) => (
                  <TableRow key={telecaller.telecallerId}>
                    <TableCell className="font-medium text-gray-900">
                      {telecaller.telecallerName}
                    </TableCell>
                    
                    {/* Total Leads Column - Highlighted */}
                    <TableCell className="text-right font-bold text-lg text-primary bg-primary/5">
                      {telecaller.totalLeads.toLocaleString()}
                    </TableCell>
                    
                    {/* Status Count Columns */}
                    {allStatuses.map((status) => {
                      const count = telecaller.statusCounts[status] || 0;
                      return (
                        <TableCell 
                          key={status} 
                          className={`text-right ${count > 0 ? 'font-semibold text-gray-800' : 'text-gray-300'}`}
                        >
                          {count > 0 ? count.toLocaleString() : "-"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                
                {/* Empty State */}
                {summaryData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={allStatuses.length + 2} className="h-24 text-center text-gray-500">
                            No assigned leads found.
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
