// app/admin/calls/page.tsx
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Clock, Calendar, User, FileText, Bell, Users } from "lucide-react"
import { format, isFuture } from "date-fns"

// Utility function to format duration (copied from your original file)
const formatDuration = (seconds: number) => {
  if (!seconds) return "N/A"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

// Utility function to get call type color (copied from your original file)
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

// Utility function to get call result color (copied from your original file)
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

export default async function AllCallHistoryPage() {
  const supabase = await createClient()

  // Note: For an admin page, you should implement proper RLS/auth checks here
  // to ensure only admins can view this data.

  // 1. Fetch ALL call logs (removed user.id filter)
  let { data: callLogs, error } = await supabase
    .from("call_logs")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching call logs:", error)
    // Error handling UI (similar to the original file)
    return (
      <div className="p-6 space-y-6">
        {/* ... (omitted for brevity) */}
        <h1 className="text-3xl font-bold text-gray-900">All Telecallers Call History</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-red-600 mb-4">
              <Phone className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading call history</h3>
            <p className="text-gray-600 mb-4">
              There was an error loading all telecallers' history.
            </p>
            <pre className="text-xs text-gray-500 bg-gray-100 p-2 rounded mt-4">
              {JSON.stringify(error, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Handle case where no logs are found initially
  callLogs = callLogs || [] 

  // 2. Collect all unique Lead IDs and User IDs
  const leadIds = callLogs.map((call: { lead_id: any; }) => call.lead_id).filter(Boolean)
  const userIds = callLogs.map((call: { user_id: any; }) => call.user_id).filter(Boolean)
  
  // Create unique arrays
  const uniqueLeadIds = [...new Set(leadIds)]
  const uniqueUserIds = [...new Set(userIds)]

  // 3. Fetch Leads Data
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

  // 4. Fetch Users (Telecallers) Data
  let usersData: Record<string, any> = {}
  if (uniqueUserIds.length > 0) {
    // Assuming 'profiles' table exists and has user details, otherwise use 'auth.users'
    // Since we don't know the exact schema, we'll fetch from 'auth.users' for email/id
    const { data: users } = await supabase.from("users").select("id, email, raw_user_meta_data").in("id", uniqueUserIds);
    
    if (users) {
      usersData = users.reduce((acc: Record<string, any>, user: { id: string | number; email: string; raw_user_meta_data: { name: any; }; }) => {
        // Use name from meta data if available, otherwise use email
        const telecallerName = user.raw_user_meta_data?.name || user.email || "Unknown Telecaller";
        acc[user.id] = { name: telecallerName };
        return acc
      }, {} as Record<string, any>)
    }
  }

  // Calculate overall statistics
  const totalCalls = callLogs.length
  const completedCalls = callLogs.filter((call: { call_type: string; }) => call.call_type === "completed").length
  const followUpRequired = callLogs.filter((call: { follow_up_required: any; }) => call.follow_up_required).length
  const upcomingCalls = callLogs.filter((call: { next_call_scheduled: string | number | Date; }) => 
    call.next_call_scheduled && isFuture(new Date(call.next_call_scheduled))
  ).length
  const avgDuration = callLogs.length
    ? Math.round(callLogs.reduce((sum: number, call: { duration_seconds: number; }) => sum + (call.duration_seconds || 0), 0) / callLogs.length)
    : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Telecallers Call History</h1>
          <p className="text-gray-600 mt-1">Aggregated tracking of all telecallers' calls and outcomes</p>
        </div>
      </div>

      {/* Aggregated Statistics for ALL Telecallers */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
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
                <p className="text-sm font-medium text-gray-600">Total Follow-ups</p>
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
              <Phone className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming Total</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call History List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold pt-4">Individual Call Logs</h2>
        {callLogs.map((call: any) => {
          const lead = leadsData[call.lead_id]
          const telecaller = usersData[call.user_id]
          
          return (
            <Card key={call.id} className="hover:shadow-lg transition-shadow border-l-4 border-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 pt-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Phone className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      
                      {/* Telecaller and Lead Name */}
                      <div className="mb-2">
                        <p className="text-sm font-medium text-blue-700 flex items-center">
                          <User className="h-4 w-4 mr-1"/>
                          **Telecaller:** {telecaller?.name || call.user_id}
                        </p>
                        <p className="text-lg font-bold text-gray-900 mt-0.5">
                          {lead?.name || "Unknown Lead"}
                        </p>
                      </div>

                      {/* Status and Result Badges */}
                      <div className="flex items-center space-x-2 mb-3">
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
                      
                      {/* Details (Phone, Company, Time, Duration) */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
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

                      {/* Next Call Scheduled */}
                      {call.next_call_scheduled && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-blue-600">
                          <Calendar className="h-4 w-4" />
                          <span>Next call: {format(new Date(call.next_call_scheduled), "MMM dd, yyyy 'at' HH:mm")}</span>
                        </div>
                      )}

                      {/* Notes */}
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
                  
                  {/* Action Button (e.g., View Lead) */}
                  <div className="flex-shrink-0">
                    {lead?.id && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/admin/leads/${lead.id}`}>
                          <FileText className="h-4 w-4 mr-1" />
                          View Lead
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Empty State */}
        {callLogs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Calls Found</h3>
              <p className="text-gray-600">
                No call history has been logged by any telecaller yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
