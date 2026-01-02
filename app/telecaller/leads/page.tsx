import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Filter, BarChart3, TrendingUp, Clock, LogIn } from "lucide-react"
import { TelecallerLeadsTable } from "@/components/telecaller-leads-table"
import { TelecallerLeadFilters } from "@/components/telecaller-lead-filters"
import { PaginationControls } from "@/components/pagination-controls" // <--- IMPORT THIS
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface SearchParams {
  status?: string
  priority?: string
  search?: string
  source?: string
  date_range?: string
  page?: string
}

export default async function TelecallerLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // 1. Check Authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // 2. Pagination Logic
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // =========================================================
  // QUERY 1: FETCH STATS (Lightweight)
  // =========================================================
  const { data: statsData } = await supabase
    .from("leads")
    .select("status")
    .eq("assigned_to", user.id)

  const leadStats = {
    total: statsData?.length || 0,
    new: statsData?.filter(lead => ['New Lead', 'new'].includes(lead.status)).length || 0,
    contacted: statsData?.filter(lead => ['Contacted', 'contacted'].includes(lead.status)).length || 0,
    logins: statsData?.filter(lead => ['Login', 'Login Done', 'login'].includes(lead.status)).length || 0,
    converted: statsData?.filter(lead => ['Disbursed', 'converted'].includes(lead.status)).length || 0,
  }

  // =========================================================
  // QUERY 2: FETCH PAGINATED LEADS
  // =========================================================
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("assigned_to", user.id)
    .order("created_at", { ascending: false })
    .range(from, to)

  // Apply Filters
  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status)
  }
  if (searchParams.priority && searchParams.priority !== "all") {
    query = query.eq("priority", searchParams.priority)
  }
  if (searchParams.source) {
    query = query.eq("source", searchParams.source)
  }
  if (searchParams.search) {
    query = query.or(
      `name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`
    )
  }
  if (searchParams.date_range) {
    const today = new Date()
    let startDate = new Date()
    switch (searchParams.date_range) {
      case "today": startDate.setHours(0, 0, 0, 0); break
      case "week": startDate.setDate(today.getDate() - 7); break
      case "month": startDate.setDate(today.getDate() - 30); break
    }
    query = query.gte("created_at", startDate.toISOString())
  }

  const { data: leads, count } = await query

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-600 mt-1">Manage your assigned leads and track performance</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Performance
        </Button>
      </div>

      {/* Stats Cards ... (Keep existing code) ... */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* ... (Your existing stats cards here) ... */}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <div className="text-sm text-gray-500">
              Showing {leads?.length || 0} of {count} leads
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TelecallerLeadFilters />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Assigned Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TelecallerLeadsTable 
            leads={leads || []} 
            totalCount={count || 0}
            currentPage={page}
            pageSize={pageSize}
          />
          {/* Add Pagination Controls Here */}
          <div className="px-4 border-t">
            <PaginationControls 
              totalCount={count || 0}
              pageSize={pageSize}
              currentPage={page}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
