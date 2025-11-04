// app/telecaller/calls/page.tsx
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Clock, Calendar, User, FileText, Bell, Users } from "lucide-react"
import { format, isFuture } from "date-fns"

// Utility functions (moved here for clarity, but they were already in your file)
const formatDuration = (seconds: number) => {
  if (!seconds) return "N/A"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const getStatusColor = (callType: string) => {
  switch (callType?.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800"
    case "missed":
      return "bg-red-100 text-red-800"
    case "busy":
      return "bg-yellow-100 text-yellow-800"
    case "no_answer":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-blue-100 text-blue-800"
  }
}

const getResultColor = (result: string) => {
  if (!result) return "bg-gray-100 text-gray-800"
  switch (result.toLowerCase()) {
    case "successful":
      return "bg-green-100 text-green-800"
    case "callback_requested":
      return "bg-blue-100 text-blue-800"
    case "not_interested":
      return "bg-red-100 text-red-800"
    case "wrong_number":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

// ----------------------------------------------------------------------

export default async function CallHistoryPage({
  searchParams,
}: {
  searchParams: { follow_up?: string; call_type?: string }
}) {
  const supabase = await createClient()

  // Get current user (Telecaller)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Build query with filters - ONLY fetching calls for the current user
  let query = supabase
    .from("call_logs")
    .select("*")
    .eq("user_id", user.id) // <<-- ESSENTIAL FILTER

  // Apply filters
  if (searchParams.follow_up === "true") {
    query = query.eq("follow_up_required", true)
  }
  if (searchParams.call_type && searchParams.call_type !== "all") {
    query = query.eq("call_type", searchParams.call_type)
  }

  const { data: callLogs, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching call logs:", error)
    // Error UI (omitted for brevity)
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
        <Card><CardContent className="p-12 text-center">
            <div className="text-red-600 mb-4"><Phone className="h-12 w-12 mx-auto" /></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading call history</h3>
            <p className="text-gray-600 mb-4">There was an error loading your call history. Please try again later.</p>
            <pre className="text-xs text-gray-500 bg-gray-100 p-2 rounded mt-4">{JSON.stringify(error, null, 2)}</pre>
          </CardContent></Card>
      </div>
    )
  }

  // Handle case where no logs are found initially
  const logs = callLogs || []

  // 2. Fetch Lead information
  const leadIds = logs.map((call: { lead_id: any; }) => call.lead_id).filter(Boolean)
  const uniqueLeadIds = [...new Set(leadIds)]
  
  let leadsData: Record<string, any> = {}
  if (uniqueLeadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, phone, company")
      .in("id", uniqueLeadIds)
    
    if (leads) {
      leadsData = leads.reduce((acc: Record<string, any>, lead: { id: string | number; }) => {
        acc[lead.id] = lead
        return acc
      }, {} as Record<string, any>)
    }
  }

  // 3. Fetch Telecaller (User) Information
  // Since this page is for a single user (the logged-in telecaller), we only need their name.
  // We'll use the user object we already fetched:
  const telecallerName = user.user_metadata?.name || user.email?.split('@')[0] || "You"
  
  // Calculate statistics (retained from original file)
  const totalCalls = logs.length
  const completedCalls = logs.filter((call: { call_type: string; }) => call.call_type === "completed").length
  const followUpRequired = logs.filter((call: { follow_up_required: any; }) => call.follow_up_required).length
  const upcomingCalls = logs.filter((call: { next_call_scheduled: string | number | Date; }) => 
    call.next_call_scheduled && isFuture(new Date(call.next_call_scheduled))
  ).length
  const avgDuration = logs.length
    ? Math.round(logs.reduce((sum: number, call: { duration_seconds: number; }) => sum + (call.duration_seconds || 0), 0) / logs.length)
    : 0

  // Calculate today's statistics (retained from original file)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayCalls = logs.filter((call: { created_at: string | number | Date; }) => {
    const callDate = new Date(call.created_at)
    callDate.setHours(0, 0, 0, 0)
    return callDate.getTime() === today.getTime()
  })
  
  const todayTotalCalls = todayCalls.length
  const todayNR = todayCalls.filter((call: { call_result: string; }) => call.call_result === "nr").length
  const todayNI = todayCalls.filter((call: { call_result: string; }) => call.call_result === "not_interested").length
  const todayTotalDuration = todayCalls.reduce((sum: number, call: { duration_seconds: number; }) => sum + (call.duration_seconds || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
          <p className="text-gray-600 mt-1">Track all your calls and their outcomes</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* ... (Statistics Cards are unchanged and work with the fetched data) ... */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Phone className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bell className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Follow-ups</p>
                <p className="text-2xl font-bold text-gray-900">{followUpRequired}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(avgDuration)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Statistics */}
      {/* ... (Today's Statistics Cards are unchanged) ... */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Phone className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Calls</p>
                <p className="text-2xl font-bold text-gray-900">{todayTotalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">NR Today</p>
                <p className="text-2xl font-bold text-gray-900">{todayNR}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">NI Today</p>
                <p className="text-2xl font-bold text-gray-900">{todayNI}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Duration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(todayTotalDuration)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Call History List - Updated to show Telecaller Name (which is "You") */}
      <div className="space-y-4">
        {logs.map((call: any) => {
          const lead = leadsData[call.lead_id]
          // Telecaller name is always the logged-in user for this page
          const callerDisplay = telecallerName
          
          return (
            <Card key={call.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Phone className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      
                      {/* Telecaller Name Display */}
                      <p className="text-xs font-semibold text-blue-600 flex items-center mb-1">
                        <User className="h-3 w-3 mr-1"/>
                        Made by: {callerDisplay} 
                      </p>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="text-lg font-semibold text-gray-900">{lead?.name || "Unknown Lead"}</p>
                        <Badge className={getStatusColor(call.call_type)}>
                          {call.call_type?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                        </Badge>
                        {call.call_result && (
                          <Badge variant="outline" className={getResultColor(call.call_result)}>
                            {call.call_result.replace("_", " ").toUpperCase()}
                          </Badge>
                        )}
                        {call.follow_up_required && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Follow-up Required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Phone className="h-4 w-4 mr-1" />
                          {lead?.phone || "No phone"}
                        </span>
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {lead?.company || "No company"}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(new Date(call.created_at), "MMM dd, yyyy HH:mm")}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                      </div>
                      {call.next_call_scheduled && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-blue-600">
                          <Calendar className="h-4 w-4" />
                          <span>Next call: {format(new Date(call.next_call_scheduled), "MMM dd, yyyy 'at' HH:mm")}</span>
                        </div>
                      )}
                      {call.notes && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start">
                            <FileText className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
                            <p className="text-sm text-gray-700">{call.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {lead?.phone && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${lead.phone}`}>
                          <Phone className="h-4 w-4 mr-1" />
                          Call Again
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Empty State (retained from original file) */}
        {logs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Call History</h3>
              <p className="text-gray-600">
                You haven't made any calls yet. Start calling your leads to see the history here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
