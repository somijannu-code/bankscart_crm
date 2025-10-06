// app/telecaller/page.tsx
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, Users, Calendar, CheckCircle, Clock, TrendingUp, RefreshCw, Plus } from "lucide-react"
import { TodaysTasks } from "@/components/todays-tasks"
import { RecentLeads } from "@/components/recent-leads"
import { redirect } from "next/navigation"
import { AttendanceWidget } from "@/components/attendance-widget"
import { NotificationProvider } from "@/components/notification-provider"

// Simple version without complex error handling first
export default async function TelecallerDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Simple stats fetch - handle errors gracefully
  let myLeads = 0
  let todaysCalls = 0
  let pendingFollowUps = 0
  let completedToday = 0

  try {
    const [leadsRes, callsRes, pendingRes, completedRes] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", user.id),
      supabase
        .from("call_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", new Date().toISOString().split("T")[0]),
      supabase
        .from("follow_ups")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("follow_ups")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("completed_at", new Date().toISOString().split("T")[0]),
    ])

    myLeads = leadsRes.count || 0
    todaysCalls = callsRes.count || 0
    pendingFollowUps = pendingRes.count || 0
    completedToday = completedRes.count || 0
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    // Continue with default values
  }

  const stats = [
    {
      title: "My Leads",
      value: myLeads,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Today's Calls",
      value: todaysCalls,
      icon: Phone,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Follow-ups",
      value: pendingFollowUps,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Completed Today",
      value: completedToday,
      icon: CheckCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ]

  return (
    <NotificationProvider userId={user.id}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome to your telecaller workspace</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Attendance Widget */}
        <AttendanceWidget userId={user.id} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TodaysTasks userId={user.id} />
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecentLeads userId={user.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </NotificationProvider>
  )
}
