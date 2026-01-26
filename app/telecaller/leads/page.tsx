import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Filter, TrendingUp, Clock, LogIn, CheckCircle2 } from "lucide-react"
import { TelecallerLeadsTable } from "@/components/telecaller-leads-table"
import { TelecallerLeadFilters } from "@/components/telecaller-lead-filters"
import { redirect } from "next/navigation"

// Define search params interface
interface SearchParams {
  status?: string
  priority?: string
  search?: string
  source?: string
  date_range?: string
  page?: string
  sort_by?: string    // Added for Server Sorting
  sort_order?: string // Added for Server Sorting
}

export default async function TelecallerLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // 1. Check Authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // 2. Pagination & Sort Logic
  const page = Number(searchParams.page) || 1
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = searchParams.sort_by || 'created_at'
  const sortOrder = searchParams.sort_order === 'asc'

  // =========================================================
  // QUERY 1: FETCH STATS (OPTIMIZED)
  // Run parallel COUNT queries instead of fetching data arrays
  // =========================================================
  const baseStatsQuery = supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id)

  const [
    { count: totalCount },
    { count: newCount },
    { count: contactedCount },
    { count: loginCount },
    { count: disbursedCount }
  ] = await Promise.all([
    baseStatsQuery, // Total
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['New Lead', 'new']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['Contacted', 'contacted']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['Login', 'Login Done', 'login']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['Disbursed', 'converted'])
  ])

  // =========================================================
  // QUERY 2: FETCH PAGINATED LEADS
  // =========================================================
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("assigned_to", user.id)
    .order(sortBy, { ascending: sortOrder }) // Server-side sorting
    .range(from, to)

  // Apply Filters
  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status)
  }
  if (searchParams.priority && searchParams.priority !== "all") {
    query = query.eq("priority", searchParams.priority)
  }
  if (searchParams.search) {
    query = query.or(`name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`)
  }

  // Execute Data Query
  const { data: leads, count } = await query

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-600 mt-1">Manage your assigned leads and track performance</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount || 0}</div>
            <p className="text-xs text-muted-foreground">Assigned to you</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New / Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newCount || 0}</div>
            <p className="text-xs text-muted-foreground">Requires action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logins</CardTitle>
            <LogIn className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loginCount || 0}</div>
            <p className="text-xs text-muted-foreground">Applications filed</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disbursed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disbursedCount || 0}</div>
            <p className="text-xs text-muted-foreground">Success</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
            <div className="text-xs text-muted-foreground bg-white px-2 py-1 rounded border">
              Showing {leads?.length || 0} of {count} results
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <TelecallerLeadFilters initialSearchParams={searchParams} />
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <TelecallerLeadsTable 
            leads={leads || []} 
            totalCount={count || 0}
            currentPage={page}
            pageSize={pageSize}
            sortBy={sortBy}
            sortOrder={searchParams.sort_order || 'desc'}
          />
        </CardContent>
      </Card>
    </div>
  )
}
