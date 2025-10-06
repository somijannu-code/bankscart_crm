import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Filter, Download, BarChart3 } from "lucide-react"
import { TelecallerLeadsTable } from "@/components/telecaller-leads-table"
import { TelecallerLeadFilters } from "@/components/telecaller-lead-filters"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LeadStatsCards } from "@/components/lead-stats-cards"
import { ExportLeadsButton } from "@/components/export-leads-button"

interface SearchParams {
  status?: string
  priority?: string
  search?: string
  source?: string
  date_range?: string
}

export default async function TelecallerLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Build query with filters for telecaller's assigned leads
  let query = supabase
    .from("leads")
    .select("*")
    .eq("assigned_to", user.id)
    .order("created_at", { ascending: false })

  // Apply filters
  if (searchParams.status) {
    query = query.eq("status", searchParams.status)
  }
  if (searchParams.priority) {
    query = query.eq("priority", searchParams.priority)
  }
  if (searchParams.source) {
    query = query.eq("source", searchParams.source)
  }
  if (searchParams.search) {
    query = query.or(
      `name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`,
    )
  }

  // Date range filter (example implementation)
  if (searchParams.date_range) {
    const today = new Date()
    let startDate = new Date()
    
    switch (searchParams.date_range) {
      case "today":
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate.setDate(today.getDate() - 7)
        break
      case "month":
        startDate.setDate(today.getDate() - 30)
        break
    }
    
    query = query.gte("created_at", startDate.toISOString())
  }

  const { data: leads } = await query

  // Calculate lead statistics
  const leadStats = {
    total: leads?.length || 0,
    new: leads?.filter(lead => lead.status === 'new').length || 0,
    contacted: leads?.filter(lead => lead.status === 'contacted').length || 0,
    qualified: leads?.filter(lead => lead.status === 'qualified').length || 0,
    converted: leads?.filter(lead => lead.status === 'converted').length || 0,
    highPriority: leads?.filter(lead => lead.priority === 'high').length || 0,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-600 mt-1">Manage your assigned leads and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportLeadsButton leads={leads || []} />
          <Button variant="outline" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </Button>
        </div>
      </div>

      {/* Lead Statistics Dashboard */}
      <LeadStatsCards stats={leadStats} />

      {/* Enhanced Filters Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
            <div className="text-sm text-gray-500">
              {leads?.length} leads found
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TelecallerLeadFilters initialSearchParams={searchParams} />
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Assigned Leads
            <span className="text-lg font-normal text-gray-500">
              ({leads?.length || 0})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TelecallerLeadsTable leads={leads || []} />
        </CardContent>
      </Card>
    </div>
  )
}
