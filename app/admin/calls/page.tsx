"use client";

import { useMemo } from "react"
import { 
  User, PieChart, BarChart3, Users, CheckCircle2, XCircle
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { LeadsTable, Lead } from "./leads-table"; // Assuming you export Lead interface from leads-table.tsx
// NOTE: I'm importing the 'Lead' interface from the file you provided for consistency.

// Define the required Lead and Telecaller interfaces for type safety
interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  priority: string
  created_at: string
  last_contacted: string | null
  loan_amount: number | null
  loan_type: string | null
  source: string | null
  assigned_to: string | null
  assigned_user: {
    id: string
    full_name: string
  } | null
  city: string | null
  follow_up_date: string | null
  lead_score?: number
  tags?: string[]
}

interface Telecaller {
  id: string
  full_name: string
}

interface TelecallerPerformanceDashboardProps {
  leads: Lead[]
  telecallers: Telecaller[]
}

// Define all possible lead statuses for the table columns
const ALL_LEAD_STATUSES: string[] = [
  "new", 
  "contacted", 
  "Interested", 
  "Documents_Sent", 
  "Login",
  "follow_up", // Added 'follow_up' based on the status score in LeadsTable
  "nr",
  "self_employed",
  "Disbursed",
  "Not_Interested",
  "not_eligible",
  // Ensure all statuses used in the application are listed here
];

/**
 * Utility function to get a consistent display name for a status
 * @param status 
 * @returns 
 */
const getStatusDisplayName = (status: string): string => {
    switch(status) {
        case "Documents_Sent": return "Docs Sent"
        case "Not_Interested": return "Not Interested"
        case "not_eligible": return "Not Eligible"
        case "self_employed": return "Self Employed"
        case "follow_up": return "Follow Up"
        case "nr": return "NR"
        default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
}

/**
 * Utility function to get a color for a status badge (reused from LeadsTable logic)
 * @param status 
 * @returns 
 */
const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    "new": "bg-blue-500 hover:bg-blue-600",
    "contacted": "bg-yellow-500 hover:bg-yellow-600",
    "Interested": "bg-green-500 hover:bg-green-600",
    "Documents_Sent": "bg-purple-500 hover:bg-purple-600",
    "Login": "bg-orange-500 hover:bg-orange-600",
    "Disbursed": "bg-green-700 hover:bg-green-800",
    "Not_Interested": "bg-red-500 hover:bg-red-600",
    "follow_up": "bg-indigo-500 hover:bg-indigo-600",
    "not_eligible": "bg-red-600 hover:bg-red-700",
    "nr": "bg-gray-500 hover:bg-gray-600",
    "self_employed": "bg-amber-500 hover:bg-amber-600"
  }
  return colors[status] || "bg-gray-500 hover:bg-gray-600"
}


