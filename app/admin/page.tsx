import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Users, Phone, Clock, Activity } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export const dynamic = "force-dynamic" // Ensure this page never caches incorrectly

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 1. Get the Current User (for safety/logging)
  const { data: { user } } = await supabase.auth.getUser()
  
  // 2. Fetch Stats 
  // RLS is active, so these queries only count what this user is ALLOWED to see.
  
  // A. Total Leads
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })

  // B. Active Telecallers (Users)
  // For a Team Leader, this counts only their team members.
  const { count: activeTelecallers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "telecaller")
    .eq("is_active", true)

  // C. Today's Calls (assuming you have a 'call_logs' or similar table)
  // If not, you can remove this or replace 'call_logs' with your actual table
  const today = new Date().toISOString().split('T')[0]
  const { count: todaysCalls } = await supabase
    .from("call_logs") // Check if your table is named 'call_logs' or 'calls'
    .select("*", { count: "exact", head: true })
    .gte("created_at", today)

  // D. Pending Follow-ups
  const { count: pendingFollowUps } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "follow_up") // Adjust 'status' value if yours is different
    
  // E. Recent Activity (Latest 5 Leads)
  const { data: recentLeads } = await supabase
    .from("leads")
    .select("id, full_name, created_at, status")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Welcome back! Here is the overview for your team.
        </p>
      </div>

      {/* STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Leads" 
          value={totalLeads || 0} 
          icon={<FileText className="h-4 w-4 text-blue-600" />} 
          description="Visible to you"
        />
        <StatsCard 
          title="Active Telecallers" 
          value={activeTelecallers || 0} 
          icon={<Users className="h-4 w-4 text-green-600" />} 
          description="In your team"
        />
        <StatsCard 
          title="Today's Calls" 
          value={todaysCalls || 0} 
          icon={<Phone className="h-4 w-4 text-purple-600" />} 
          description="Made by your team"
        />
        <StatsCard 
          title="Pending Follow-ups" 
          value={pendingFollowUps || 0} 
          icon={<Clock className="h-4 w-4 text-orange-600" />} 
          description="Requiring attention"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* RECENT ACTIVITY LIST */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads && recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{lead.full_name}</span>
                      <span className="text-xs text-gray-500">
                        New lead added • {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
                      {lead.status || "New"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No recent activity found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PLACEHOLDER FOR CHART (Optional) */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Lead Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[300px]">
            <p className="text-sm text-gray-500">
              {/* You can re-add your Pie Chart component here if needed */}
              Chart data is now filtered by RLS.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Simple Helper Component for the Cards
function StatsCard({ title, value, icon, description }: { title: string, value: number, icon: any, description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
