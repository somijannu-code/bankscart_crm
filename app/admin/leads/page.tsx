import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Upload, UserPlus, Filter } from "lucide-react"
import Link from "next/link"
import { LeadsTable } from "@/components/leads-table"
import { LeadFilters } from "@/components/lead-filters"

interface SearchParams {
  status?: string
  priority?: string
  assigned_to?: string
  source?: string
  search?: string
  page?: string
  limit?: string
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  
  // 1. PERFORMANCE: Reduced limit to 50 for instant load
  const page = parseInt(searchParams.page || "1")
  const limit = parseInt(searchParams.limit || "50") 
  const offset = (page - 1) * limit

  // 2. Build optimized query
  let query = supabase
    .from("leads")
    .select(`
      *,
      assigned_user:users!leads_assigned_to_fkey(id, full_name),
      assigner:users!leads_assigned_by_fkey(id, full_name)
    `, { count: 'exact' }) // Get count in same query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply filters server-side
  if (searchParams.status && searchParams.status !== 'all') query = query.eq("status", searchParams.status)
  if (searchParams.priority && searchParams.priority !== 'all') query = query.eq("priority", searchParams.priority)
  if (searchParams.assigned_to && searchParams.assigned_to !== 'all') {
    if (searchParams.assigned_to === 'unassigned') query = query.is("assigned_to", null)
    else query = query.eq("assigned_to", searchParams.assigned_to)
  }
  if (searchParams.source && searchParams.source !== 'all') query = query.eq("source", searchParams.source)
  
  if (searchParams.search) {
    query = query.or(
      `name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`
    )
  }

  const { data: leads, count: totalResults } = await query

  // 3. Fetch supporting data efficiently
  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  // Fetch today's attendance once (to pass to table)
  const today = new Date().toISOString().split('T')[0]
  const { data: attendance } = await supabase
    .from("attendance")
    .select("user_id, check_in")
    .eq("date", today)
  
  const telecallerStatus: Record<string, boolean> = {}
  attendance?.forEach(r => telecallerStatus[r.user_id] = !!r.check_in)

  // Stats (kept separate for accuracy independent of filters)
  const { count: totalLeads } = await supabase.from("leads").select("*", { count: "exact", head: true })
  const { count: unassignedLeads } = await supabase.from("leads").select("*", { count: "exact", head: true }).is("assigned_to", null)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">Manage and assign leads to your team</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/upload">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </Link>
          <Link href="/admin/leads/new">
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalLeads || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unassigned</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{unassignedLeads || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-50">
                <UserPlus className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Telecallers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{telecallers?.length || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Component */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeadFilters telecallers={telecallers || []} />
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Leads List ({totalResults?.toLocaleString() || 0} results)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable 
            leads={leads || []} 
            telecallers={telecallers || []} 
            telecallerStatus={telecallerStatus}
            totalCount={totalResults || 0}
            currentPage={page}
            pageSize={limit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