export function TelecallerPerformanceDashboard({ leads = [], telecallers = [] }: TelecallerPerformanceDashboardProps) {

  // Group leads by telecaller and then by status
  const telecallerLeadSummary = useMemo(() => {
    const summary = new Map<string, {
      telecallerName: string, 
      totalLeads: number,
      statusCounts: Record<string, number>
    }>()

    // Initialize with all telecallers
    telecallers.forEach(tc => {
        summary.set(tc.id, {
            telecallerName: tc.full_name,
            totalLeads: 0,
            statusCounts: ALL_LEAD_STATUSES.reduce((acc, status) => ({...acc, [status]: 0}), {} as Record<string, number>)
        })
    })

    // Process leads
    leads.forEach(lead => {
      const assignedToId = lead.assigned_to || 'unassigned'
      const status = lead.status || 'new' // Default to 'new' if status is missing
      
      // Ensure the telecaller entry exists (handles assigned_to: null/unassigned and the predefined list)
      if (!summary.has(assignedToId)) {
        const name = assignedToId === 'unassigned' ? 'Unassigned' : (lead.assigned_user?.full_name || 'Unknown Telecaller')
        summary.set(assignedToId, {
            telecallerName: name,
            totalLeads: 0,
            statusCounts: ALL_LEAD_STATUSES.reduce((acc, status) => ({...acc, [status]: 0}), {} as Record<string, number>)
        })
      }

      const tcData = summary.get(assignedToId)!
      tcData.totalLeads += 1
      tcData.statusCounts[status] = (tcData.statusCounts[status] || 0) + 1
    })

    // Convert Map to an array and sort 'Unassigned' to the end
    const summaryArray = Array.from(summary.entries()).map(([id, data]) => ({ id, ...data }));
    
    summaryArray.sort((a, b) => {
        if (a.id === 'unassigned') return 1;
        if (b.id === 'unassigned') return -1;
        return a.telecallerName.localeCompare(b.telecallerName);
    });

    return summaryArray
  }, [leads, telecallers])
  
  // Calculate overall status distribution for the summary card
  const overallStatusDistribution = useMemo(() => {
    return leads.reduce((acc, lead) => {
        const status = lead.status || 'new'
        acc[status] = (acc[status] || 0) + 1
        return acc
    }, {} as Record<string, number>)
  }, [leads])

  const totalLeads = leads.length;

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-blue-600" />
        Telecaller Lead Performance Dashboard
      </h1>
      <CardDescription>
        Overview of lead distribution and status breakdown across all telecallers.
      </CardDescription>
      
      <Separator />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Leads in System</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {telecallers.length} telecallers managed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Disbursed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{overallStatusDistribution.Disbursed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Conversion Rate: {totalLeads > 0 ? ((overallStatusDistribution.Disbursed || 0) / totalLeads * 100).toFixed(1) : '0'}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Not Interested / Eligible</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">
                {(overallStatusDistribution.Not_Interested || 0) + (overallStatusDistribution.not_eligible || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Key loss indicators
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Status Distribution Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Telecaller Lead Distribution
          </CardTitle>
          <CardDescription>
            Count of leads assigned to each telecaller, categorized by their current status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px] sticky left-0 bg-white z-10">
                    Telecaller
                  </TableHead>
                  <TableHead className="text-right">Total Leads</TableHead>
                  {ALL_LEAD_STATUSES.map(status => (
                    <TableHead key={status} className="text-center min-w-[100px] whitespace-nowrap">
                      <Badge 
                        className={`text-white font-medium text-xs ${getStatusColor(status)}`}
                      >
                        {getStatusDisplayName(status)}
                      </Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {telecallerLeadSummary.map((tc, index) => (
                  <TableRow key={tc.id}>
                    <TableCell className={`font-semibold min-w-[150px] sticky left-0 z-10 ${tc.id === 'unassigned' ? 'text-red-600 bg-red-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {tc.telecallerName}
                        </div>
                    </TableCell>
                    <TableCell className="font-bold text-right text-lg">
                      {tc.totalLeads}
                    </TableCell>
                    {ALL_LEAD_STATUSES.map(status => (
                      <TableCell key={status} className="text-center">
                        <span className="font-mono text-sm">
                            {tc.statusCounts[status] || 0}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Overall Status Pie Chart Placeholder (as an idea for visualization) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Overall Lead Status Distribution
          </CardTitle>
          <CardDescription>
            A graphical view of all leads across different statuses. (Visualization component pending)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(overallStatusDistribution)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([status, count]) => (
                <div key={status} className="flex items-center gap-1">
                    <Badge className={`text-white font-medium ${getStatusColor(status)}`}>
                        {getStatusDisplayName(status)}
                    </Badge>
                    <span className="font-bold text-lg">({count})</span>
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
    </div>
  )
}
// You would render this component in your admin page, passing it the leads and telecallers props:
// <TelecallerPerformanceDashboard leads={allLeads} telecallers={allTelecallers} />
