import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Calendar, TrendingUp, Users } from "lucide-react"
import { ReportsFilters } from "@/components/reports-filters"
import { PerformanceChart } from "@/components/performance-chart"
import { LeadConversionChart } from "@/components/lead-conversion-chart"
import { TelecallerPerformance } from "@/components/telecaller-performance"
import { ExportButtons } from "@/components/export-buttons"
import Link from "next/link"

interface SearchParams {
  start_date?: string
  end_date?: string
  telecaller?: string 
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  const defaultDate = new Date().toISOString().split("T")[0]
  const endDate = searchParams.end_date || defaultDate
  const startDate = searchParams.start_date || defaultDate

  // Fetch Telecallers for Filter
  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  const telecallerId = searchParams.telecaller

  // --- OPTIMIZATION: COUNT-ONLY QUERIES ---
  
  // 1. Total Leads All Time
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })

  // 2. Helper to build period queries
  const buildCountQuery = (table: string, filterField?: string, filterValue?: string) => {
    let q = supabase
      .from(table)
      .select("*", { count: "exact", head: true }) // head: true returns count without rows
      .gte("created_at", startDate)
      .lte("created_at", `${endDate}T23:59:59`)
    
    if (telecallerId) {
      // Handle comma-separated IDs if needed, or single ID
      if (telecallerId.includes(',')) {
         const col = table === 'leads' ? 'assigned_to' : 'user_id'
         q = q.in(col, telecallerId.split(','))
      } else {
         const col = table === 'leads' ? 'assigned_to' : 'user_id'
         q = q.eq(col, telecallerId)
      }
    }
    
    if (filterField && filterValue) {
      q = q.eq(filterField, filterValue)
    }
    return q
  }

  // 3. Execute all KPI counts in parallel
  const [
    { count: periodLeadsCount },
    { count: newLeadsCount },
    { count: convertedLeadsCount },
    { count: periodCallsCount },
    { count: connectedCallsCount }
  ] = await Promise.all([
    buildCountQuery("leads"),
    buildCountQuery("leads", "status", "new"), // Adjust "new" if your status ID differs
    buildCountQuery("leads", "status", "closed_won"), // Adjust "closed_won" to your conversion status
    buildCountQuery("call_logs"),
    buildCountQuery("call_logs", "call_status", "connected")
  ])

  // Safe Math for Rates
  const safeLeads = periodLeadsCount || 0
  const safeCalls = periodCallsCount || 0
  
  const conversionRate = safeLeads > 0 
    ? (((convertedLeadsCount || 0) / safeLeads) * 100).toFixed(1) 
    : "0"
    
  const callConnectRate = safeCalls > 0 
    ? (((connectedCallsCount || 0) / safeCalls) * 100).toFixed(1) 
    : "0"

  const stats = [
    {
      title: "Total Leads",
      value: safeLeads,
      subtitle: `${totalLeads} all time`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "New Leads",
      value: newLeadsCount || 0,
      subtitle: "In selected period",
      icon: BarChart3,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      subtitle: `${convertedLeadsCount || 0} converted`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Call Connect Rate",
      value: `${callConnectRate}%`,
      subtitle: `${connectedCallsCount || 0}/${safeCalls} calls`,
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Performance insights and data export</p>
        </div>
        <ExportButtons startDate={startDate} endDate={endDate} telecallerId={searchParams.telecaller} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReportsFilters telecallers={telecallers || []} defaultStartDate={startDate} defaultEndDate={endDate} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart startDate={startDate} endDate={endDate} telecallerId={searchParams.telecaller} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Lead Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadConversionChart startDate={startDate} endDate={endDate} telecallerId={searchParams.telecaller} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Telecaller Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TelecallerPerformance startDate={startDate} endDate={endDate} telecallerId={searchParams.telecaller} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Attendance Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">View detailed attendance reports and analytics</p>
            <Link href="/admin/reports/attendance">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                View Attendance Reports
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
