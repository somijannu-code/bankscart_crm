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
  totalCallDuration: number
  avgCallDuration: number
  callStatusBreakdown: {
    connected: number
    notConnected: number
    noAnswer: number
    busy: number
    failed: number // Added 'failed' status for robustness
  }
}

interface TelecallerPerformanceProps {
  startDate: string
  endDate: string
  telecallerId?: string // This can now be a single ID or a comma-separated string of IDs
}

// Function to calculate and aggregate all data
const calculateAggregates = (data: PerformanceData[]): PerformanceData | null => {
  if (data.length === 0) return null

  const totalLeads = data.reduce((sum, p) => sum + p.totalLeads, 0)
  const totalCalls = data.reduce((sum, p) => sum + p.totalCalls, 0)
  const connectedCalls = data.reduce((sum, p) => sum + p.connectedCalls, 0)
  const newLeads = data.reduce((sum, p) => sum + p.newLeads, 0)
  const convertedLeads = data.reduce((sum, p) => sum + p.convertedLeads, 0)
  const totalCallDuration = data.reduce((sum, p) => sum + p.totalCallDuration, 0)
  
  const totalConnected = data.reduce((sum, p) => sum + p.callStatusBreakdown.connected, 0)
  const totalNotConnected = data.reduce((sum, p) => sum + p.callStatusBreakdown.notConnected, 0)
  const totalNoAnswer = data.reduce((sum, p) => sum + p.callStatusBreakdown.noAnswer, 0)
  const totalBusy = data.reduce((sum, p) => sum + p.callStatusBreakdown.busy, 0)
  const totalFailed = data.reduce((sum, p) => sum + p.callStatusBreakdown.failed, 0)

  return {
    id: "AGGREGATE",
    name: "Overall Team Performance",
    totalLeads,
    totalCalls,
    connectedCalls,
    connectRate: totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0,
    newLeads,
    convertedLeads,
    conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
    isCheckedIn: true, // N/A for aggregate
    totalCallDuration,
    avgCallDuration: totalCalls > 0 ? totalCallDuration / totalCalls : 0,
    callStatusBreakdown: {
      connected: totalConnected,
      notConnected: totalNotConnected,
      noAnswer: totalNoAnswer,
      busy: totalBusy,
      failed: totalFailed
    }
  }
}


export function TelecallerPerformance({ startDate, endDate, telecallerId }: TelecallerPerformanceProps) {
  const [data, setData] = useState<PerformanceData[]>([])
  const [aggregateData, setAggregateData] = useState<PerformanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        
        // 1. IMPROVEMENT: Handle multi-telecaller IDs
        let telecallerIds: string[] = []
        if (telecallerId) {
            telecallerIds = telecallerId.split(',').filter(id => id.trim() !== '')
        }

        // Fetch list of telecallers to analyze
        let telecallers: Telecaller[] = []
        if (telecallerIds.length > 0) {
          const { data } = await supabase.from("users").select("id, full_name").in("id", telecallerIds)
          telecallers = data || []
        } else {
          // If no filter or empty filter, get all active telecallers
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
          // Get leads assigned to this telecaller
          const { data: leads } = await supabase
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

          const totalLeads = leads?.length || 0
          const totalCalls = calls?.length || 0
          
          // Calculate total and average call duration
          const totalCallDuration = calls?.reduce((sum: number, call: CallLog) => sum + (call.duration_seconds || 0), 0) || 0
          
          // 2. IMPROVEMENT: Fixed calculation and richer breakdown
          const callStatusBreakdown = {
            // "Connected" based on duration > 0
            connected: calls?.filter((call: CallLog) => (call.duration_seconds || 0) > 0).length || 0, 
            // "Not Connected" based on duration = 0 (assuming call was attempted but not picked up/etc.)
            notConnected: calls?.filter((call: CallLog) => (call.duration_seconds || 0) === 0 && call.call_status !== "nr" && call.call_status !== "busy" && call.call_status !== "failed").length || 0,
            noAnswer: calls?.filter((call: CallLog) => call.call_status === "nr").length || 0,
            busy: calls?.filter((call: CallLog) => call.call_status === "busy").length || 0,
            failed: calls?.filter((call: CallLog) => call.call_status === "failed").length || 0
          }
          
          const connectedCalls = callStatusBreakdown.connected
          const avgCallDuration = totalCalls > 0 ? totalCallDuration / totalCalls : 0
          
          // Updated new leads statuses
          const newLeads = leads?.filter((lead: Lead) => 
            lead.status === "new" || 
            lead.status === "contacted" ||
            lead.status === "Interested"
          ).length || 0
          
          // Updated converted leads statuses
          const convertedLeads = leads?.filter((lead: Lead) => 
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
            conversionRate: totalLeads > 0 ? (convertedLeeds / totalLeads) * 100 : 0,
            isCheckedIn: telecallerStatus[telecaller.id] || false,
            totalCallDuration,
            avgCallDuration,
            callStatusBreakdown
          })
        }

        // Sort by total calls descending
        performanceData.sort((a, b) => b.totalCalls - a.totalCalls)
        setData(performanceData)
        setAggregateData(calculateAggregates(performanceData))
      } catch (error) {
        console.error("Error fetching telecaller performance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, telecallerId, supabase])

  const getPerformanceBadge = (rate: number, type: "connect" | "conversion") => {
    const thresholds = type === "connect" ? [60, 40] : [15, 8] // Use existing thresholds

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
    // Handle potential NaN from division if totalCalls is 0
    if (isNaN(seconds) || seconds < 0) return "00:00:00" 
    
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading performance data...</div>
  }
  
  const allData = aggregateData ? [...data, aggregateData] : data;

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
          {allData.map((telecaller) => {
            const isAggregate = telecaller.id === "AGGREGATE"
            const rowClass = isAggregate ? "border-b-2 border-t-4 border-blue-600 bg-blue-50/50 hover:bg-blue-100" : "border-b hover:bg-gray-50"
            const nameClass = isAggregate ? "font-extrabold text-blue-700" : "font-medium"
            
            return (
              <tr key={telecaller.id} className={rowClass}>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {!isAggregate && (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {telecaller.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className={nameClass}>{telecaller.name}</span>
                  </div>
                </td>
                <td className="p-4">
                  {!isAggregate && (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${telecaller.isCheckedIn ? 'bg-green-500' : 'bg-red-500'}`} 
                           title={telecaller.isCheckedIn ? 'Checked in' : 'Not checked in'} />
                      <span className="text-sm">
                        {telecaller.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                      </span>
                    </div>
                  )}
                  {isAggregate && <span className="text-gray-500">N/A</span>}
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
                      <span>Connected: {telecaller.callStatusBreakdown.connected}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-red-500">Not Conn.: {telecaller.callStatusBreakdown.notConnected}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">No Answer: {telecaller.callStatusBreakdown.noAnswer}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-orange-500">Busy: {telecaller.callStatusBreakdown.busy}</span>
                    </div>
                    {/* New 'Failed' status visibility */}
                    {telecaller.callStatusBreakdown.failed > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Failed: {telecaller.callStatusBreakdown.failed}</span>
                      </div>
                    )}
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
            )
          })}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="text-center py-8 text-gray-500">No performance data available for the selected period.</div>
      )}
    </div>
  )
}
