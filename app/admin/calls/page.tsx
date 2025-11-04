// app/admin/leads-summary/page.tsx
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, BarChart3, TrendingUp, AlertCircle, XCircle, CheckCircle2 } from "lucide-react"

// --- Helper Functions and Mappings ---

// Status to UI map for styling (You can expand this with your actual lead statuses)
const statusMap: Record<string, { label: string; className: string; icon: any }> = {
  'New': { label: 'New', className: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  'Contacted': { label: 'Contacted', className: 'bg-yellow-100 text-yellow-700', icon: TrendingUp },
  'Follow-up': { label: 'Follow-up', className: 'bg-orange-100 text-orange-700', icon: BarChart3 },
  'Qualified': { label: 'Qualified', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Converted': { label: 'Converted', className: 'bg-teal-100 text-teal-700', icon: CheckCircle2 },
  'Unqualified': { label: 'Unqualified', className: 'bg-red-100 text-red-700', icon: XCircle },
  'Unassigned': { label: 'Unassigned', className: 'bg-gray-100 text-gray-500', icon: AlertCircle },
}

const getStatusStyle = (status: string) => statusMap[status] || statusMap['Unassigned'];

// --- Main Component ---

export default async function LeadsSummaryPage() {
  const supabase = await createClient()

  // 1. Fetch ALL leads with their status and assigned telecaller_id
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("telecaller_id, status") // **CORRECTED: Using telecaller_id**
    .neq("telecaller_id", null) // Only count leads that are assigned to a telecaller

  if (leadsError || !leads) {
    console.error("Error fetching leads:", leadsError)
    return <p className="p-6 text-red-500">Error loading lead data: {leadsError?.message}</p>
  }
  
  // 2. Extract all unique Telecaller IDs from the leads
  const uniqueTelecallerIds = [...new Set(leads.map(lead => (lead as any).telecaller_id).filter(Boolean))]

  // 3. Fetch Telecaller Names (Users Data)
  let usersData: Record<string, { name: string }> = {}
  if (uniqueTelecallerIds.length > 0) {
    // Fetching user details (assuming 'users' table is the correct reference)
    const { data: users } = await supabase.from("users").select("id, email, raw_user_meta_data").in("id", uniqueTelecallerIds);
    
    if (users) {
      usersData = users.reduce((acc: Record<string, any>, user: any) => {
        // Use name from meta data if available, otherwise use email
        const telecallerName = user.raw_user_meta_data?.name || user.email || `User ID: ${user.id}`;
        acc[user.id] = { name: telecallerName };
        return acc
      }, {} as Record<string, any>)
    }
  }

  // 4. Aggregate the leads data by Telecaller and Status
  const summary: Record<string, { name: string, total: number, counts: Record<string, number> }> = {}
  const allStatuses = new Set<string>()

  for (const lead of leads) {
    // CORRECTED: Using telecaller_id
    const telecallerId = (lead as any).telecaller_id as string 
    const status = lead.status || 'Unassigned' 
    
    // Add status to the set to generate table headers later
    allStatuses.add(status)

    if (!summary[telecallerId]) {
      // Initialize entry for the telecaller
      const user = usersData[telecallerId] || { name: `User ID: ${telecallerId}` }
      summary[telecallerId] = {
        name: user.name,
        total: 0,
        counts: {}
      }
    }

    // Increment totals and status counts
    summary[telecallerId].total += 1
    summary[telecallerId].counts[status] = (summary[telecallerId].counts[status] || 0) + 1
  }

  const sortedStatuses = Array.from(allStatuses).sort((a, b) => {
    // Custom sort to put New/Unqualified/Unassigned first, then alphabetical
    const order = ['New', 'Contacted', 'Follow-up', 'Qualified', 'Converted', 'Unqualified', 'Unassigned'];
    return order.indexOf(a) - order.indexOf(b);
  });
  
  const telecallerSummary = Object.values(summary);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Telecaller Leads Summary</h1>
          <p className="text-gray-600 mt-1">Total leads assigned to each telecaller, grouped by status.</p>
        </div>
      </div>

      {/* Aggregated Overall Stat */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Assigned Leads</CardTitle>
          <Users className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {leads.length}
          </div>
          <p className="text-xs text-gray-500">
            Across {telecallerSummary.length} active telecallers
          </p>
        </CardContent>
      </Card>

      {/* Leads Breakdown Table */}
      <div className="shadow-lg rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[200px] text-lg font-bold text-gray-800">Telecaller</TableHead>
              <TableHead className="text-center font-bold text-gray-800">Total Leads</TableHead>
              {sortedStatuses.map(status => {
                const { label } = getStatusStyle(status);
                return (
                  <TableHead key={status} className="text-center">
                    <span className="font-semibold">{label}</span>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {telecallerSummary.map((tc, index) => (
              <TableRow key={index} className="hover:bg-blue-50/50">
                <TableCell className="font-medium text-gray-900">{tc.name}</TableCell>
                <TableCell className="text-center font-bold text-lg text-blue-600">{tc.total}</TableCell>
                {sortedStatuses.map(status => {
                  const count = tc.counts[status] || 0;
                  const { className, icon: Icon } = getStatusStyle(status);
                  
                  return (
                    <TableCell key={status} className="text-center">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${className}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {count}
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}

            {telecallerSummary.length === 0 && (
              <TableRow>
                <TableCell colSpan={sortedStatuses.length + 2} className="h-24 text-center text-gray-500">
                  No leads are currently assigned to any telecaller.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
