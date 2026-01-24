import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Calendar, TrendingUp, Users, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { ReportsFilters } from "@/components/reports-filters"
import { PerformanceChart } from "@/components/performance-chart"
import { LeadConversionChart } from "@/components/lead-conversion-chart"
import { TelecallerPerformance } from "@/components/telecaller-performance"
import { ExportButtons } from "@/components/export-buttons"
import Link from "next/link"
import { Suspense } from "react"

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

  // 1. Determine Date Ranges (Current vs Previous)
  const defaultEnd = new Date()
  const defaultStart = new Date()
  defaultStart.setDate(defaultEnd.getDate() - 30) // Default to last 30 days

  const startDate = searchParams.start_date || defaultStart.toISOString().split("T")[0]
  const endDate = searchParams.end_date || defaultEnd.toISOString().split("T")[0]

  // Calculate Previous Period for Comparison
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - diffDays + 1)

  const prevStartDate = prevStart.toISOString().split("T")[0]
  const prevEndDate = prevEnd.toISOString().split("T")[0]

  // 2. Role-Based Security (Auto-filter for Telecallers)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', user?.id).single()
  
  let filterId = searchParams.telecaller
  if (userProfile?.role === 'telecaller') {
    filterId = user!.id // Force filter to self
  }

  // 3. Fetch Telecallers List (Only for Admins)
  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  // 4. OPTIMIZED DATA FETCHING (Parallel Count Queries)
  // We use a helper to avoid repeating query logic
  const fetchCounts = async (start: string, end: string) => {
    const buildQuery = (table: string, statusCol?: string, statusVal?: string) => {
      let q = supabase
        .from(table)
        .select('*', { count: 'exact', head: true }) // head:true = NO DATA DOWNLOAD
        .gte('created_at', start)
        .lte('created_at', `${end}T23:59:59`)
      
      if (filterId) {
        const col = table === 'leads' ? 'assigned_to' : 'user_id'
        if (filterId.includes(',')) q = q.in(col, filterId.split(','))
        else q = q.eq(col, filterId)
      }
      if (statusCol && statusVal) q = q.eq(statusCol, statusVal)
      return q
    }

    const [
      { count: totalLeads },
      { count: newLeads },
      { count: converted },
      { count: totalCalls },
      { count: connectedCalls }
    ] = await Promise.all([
      buildQuery('leads'),
      buildQuery('leads', 'status', 'new'),
      buildQuery('leads', 'status', 'closed_won'), // Ensure this matches your DB status string
      buildQuery('call_logs'),
      buildQuery('call_logs', 'call_status', 'connected')
    ])

    return {
      leads: totalLeads || 0,
      new: newLeads || 0,
      converted: converted || 0,
      calls: totalCalls || 0,
      connected: connectedCalls || 0
    }
  }

  // Execute Current and Previous Fetches in Parallel
  const [current, previous] = await Promise.all([
    fetchCounts(startDate, endDate),
    fetchCounts(prevStartDate, prevEndDate)
  ])

  // 5. Calculate Metrics & Trends
  const calculateTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const currentConvRate = current.leads > 0 ? (current.converted / current.leads) * 100 : 0
  const prevConvRate = previous.leads > 0 ? (previous.converted / previous.leads) * 100 : 0
  
  const currentConnectRate = current.calls > 0 ? (current.connected / current.calls) * 100 : 0
  const prevConnectRate = previous.calls > 0 ? (previous.connected / previous.calls) * 100 : 0

  const stats = [
    {
      title: "Total Leads",
      value: current.leads,
      trend: calculateTrend(current.leads, previous.leads),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "New Leads",
      value: current.new,
      trend: calculateTrend(current.new, previous.new),
      icon: BarChart3,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Conversion Rate",
      value: `${currentConvRate.toFixed(1)}%`,
      trend: Math.round(currentConvRate - prevConvRate), // Difference points for %, not % change
      isPercentage: true,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Call Connect Rate",
      value: `${currentConnectRate.toFixed(1)}%`,
      trend: Math.round(currentConnectRate - prevConnectRate),
      isPercentage: true,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ]

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Performance from <span className="font-mono font-medium text-gray-700">{startDate}</span> to <span className="font-mono font-medium text-gray-700">{endDate}</span>
          </p>
        </div>
        <ExportButtons startDate={startDate} endDate={endDate} telecallerId={filterId} />
      </div>

      {/* Filters (Hidden for Telecallers) */}
      {userProfile?.role !== 'telecaller' && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <ReportsFilters telecallers={telecallers || []} defaultStartDate={startDate} defaultEndDate={endDate} />
          </CardContent>
        </Card>
      )}

      {/* KPI Cards with Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const isPositive = stat.trend >= 0
          return (
            <Card key={index} className="hover:shadow-md transition-shadow border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    
                    {/* Trend Indicator */}
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      <span>
                        {isPositive ? '+' : ''}{stat.trend}{stat.isPercentage ? '%' : '%'} 
                      </span>
                      <span className="text-gray-400 font-normal ml-1">vs prev period</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts with Suspense for faster initial load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Daily Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md" />}>
              <PerformanceChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Lead Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md" />}>
              <LeadConversionChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Table */}
      <Card className="shadow-sm border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-indigo-500" />
            Agent Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md" />}>
            <TelecallerPerformance startDate={startDate} endDate={endDate} telecallerId={filterId} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Helper Card */}
      <div className="flex justify-center pb-8">
        <Link href="/admin/reports/attendance" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          View Detailed Attendance Report <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
