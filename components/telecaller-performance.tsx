"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation" 
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Phone, Clock, CheckCircle, Timer, Users } from "lucide-react"

// --- INTERFACE DEFINITIONS (Keeping them as they were) ---

interface CallLog {
  telecaller_id: string; // Adjusted to be explicit about filtering
  call_status: string
  call_type: string
  duration_seconds: number | null
  created_at: string 
}

interface Lead {
  assigned_to_id: string; // Adjusted to be explicit about filtering
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
  convertedLeads: number // Interested Leads count
  conversionRate: number // Interested Leads rate
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
}

interface Telecaller {
  id: string
  full_name: string
}

// --- MAIN COMPONENT ---

export function TelecallerPerformanceReport({ telecallers }: { telecallers: Telecaller[] }) {
  const searchParams = useSearchParams()
  const supabase = createClient()

  // State
  const [data, setData] = useState<PerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get date range from search params or use defaults
  const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]

  // Get telecaller IDs from search params
  const telecallerParam = searchParams.get('telecaller')
  
  // CRITICAL FIX: Split the comma-separated string into an array of IDs
  const selectedTelecallerIds = useMemo(() => {
    if (!telecallerParam) return [];
    return telecallerParam.split(',').filter(id => id.trim());
  }, [telecallerParam]);

  // Determine the list of telecallers to process (either selected or all)
  const telecallersToProcess = useMemo(() => {
    if (selectedTelecallerIds.length === 0) {
      // If no selection (URL param is missing/empty), process all telecallers passed via props
      return telecallers;
    }
    // Filter the telecallers prop to only include the selected ones
    return telecallers.filter(tc => selectedTelecallerIds.includes(tc.id));
  }, [telecallers, selectedTelecallerIds]);


  const fetchPerformanceData = async () => {
    setIsLoading(true)
    setError(null)
    
    // Check if we have telecallers to process
    if (telecallersToProcess.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
    }

    try {
      // 1. Prepare base queries
      let callLogQuery = supabase
        .from("call_logs")
        .select("telecaller_id, call_status, duration_seconds, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate + 'T23:59:59.999Z'); // Ensure end of day is included

      let leadsQuery = supabase
        .from("leads")
        .select("assigned_to_id, status, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate + 'T23:59:59.999Z');
        
      // 2. APPLY THE MULTI-SELECT FILTER (CRITICAL FIX)
      // Only apply the 'in' filter if specific telecallers are selected
      if (selectedTelecallerIds.length > 0) {
          // Use .in() for filtering call logs by multiple telecaller IDs
          callLogQuery = callLogQuery.in('telecaller_id', selectedTelecallerIds);
          
          // Use .in() for filtering leads by multiple assigned IDs
          leadsQuery = leadsQuery.in('assigned_to_id', selectedTelecallerIds); 
      }
      
      const [callLogsResponse, leadsResponse] = await Promise.all([
        callLogQuery,
        leadsQuery,
      ]);

      if (callLogsResponse.error) throw callLogsResponse.error;
      if (leadsResponse.error) throw leadsResponse.error;

      const callLogs = callLogsResponse.data as CallLog[];
      const leads = leadsResponse.data as Lead[];

      // 3. Process data per telecaller
      const performanceMap = new Map<string, PerformanceData>();
      
      // Initialize map with all telecallers to process
      telecallersToProcess.forEach(tc => {
        performanceMap.set(tc.id, {
          id: tc.id,
          name: tc.full_name,
          totalLeads: 0,
          totalCalls: 0,
          connectedCalls: 0,
          connectRate: 0,
          newLeads: 0,
          convertedLeads: 0,
          conversionRate: 0,
          isCheckedIn: false, // Attendance logic remains separate/omitted here
          totalCallDuration: 0,
          avgCallDuration: 0,
          callStatusBreakdown: { connected: 0, notConnected: 0, noAnswer: 0, busy: 0 },
          lastCallTime: null,
        });
      });

      // Aggregate Leads
      leads.forEach(lead => {
        const entry = performanceMap.get(lead.assigned_to_id);
        if (entry) {
          entry.totalLeads += 1;
          if (lead.status === 'New') {
            entry.newLeads += 1;
          }
          if (lead.status === 'Interested') { // Assuming 'Interested' is the 'converted' status
            entry.convertedLeads += 1;
          }
        }
      });

      // Aggregate Call Logs
      callLogs.forEach(log => {
        const entry = performanceMap.get(log.telecaller_id);
        if (entry) {
          entry.totalCalls += 1;

          if (log.duration_seconds && log.duration_seconds > 0) {
            entry.connectedCalls += 1;
            entry.totalCallDuration += log.duration_seconds;
            entry.callStatusBreakdown.connected += 1;
          } else {
            entry.callStatusBreakdown.notConnected += 1;
            if (log.call_status === 'no_answer') {
              entry.callStatusBreakdown.noAnswer += 1;
            } else if (log.call_status === 'busy') {
              entry.callStatusBreakdown.busy += 1;
            }
          }

          // Update last call time
          if (!entry.lastCallTime || log.created_at > entry.lastCallTime) {
            entry.lastCallTime = log.created_at;
          }
        }
      });

      // Calculate rates and averages
      const finalData: PerformanceData[] = Array.from(performanceMap.values()).map(tc => {
        tc.connectRate = tc.totalCalls > 0 ? (tc.connectedCalls / tc.totalCalls) * 100 : 0;
        tc.conversionRate = tc.totalLeads > 0 ? (tc.convertedLeads / tc.totalLeads) * 100 : 0;
        tc.avgCallDuration = tc.connectedCalls > 0 ? tc.totalCallDuration / tc.connectedCalls : 0;
        return tc;
      }).sort((a, b) => b.totalCalls - a.totalCalls); // Sort by total calls

      setData(finalData);

    } catch (err) {
      console.error("Error fetching performance data:", err);
      setError("Failed to load performance data.");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Effect to re-run fetch when filters change
  useEffect(() => {
    fetchPerformanceData()
  }, [startDate, endDate, telecallerParam, telecallers]) // Depend on filtered values

  // --- RENDERING ---

  if (isLoading) {
    return (
      <div className="text-center py-12 text-blue-500 flex justify-center items-center gap-2">
        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading Performance Data...
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">Error: {error}</div>
  }
  
  if (data.length === 0) {
    return (
        <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg bg-gray-50">
            <Users className="h-10 w-10 mx-auto mb-3 text-gray-400" />
            <p className="font-semibold text-lg">No Performance Data Available</p>
            <p className="text-sm">Please adjust the date range or ensure the selected telecallers have activity in this period.</p>
        </div>
    )
  }

  return (
    <div className="overflow-x-auto shadow-lg rounded-lg bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telecaller</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads ($$)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calls (Min/Rate)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion (Rate)</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((telecaller) => (
            <tr key={telecaller.id} className="hover:bg-blue-50 transition duration-150">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${telecaller.isCheckedIn ? 'bg-green-500' : 'bg-red-500'}`} title={telecaller.isCheckedIn ? 'Checked in' : 'Not checked in'} />
                  <div className="text-sm font-medium text-gray-900">{telecaller.name}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 font-semibold">{telecaller.totalLeads} Total</div>
                <div className="text-xs text-gray-500">
                  {telecaller.newLeads} New | {telecaller.convertedLeads} Interested
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 font-semibold">{telecaller.totalCalls} Calls</div>
                <div className="text-xs text-gray-500 flex items-center">
                    <Phone className="h-3 w-3 mr-1 text-gray-400" />
                    {telecaller.connectedCalls} Connected ({telecaller.connectRate.toFixed(1)}%)
                </div>
                <div className="text-xs text-gray-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-gray-400" />
                    {(telecaller.totalCallDuration / 60).toFixed(0)} min total (Avg: {telecaller.avgCallDuration.toFixed(0)}s)
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Badge 
                  variant="outline" 
                  className={`text-sm font-semibold px-3 py-1 ${
                    telecaller.conversionRate >= 15 ? 'bg-green-100 text-green-800 border-green-300' :
                    telecaller.conversionRate >= 8 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-red-100 text-red-800 border-red-300'
                  }`}
                >
                  {telecaller.convertedLeads} Leads ({telecaller.conversionRate.toFixed(1)}%)
                </Badge>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="space-y-1">
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
    </div>
  )
}
