import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Users, Phone, Clock, Activity, PieChart } from "lucide-react"

export const dynamic = "force-dynamic" 

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 1. Get Stats (RLS automatically filters these for Team Leaders)
  
  // A. Total Leads
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })

  // B. Active Telecallers (Team Members)
  const { count: activeTelecallers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "telecaller")
    .eq("is_active", true)

  // C. Today's Calls
  const today = new Date().toISOString().split('T')[0]
  const { count: todaysCalls } = await supabase
    .from("call_logs") 
    .select("*", { count: "exact", head: true })
    .gte("created_at", today)

  // D. Pending Follow-ups
  const { count: pendingFollowUps } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "follow_up") 
    
  // E. Recent Activity (Latest 5 Leads)
  // FIX: Changed 'full_name' to 'name' to match your DB Schema
  const { data: recentLeads } = await supabase
    .from("leads")
    .select("id, name, created_at, status") 
    .order("created_at", { ascending: false })
    .limit(5)

  // F. Chart Data: Status Distribution
  // We fetch just the status column to calculate counts efficiently
  const { data: leadStatuses } = await supabase
    .from("leads")
    .select("status")
  
  // Calculate counts in Javascript
  const statusCounts: Record<string, number> = {}
  leadStatuses?.forEach((lead) => {
    const status = lead.status || "Unknown"
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  // Convert to array for rendering
  const chartData = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count) // Sort by highest count
    .slice(0, 6) // Top 6 statuses

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Overview for your team (Data protected by RLS)
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
                      {/* FIX: Using lead.name here */}
                      <span className="font-medium text-sm text-gray-900">{lead.name || "Unnamed Lead"}</span>
                      <span className="text-xs text-gray-500">
                        Added • {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full capitalize">
                      {lead.status?.replace('_', ' ') || "New"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No recent leads found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LEAD STATUS CHART (Re-implemented) */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Lead Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {chartData.length > 0 ? (
                chartData.map((item) => {
                  // Calculate percentage for bar width
                  const percentage = Math.round((item.count / (totalLeads || 1)) * 100)
                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium capitalize">{item.status.replace('_', ' ')}</span>
                        <span className="text-gray-500">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                  No data available for chart
                </div>
              )}
            </div>
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
