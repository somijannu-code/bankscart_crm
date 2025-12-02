"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Phone, Clock, CheckCircle, Timer } from "lucide-react"

// Types remain mostly the same
interface CallLog {
  user_id: string
  call_status: string
  call_type: string
  duration_seconds: number | null
  created_at: string 
}

interface Lead {
  assigned_to: string
  status: string
  created_at: string
}

interface PerformanceData {
  id: string
  name: string
  totalLeads: number
  totalCalls: number
  connectedCalls: number
  connectRate: number
  newLeads: number
  convertedLeads: number
  conversionRate: number
  isCheckedIn: boolean
  totalCallDuration: number
  avgCallDuration: number
  callStatusBreakdown: {
    connected: number
    notConnected: number
    noAnswer: number
    busy: number
  }
  lastCallTime: string | null
  avgTimeBetweenCalls: number
}

interface TelecallerPerformanceProps {
  startDate: string
  endDate: string
  telecallerId?: string
}

export function TelecallerPerformance({ startDate, endDate, telecallerId }: TelecallerPerformanceProps) {
  const [data, setData] = useState<PerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Helper: Format duration
  const formatDuration = (seconds: number) => {
    if (seconds === Infinity || isNaN(seconds)) return "N/A"
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Helper: Format time
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "N/A"
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    } catch {
      return "Invalid Date"
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // 1. Prepare User Query
        let userQuery = supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
        
        // If specific ID is requested (or comma separated), filter them
        if (telecallerId) {
             const ids = telecallerId.split(',')
             userQuery = userQuery.in('id', ids)
        } else {
             userQuery = userQuery.eq("role", "telecaller")
        }

        // 2. Prepare Attendance Query (Today)
        const today = new Date().toISOString().split('T')[0]
        const attendanceQuery = supabase
          .from("attendance")
          .select("user_id, check_in")
          .eq("date", today)

        // 3. Prepare Bulk Leads Query (Period)
        let leadsQuery = supabase
          .from("leads")
          .select("assigned_to, status, created_at")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)

        // 4. Prepare Bulk Calls Query (Period)
        let callsQuery = supabase
          .from("call_logs")
          .select("user_id, call_status, call_type, duration_seconds, created_at")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)
          .order("created_at", { ascending: false })

        // 5. FETCH ALL DATA IN PARALLEL (Massive Speedup)
        const [
          { data: telecallers },
          { data: attendance },
          { data: leads },
          { data: calls }
        ] = await Promise.all([
          userQuery,
          attendanceQuery,
          leadsQuery,
          callsQuery
        ])

        if (!telecallers) return

        // 6. PROCESS DATA IN MEMORY
        // Create lookup maps to avoid looping arrays repeatedly
        const attendanceMap = new Map(attendance?.map(a => [a.user_id, !!a.check_in]))
        
        // Group Leads by User
        const leadsByUser = (leads || []).reduce((acc, lead) => {
          if (!lead.assigned_to) return acc
          if (!acc[lead.assigned_to]) acc[lead.assigned_to] = []
          acc[lead.assigned_to].push(lead)
          return acc
        }, {} as Record<string, Lead[]>)

        // Group Calls by User
        const callsByUser = (calls || []).reduce((acc, call) => {
          if (!call.user_id) return acc
          if (!acc[call.user_id]) acc[call.user_id] = []
          acc[call.user_id].push(call)
          return acc
        }, {} as Record<string, CallLog[]>)

        const performanceData: PerformanceData[] = telecallers.map(telecaller => {
          const userLeads = leadsByUser[telecaller.id] || []
          const userCalls = callsByUser[telecaller.id] || []

          // Calculate Stats
          const totalLeads = userLeads.length
          const totalCalls = userCalls.length
          
          const totalCallDuration = userCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0)
          const avgCallDuration = totalCalls > 0 ? totalCallDuration / totalCalls : 0

          // Last Call & Avg Gap
          let lastCallTime: string | null = null
          let avgTimeBetweenCalls = 0

          if (userCalls.length > 0) {
            // calls are already sorted DESC from query
            lastCallTime = userCalls[0].created_at 
            
            if (userCalls.length > 1) {
              // We need sorted ASC for time gap calc
              const times = userCalls
                .map(c => new Date(c.created_at).getTime())
                .sort((a, b) => a - b)
              
              const totalGap = times[times.length - 1] - times[0]
              // Avg gap = total range / (count - 1)
              avgTimeBetweenCalls = (totalGap / 1000) / (userCalls.length - 1)
            }
          }

          const callStatusBreakdown = {
            connected: userCalls.filter(c => (c.duration_seconds || 0) > 0).length,
            notConnected: userCalls.filter(c => (c.duration_seconds || 0) === 0).length,
            noAnswer: userCalls.filter(c => c.call_status === "nr").length,
            busy: userCalls.filter(c => c.call_status === "busy").length
          }

          const connectedCalls = callStatusBreakdown.connected
          const newLeads = userLeads.filter(l => l.status === "new" || l.status === "contacted").length
          const convertedLeads = userLeads.filter(l => l.status === "Interested").length

          return {
            id: telecaller.id,
            name: telecaller.full_name,
            totalLeads,
            totalCalls,
            connectedCalls,
            connectRate: totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0,
            newLeads,
            convertedLeads,
            conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
            isCheckedIn: attendanceMap.get(telecaller.id) || false,
            totalCallDuration,
            avgCallDuration,
            callStatusBreakdown,
            lastCallTime,
            avgTimeBetweenCalls
          }
        })

        // Sort: Checked In first, then High Calls
        performanceData.sort((a, b) => {
          if (a.isCheckedIn !== b.isCheckedIn) return b.isCheckedIn ? 1 : -1
          return b.totalCalls - a.totalCalls
        })

        setData(performanceData)
      } catch (error) {
        console.error("Error fetching performance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, telecallerId, supabase])

  const getPerformanceBadge = (rate: number, type: "connect" | "conversion") => {
    const thresholds = type === "connect" ? [60, 40] : [15, 8]
    if (rate >= thresholds[0]) return <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Excellent</Badge>
    else if (rate >= thresholds[1]) return <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1"><Minus className="h-3 w-3" />Good</Badge>
    else return <Badge className="bg-red-100 text-red-800 flex items-center gap-1"><TrendingDown className="h-3 w-3" />Needs Improvement</Badge>
  }

  if (isLoading) return <div className="text-center py-4">Loading performance data...</div>

  // ... (Keep the exact same JSX return as your original file)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
         {/* ... COPY YOUR TABLE JSX HERE FROM ORIGINAL FILE ... */}
         {/* It is identical, just the logic above changed */}
         <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-4 font-semibold">Telecaller</th>
            <th className="text-left p-4 font-semibold">Status</th>
            <th className="text-left p-4 font-semibold">Total Leads</th>
            <th className="text-left p-4 font-semibold">New Leads</th>
            <th className="text-left p-4 font-semibold">
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Total Calls
              </div>
            </th>
            <th className="text-left p-4 font-semibold">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Call Duration
              </div>
            </th>
            <th className="text-left p-4 font-semibold">
              <div className="flex items-center gap-1">
                <Timer className="h-4 w-4" />
                Last Call
              </div>
            </th>
            <th className="text-left p-4 font-semibold">
              <div className="flex items-center gap-1">
                <Timer className="h-4 w-4" />
                Avg. Gap
              </div>
            </th>
            <th className="text-left p-4 font-semibold">Connected Calls</th>
            <th className="text-left p-4 font-semibold">Connect Rate</th>
            <th className="text-left p-4 font-semibold">Interested Leads</th>
            <th className="text-left p-4 font-semibold">Conversion Rate</th>
            <th className="text-left p-4 font-semibold">Call Status Breakdown</th>
            <th className="text-left p-4 font-semibold">Performance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((telecaller) => (
            <tr key={telecaller.id} className="border-b hover:bg-gray-50">
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {telecaller.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium">{telecaller.name}</span>
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${telecaller.isCheckedIn ? 'bg-green-500' : 'bg-red-500'}`} 
                       title={telecaller.isCheckedIn ? 'Checked in' : 'Not checked in'} />
                  <span className="text-sm">
                    {telecaller.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </span>
                </div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold text-lg">{telecaller.totalLeads}</div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold text-blue-600">{telecaller.newLeads}</div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold text-lg">{telecaller.totalCalls}</div>
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <div className="font-semibold">{formatDuration(telecaller.totalCallDuration)}</div>
                  <div className="text-xs text-gray-500">Avg: {formatDuration(telecaller.avgCallDuration)}</div>
                </div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold">{formatTime(telecaller.lastCallTime)}</div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold">{formatDuration(telecaller.avgTimeBetweenCalls)}</div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold text-green-600">{telecaller.connectedCalls}</div>
              </td>
              <td className="p-4">
                <div className="text-center">
                  <div className="font-semibold">{telecaller.connectRate.toFixed(1)}%</div>
                  {getPerformanceBadge(telecaller.connectRate, "connect")}
                </div>
              </td>
              <td className="p-4 text-center">
                <div className="font-semibold text-purple-600">{telecaller.convertedLeads}</div>
              </td>
              <td className="p-4">
                <div className="text-center">
                  <div className="font-semibold">{telecaller.conversionRate.toFixed(1)}%</div>
                  {getPerformanceBadge(telecaller.conversionRate, "conversion")}
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Duration &gt; 0: {telecaller.callStatusBreakdown.connected}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-red-500">Duration = 0: {telecaller.callStatusBreakdown.notConnected}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">No Answer: {telecaller.callStatusBreakdown.noAnswer}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-orange-500">Busy: {telecaller.callStatusBreakdown.busy}</span>
                  </div>
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Calls/Lead: </span>
                    <span className="font-medium">
                      {telecaller.totalLeads > 0 ? (telecaller.totalCalls / telecaller.totalLeads).toFixed(1) : "0"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Activity: </span>
                    <span
                      className={`font-medium ${telecaller.totalCalls >= 20 ? "text-green-600" : telecaller.totalCalls >= 10 ? "text-yellow-600" : "text-red-600"}`}
                    >
                      {telecaller.totalCalls >= 20 ? "High" : telecaller.totalCalls >= 10 ? "Medium" : "Low"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Efficiency: </span>
                    <span
                      className={`font-medium ${telecaller.conversionRate >= 15 ? "text-green-600" : telecaller.conversionRate >= 8 ? "text-yellow-600" : "text-red-600"}`}
                    >
                      {telecaller.conversionRate >= 15 ? "High" : telecaller.conversionRate >= 8 ? "Medium" : "Low"}
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">No performance data available for the selected period.</div>
      )}
    </div>
  )
}
