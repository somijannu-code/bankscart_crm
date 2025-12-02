import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Upload, UserPlus, Filter, Zap } from "lucide-react"
import Link from "next/link"
import { LeadsTable } from "@/components/leads-table"
import { LeadFilters } from "@/components/lead-filters"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SearchParams {
  status?: string
  priority?: string
  assigned_to?: string
  source?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: string
  view?: string // 'all', 'mine', 'unread'
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const page = parseInt(searchParams.page || "1")
  const limit = 50 // Standardize page size
  const offset = (page - 1) * limit

  // --- 1. SUPER QUERY CONSTRUCTION ---
  let query = supabase
    .from("leads")
    .select(`
      *,
      assigned_user:users!leads_assigned_to_fkey(id, full_name),
      call_logs(created_at)
    `, { count: 'exact' }) // Get count for pagination
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  // --- 2. APPLY FILTERS (Server Side) ---
  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq("status", searchParams.status)
  }
  if (searchParams.priority && searchParams.priority !== 'all') {
    query = query.eq("priority", searchParams.priority)
  }
  if (searchParams.assigned_to && searchParams.assigned_to !== 'all') {
    if (searchParams.assigned_to === 'unassigned') {
      query = query.is("assigned_to", null)
    } else {
      query = query.eq("assigned_to", searchParams.assigned_to)
    }
  }
  if (searchParams.source && searchParams.source !== 'all') {
    query = query.eq("source", searchParams.source)
  }
  // Date Range Filter
  if (searchParams.date_from) {
    query = query.gte("created_at", searchParams.date_from)
  }
  if (searchParams.date_to) {
    query = query.lte("created_at", `${searchParams.date_to}T23:59:59`)
  }
  // Smart Search (PostgreSQL ILIKE)
  if (searchParams.search) {
    const s = searchParams.search
    query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,company.ilike.%${s}%`)
  }

  // Smart View Tabs Logic
  if (searchParams.view === 'mine' && user) {
    query = query.eq("assigned_to", user.id)
  } else if (searchParams.view === 'today') {
    const today = new Date().toISOString().split('T')[0]
    query = query.eq("follow_up_date", today)
  }

  const { data: leads, count: totalCount } = await query

  // Fetch Telecallers for dropdowns
  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lead Command</h1>
          <p className="text-gray-500 mt-1">Manage, track, and convert your pipeline.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/leads/new">
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              <UserPlus className="h-4 w-4 mr-2" /> New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Smart View Tabs */}
      <div className="flex items-center space-x-4 border-b pb-1">
        <Link href="/admin/leads?view=all">
          <Button variant={!searchParams.view || searchParams.view === 'all' ? "secondary" : "ghost"}>All Leads</Button>
        </Link>
        <Link href="/admin/leads?view=mine">
          <Button variant={searchParams.view === 'mine' ? "secondary" : "ghost"}>My Leads</Button>
        </Link>
        <Link href="/admin/leads?view=today">
          <Button variant={searchParams.view === 'today' ? "secondary" : "ghost"} className="text-orange-600">
            <Zap className="h-3 w-3 mr-1 fill-orange-100" /> Follow Ups Today
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm border-none">
        <CardContent className="p-4">
          <LeadFilters telecallers={telecallers || []} />
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="bg-white border-b py-4">
          <div className="flex items-center justify-between">
             <CardTitle className="text-lg flex items-center gap-2">
               <FileSpreadsheet className="h-5 w-5 text-blue-600" />
               Lead Database 
               <span className="text-sm font-normal text-gray-500 ml-2">({totalCount} records)</span>
             </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LeadsTable 
            leads={leads || []} 
            telecallers={telecallers || []} 
            totalCount={totalCount || 0}
            currentPage={page}
            pageSize={limit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
