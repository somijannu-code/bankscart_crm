"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Phone, Clock, CheckCircle } from "lucide-react"

interface CallLog {
  call_status: string
  call_type: string
  duration_seconds: number | null
}

interface Lead {
  status: string
  created_at: string
}

interface AttendanceRecord {
  user_id: string
  check_in: string | null
}

interface Telecaller {
  id: string
  full_name: string
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
  totalCallDuration: number // New field for total call duration
  avgCallDuration: number // New field for average call duration
  callStatusBreakdown: { // New field for call status breakdown
    connected: number     // Calls with duration > 0
    notConnected: number  // Calls with duration = 0
    noAnswer: number      // Calls with no_answer status
    busy: number          // Calls with busy status
  }
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get telecallers to analyze
        let telecallers: Telecaller[] = []
        if (telecallerId) {
          const { data } = await supabase.from("users").select("id, full_name").eq("id", telecallerId).single()
          telecallers = data ? [data] : []
        } else {
          const { data } = await supabase
            .from("users")
            .select("id, full_name")
            .eq("role", "telecaller")
            .eq("is_active", true)
          telecallers = data || []
        }

        // Get telecaller status for today
        let telecallerStatus: Record<string, boolean> = {}
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: attendanceRecords } = await supabase
            .from("attendance")
            .select("user_id, check_in")
            .eq("date", today)
          
          if (attendanceRecords) {
            // Create a map of telecaller ID to checked-in status
            telecallerStatus = attendanceRecords.reduce((acc: Record<string, boolean>, record: AttendanceRecord) => {
              acc[record.user_id] = !!record.check_in
              return acc
            }, {} as Record<string, boolean>)
          }
        } catch (err) {
          console.error("Error fetching telecaller status:", err)
        }

        const performanceData: PerformanceData[] = []

        for (const telecaller of telecallers) {
          
          // --- FIX 1: Query for ALL-TIME Leads for Total Leads (NO date filter) ---
          const { data: allTimeLeads } = await supabase
            .from("leads")
            .select("id") // Select minimal data as we only need the count
            .eq("assigned_to", telecaller.id)
            
          // --- FIX 2: Query for PERIOD-SPECIFIC Leads for status breakdowns (WITH date filter) ---
          const { data: periodLeads } = await supabase
            .from("leads")
            .select("status, created_at")
            .eq("assigned_to", telecaller.id)
            .gte("created_at", startDate)
            .lte("created_at", `${endDate}T23:59:59`)

          // Get calls made by this telecaller
          const { data: calls } = await supabase
            .from("call_logs")
            .select("call_status, call_type, duration_seconds")
            .eq("user_id", telecaller.id)
            .gte("created_at", startDate)
            .lte("created_at", `${endDate}T23:59:59`)

          // --- FIX 3: Use allTimeLeads for Total Leads count ---
          const totalLeads = allTimeLeads?.length || 0
          const totalCalls = calls?.length || 0
          
          // Calculate total and average call duration
          const totalCallDuration = calls?.reduce((sum: number, call: CallLog) => sum + (call.duration_seconds || 0), 0) || 0
          const avgCallDuration = totalCalls > 0 ? totalCallDuration / totalCalls : 0
          
          // Break down calls by status
          // Connected calls are those with duration > 0
          const callStatusBreakdown = {
            connected: calls?.filter((call: CallLog) => (call.duration_seconds || 0) > 0).length || 0,
            notConnected: calls?.filter((call: CallLog) => (call.duration_seconds || 0) === 0).length || 0,
            noAnswer: calls?.filter((call: CallLog) => call.call_status === "nr").length || 0,
            busy: calls?.filter((call: CallLog) => call.call_status === "nr").length || 0
          }
          
          // Connected calls are those with duration > 0
          const connectedCalls = callStatusBreakdown.connected
          
          // --- FIX 4: Use periodLeads for date-filtered new leads ---
          const newLeads = periodLeads?.filter((lead: Lead) => 
            lead.status === "new" || 
            lead.status === "contacted" ||
            lead.status === "Interested"
          ).length || 0
          
          // --- FIX 5: Use periodLeads for date-filtered converted leads ---
          const convertedLeads = periodLeads?.filter((lead: Lead) => 
            lead.status === "closed_won" ||
            lead.status === "Disbursed" ||
            lead.status === "Login" ||
            lead.status === "Documents_Sent" ||
            lead.status === "qualified"
          ).length || 0

          performanceData.push({
            id: telecaller.id,
            name: telecaller.full_name,
            totalLeads,
            totalCalls,
            connectedCalls,
            connectRate: totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0,
            newLeads,
            convertedLeads,
            conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
            isCheckedIn: telecallerStatus[telecaller.id] || false,
            totalCallDuration,
            avgCallDuration,
            callStatusBreakdown
          })
        }

        // Sort by total calls descending
        performanceData.sort((a, b) => b.totalCalls - a.totalCalls)
        setData(performanceData)
      } catch (error) {
        console.error("Error fetching telecaller performance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, telecallerId, supabase])

  const getPerformanceBadge = (rate: number, type: "connect" | "conversion") => {
    const thresholds = type === "connect" ? [60, 40] : [15, 8] // Adjusted thresholds for more realistic goals

    if (rate >= thresholds[0]) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Excellent
        </Badge>
      )
    } else if (rate >= thresholds[1]) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Minus className="h-3 w-3" />
          Good
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          Needs Improvement
        </Badge>
      )
    }
  }

  // Format duration in seconds to HH:MM:SS format
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading performance data...</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
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
            <th className="text-left p-4 font-semibold">Connected Calls</th>
            <th className="text-left p-4 font-semibold">Connect Rate</th>
            <th className="text-left p-4 font-semibold">Conversions</th>
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
