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

  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  // Handle filters
  let telecallerIds: string[] = []
  if (searchParams.telecaller) {
    telecallerIds = searchParams.telecaller.split(',')
  }

  // --- OPTIMIZATION START: Use COUNT only queries ---

  // 1. Total Leads All Time (Just count)
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })

  // 2. Base Period Queries
  let leadsQuery = supabase.from("leads").select("status", { count: "exact" }) // Select minimal fields
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)

  let callsQuery = supabase.from("call_logs").select("call_status", { count: "exact" })
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)

  if (telecallerIds.length > 0) {
    leadsQuery = leadsQuery.in("assigned_to", telecallerIds)
    callsQuery = callsQuery.in("user_id", telecallerIds)
  }

  // Execute Queries
  const [{ data: leadsData }, { data: callsData }] = await Promise.all([
    leadsQuery,
    callsQuery
  ])

  // Process counts in memory (but now on much smaller/lighter objects)
  const periodLeadsCount = leadsData?.length || 0
  const periodCallsCount = callsData?.length || 0

  const newLeads = leadsData?.filter((lead) => lead.status === "new").length || 0
  const convertedLeads = leadsData?.filter((lead) => lead.status === "closed_won").length || 0
  const conversionRate = periodLeadsCount ? ((convertedLeads / periodLeadsCount) * 100).toFixed(1) : "0"

  const connectedCalls = callsData?.filter((call) => call.call_status === "connected").length || 0
  const callConnectRate = periodCallsCount ? ((connectedCalls / periodCallsCount) * 100).toFixed(1) : "0"

  // --- OPTIMIZATION END ---

  const stats = [
    {
      title: "Total Leads",
      value: periodLeadsCount, // Shows period count as main value
      subtitle: `${totalLeads} all time`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "New Leads",
      value: newLeads,
      subtitle: "In selected period",
      icon: BarChart3,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      subtitle: `${convertedLeads} converted`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Call Connect Rate",
      value: `${callConnectRate}%`,
      subtitle: `${connectedCalls}/${periodCallsCount} calls`,
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
