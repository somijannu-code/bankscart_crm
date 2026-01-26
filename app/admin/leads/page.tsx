import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Upload, UserPlus, Filter, Loader2 } from "lucide-react"
import Link from "next/link"
import { LeadsTable } from "@/components/leads-table"
import { LeadFilters } from "@/components/lead-filters"
import { Suspense } from "react"

interface SearchParams {
  status?: string
  priority?: string
  assigned_to?: string
  search?: string
  source?: string
  date_range?: string
  from?: string
  to?: string
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  
  // 1. Base Query
  let query = supabase
    .from("leads")
    .select(`
      *,
      assigned_user:users!leads_assigned_to_fkey(id, full_name),
      assigner:users!leads_assigned_by_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false })

  // 2. Apply Server-Side Filters (Efficient)
  if (searchParams.status && searchParams.status !== 'all') query = query.eq("status", searchParams.status)
  if (searchParams.priority && searchParams.priority !== 'all') query = query.eq("priority", searchParams.priority)
  if (searchParams.assigned_to && searchParams.assigned_to !== 'all') {
     if(searchParams.assigned_to === 'unassigned') query = query.is("assigned_to", null)
     else query = query.eq("assigned_to", searchParams.assigned_to)
  }
  if (searchParams.source && searchParams.source !== 'all') query = query.ilike("source", `%${searchParams.source}%`)
  if (searchParams.search) {
    query = query.or(`name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`)
  }

  // Date Logic
  if (searchParams.date_range && searchParams.date_range !== 'all') {
    const today = new Date()
    today.setHours(0, 0, 0, 0) 

    if (searchParams.date_range === 'today') {
      query = query.gte('created_at', today.toISOString())
    } else if (searchParams.date_range === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())
    } else if (searchParams.date_range === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      query = query.gte('created_at', startOfMonth.toISOString())
    } else if (searchParams.date_range === 'custom' && searchParams.from) {
      const fromDate = new Date(searchParams.from)
      const toDate = searchParams.to ? new Date(searchParams.to) : new Date(fromDate)
      toDate.setHours(23, 59, 59, 999)
      query = query.gte('created_at', fromDate.toISOString()).lte('created_at', toDate.toISOString())
    }
  }

  // 3. Parallel Data Fetching
  const todayDate = new Date().toISOString().split('T')[0]

  const [
    { data: leads },
    { data: telecallers },
    { count: totalLeads },
    { count: unassignedLeads },
    { data: attendanceData }
  ] = await Promise.all([
    query, // The filtered leads
    supabase.from("users").select("id, full_name").eq("role", "telecaller").eq("is_active", true),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).is("assigned_to", null),
    supabase.from("attendance").select("user_id").eq("date", todayDate).not("check_in", "is", null)
  ])

  // 4. Process Attendance Map
  const telecallerStatus: Record<string, boolean> = {}
  attendanceData?.forEach((rec: any) => {
    telecallerStatus[rec.user_id] = true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">Manage, track, and convert your pipeline.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/upload">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </Link>
          <Link href="/admin/leads/new">
            <Button className="flex items-center gap-2 shadow-sm">
              <UserPlus className="h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalLeads?.toLocaleString() || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unassigned</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{unassignedLeads?.toLocaleString() || 0}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-50">
                <UserPlus className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{attendanceData?.length || 0} <span className="text-sm text-gray-400 font-normal">/ {telecallers?.length || 0}</span></p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Area */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-gray-500" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Suspense fallback={<div className="h-10 bg-gray-100 rounded animate-pulse" />}>
            <LeadFilters telecallers={telecallers || []} telecallerStatus={telecallerStatus} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              {leads ? `Showing ${leads.length} Records` : `All Leads`}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeadsTable 
            leads={leads || []} 
            telecallers={telecallers || []} 
            telecallerStatus={telecallerStatus} 
          />
        </CardContent>
      </Card>
    </div>
  )
}
