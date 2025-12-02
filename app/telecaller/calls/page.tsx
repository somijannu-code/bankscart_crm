// app/telecaller/calls/page.tsx
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Clock, Calendar, User, FileText, Bell, MessageSquare } from "lucide-react"
import { format, isFuture } from "date-fns"

export default async function CallHistoryPage({
  searchParams,
}: {
  searchParams: { follow_up?: string; call_type?: string }
}) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Build query - JOINING leads table directly
  let query = supabase
    .from("call_logs")
    .select(`
      *,
      leads (
        id,
        name,
        phone,
        company
      )
    `)
    .eq("user_id", user.id)

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
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
            <p className="text-gray-600 mt-1">Track all your calls and their outcomes</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-red-600 mb-4">
              <Phone className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading call history</h3>
            <p className="text-gray-600 mb-4">
              There was an error loading your call history. Please try again later.
            </p>
            <pre className="text-xs text-gray-500 bg-gray-100 p-2 rounded mt-4">
              {JSON.stringify(error, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    )
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

  const formatDuration = (seconds: number) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Calculate statistics
  const totalCalls = callLogs?.length || 0
  const completedCalls = callLogs?.filter((call: { call_type: string; }) => call.call_type === "completed").length || 0
  const followUpRequired = callLogs?.filter((call: { follow_up_required: any; }) => call.follow_up_required).length || 0
  const upcomingCalls = callLogs?.filter((call: { next_call_scheduled: string | number | Date; }) => 
    call.next_call_scheduled && isFuture(new Date(call.next_call_scheduled))
  ).length || 0
  const avgDuration = callLogs?.length
    ? Math.round(callLogs.reduce((sum: number, call: { duration_seconds: number; }) => sum + (call.duration_seconds || 0), 0) / callLogs.length)
    : 0

  // Calculate today's statistics
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayCalls = callLogs?.filter((call: { created_at: string | number | Date; }) => {
    const callDate = new Date(call.created_at)
    callDate.setHours(0, 0, 0, 0)
    return callDate.getTime() === today.getTime()
  }) || []
  
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

      {/* Call History List */}
      <div className="space-y-4">
        {callLogs?.map((call: any) => {
          // Access the joined lead data directly
          // Supabase might return it as an object or an array depending on your FK setup
          const rawLead = call.leads
          const lead = Array.isArray(rawLead) ? rawLead[0] : rawLead
          
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
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="text-lg font-semibold text-gray-900">
                          {lead?.name || "Unknown Lead"}
                        </p>
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
                          <User className="h-4 w-4 mr-1" />
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

        {(!callLogs || callLogs.length === 0) && (
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
