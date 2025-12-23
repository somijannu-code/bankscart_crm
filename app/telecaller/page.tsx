"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, Users, Calendar, CheckCircle, Clock, TrendingUp, Rocket, BarChart3, RefreshCw, Plus, Trophy, LogIn } from "lucide-react"
import { TodaysTasks } from "@/components/todays-tasks"
import { useRouter } from "next/navigation"
import { AttendanceWidget } from "@/components/attendance-widget"
import { NotificationProvider } from "@/components/notification-provider"
import { NotificationBell } from "@/components/notifications/notification-bell" 
import { QuickActions } from "@/components/quick-actions"
import { PerformanceMetrics } from "@/components/performance-metrics"
import { ErrorBoundary } from "@/components/error-boundary"
import { LoadingSpinner } from "@/components/loading-spinner"
import { EmptyState } from "@/components/empty-state"
import { useEffect, useState } from "react"

// Removed DailyTargetProgress import as it is being replaced
// import { DailyTargetProgress } from "@/components/daily-target-progress"

interface DashboardStats {
  title: string
  value: number | string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  format?: "number" | "percentage" | "duration" | "callShortage" 
}

interface DashboardData {
  stats: DashboardStats[]
  user: any
  isLoading: boolean
  error: string | null
  monthlyTarget: number
  achievedAmount: number
}

export default function TelecallerDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData>({
    stats: [],
    user: null,
    isLoading: true,
    error: null,
    monthlyTarget: 0,
    achievedAmount: 0
  })

  // Fixed daily call target
  const DAILY_CALL_TARGET = 350; 

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const supabase = createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          router.push("/auth/login")
          return
        }

        // 1. Calculate Date Ranges (Current Month)
        const now = new Date();
        const startOfDay = now.toISOString().split("T")[0];
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 2. Parallel Data Fetching
        const [
          myLeadsResponse,
          todaysCallsResponse,
          pendingFollowUpsResponse,
          completedTodayResponse,
          userProfileResponse,
          disbursedLeadsResponse
        ] = await Promise.allSettled([
          // My Leads
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", user.id),
          
          // Today's Calls
          supabase
            .from("call_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", startOfDay),
          
          // Pending Follow-ups
          supabase
            .from("follow_ups")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "pending"),
          
          // Completed Today
          supabase
            .from("follow_ups")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "completed")
            .gte("completed_at", startOfDay),

          // User Profile (For Target)
          supabase.from("users").select("monthly_target").eq("id", user.id).single(),

          // Disbursed Leads
          supabase
            .from("leads")
            .select("disbursed_amount")
            .eq("assigned_to", user.id)
            .ilike("status", "disbursed") 
            .gte("disbursed_at", startOfMonth)
        ])

        const getCount = (response: PromiseSettledResult<any>) => {
          if (response.status === "rejected") return 0
          return response.value.count || 0
        }

        const myLeads = getCount(myLeadsResponse)
        const todaysCalls = getCount(todaysCallsResponse)
        const pendingFollowUps = getCount(pendingFollowUpsResponse)
        const completedToday = getCount(completedTodayResponse)

        // Process Target & Achievement
        let monthlyTarget = 2000000; // Default 20L
        if (userProfileResponse.status === 'fulfilled' && userProfileResponse.value.data) {
             monthlyTarget = userProfileResponse.value.data.monthly_target || 2000000;
        }

        let achievedAmount = 0;
        if (disbursedLeadsResponse.status === 'fulfilled' && disbursedLeadsResponse.value.data) {
            achievedAmount = disbursedLeadsResponse.value.data.reduce((sum: number, lead: any) => {
              return sum + Number(lead.disbursed_amount || 0);
            }, 0);
        }

        // Calculate metrics
        const callShortage = DAILY_CALL_TARGET - todaysCalls;
        const isTargetMet = callShortage <= 0;
        const conversionRate = todaysCalls > 0 ? Math.round((completedToday / todaysCalls) * 100) : 0
        const successRate = (completedToday + todaysCalls) > 0 
          ? Math.round((completedToday / (completedToday + pendingFollowUps)) * 100)
          : 0

        const stats: DashboardStats[] = [
          {
            title: "My Leads",
            value: myLeads,
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
          },
          {
            title: "Today Calls Shortage",
            value: callShortage,
            icon: Phone,
            color: isTargetMet ? "text-green-600" : "text-red-600",
            bgColor: isTargetMet ? "bg-green-50" : "bg-red-50",
            format: "callShortage",
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
          {
            title: "Success Rate",
            value: successRate,
            icon: TrendingUp,
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            format: "percentage"
          },
          {
            title: "Conversion Rate",
            value: conversionRate,
            icon: BarChart3,
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            format: "percentage"
          },
        ]

        setData({
          stats,
          user,
          isLoading: false,
          error: null,
          monthlyTarget,
          achievedAmount
        })

      } catch (err) {
        console.error("Dashboard error:", err)
        setData(prev => ({ ...prev, isLoading: false, error: "Failed to load dashboard data" }))
      }
    }

    loadDashboardData()
  }, [router])

  const handleRefresh = () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }))
    setTimeout(() => window.location.reload(), 500)
  }

  const handleAddLead = () => {
    router.push("/leads/new")
  }

  const formatValue = (stat: DashboardStats) => {
    if (stat.format === "percentage") return `${stat.value}%`
    if (stat.format === "duration") return `${stat.value}m`
    if (stat.format === "callShortage") {
      const shortage = Number(stat.value);
      if (shortage <= 0) return "0 (Congratulations!)";
      return stat.value.toString();
    }
    return stat.value.toString()
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(val);
  }

  // --- MOTIVATIONAL LOGIC ---
  const getMotivationalQuote = (achieved: number, target: number) => {
    const percentage = (achieved / target) * 100;
    if (percentage >= 100) return "🚀 LEGENDARY! You've smashed your monthly target! Everything now is a bonus.";
    if (percentage >= 90) return "🔥 SO CLOSE! Just one big push to cross the finish line!";
    if (percentage >= 75) return "💪 Amazing momentum! You're in the home stretch.";
    if (percentage >= 50) return "⭐ Halfway there! Keep the energy high.";
    if (percentage >= 25) return "📈 Good start! Focus on converting those warm leads.";
    return "🌱 Every giant leap starts with a small step. Let's get those numbers up!";
  }

  const progressPercentage = Math.min(100, Math.max(0, (data.achievedAmount / data.monthlyTarget) * 100));

  if (data.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (data.error || !data.user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <Phone className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to load dashboard</h2>
          <p className="text-gray-600 mb-6">
            {data.error || "There was a problem loading your dashboard data."}
          </p>
          <Button onClick={handleRefresh} size="lg">Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <NotificationProvider userId={data.user.id}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Telecaller Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {data.user.email?.split('@')[0] || 'Telecaller'}!</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2" 
              onClick={handleRefresh}
              disabled={data.isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${data.isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" className="flex items-center gap-2" onClick={handleAddLead}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <ErrorBoundary fallback={<div className="text-center py-4 text-gray-500">Quick actions unavailable</div>}>
          <QuickActions userId={data.user.id} />
        </ErrorBoundary>

        {/* --- TARGET CARD --- */}
        <Card className="border-2 border-indigo-100 bg-gradient-to-r from-indigo-50 to-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="h-32 w-32 text-indigo-600" />
          </div>
          <CardHeader className="pb-2">
             <div className="flex justify-between items-center z-10 relative">
               <CardTitle className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                 <Rocket className="h-5 w-5 text-indigo-600" />
                 Monthly Disbursement Target
               </CardTitle>
               <span className="text-sm font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                 {progressPercentage.toFixed(1)}% Achieved
               </span>
             </div>
          </CardHeader>
          <CardContent className="z-10 relative">
            <div className="flex justify-between text-sm mb-2 font-medium text-gray-600">
               <span>Achieved: <span className="text-gray-900 font-bold text-lg">{formatCurrency(data.achievedAmount)}</span></span>
               <span>Target: <span className="text-gray-900 font-bold text-lg">{formatCurrency(data.monthlyTarget)}</span></span>
            </div>
            
            <div className="h-4 w-full bg-indigo-100 rounded-full overflow-hidden mb-3">
               <div 
                 className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000 ease-out"
                 style={{ width: `${progressPercentage}%` }}
               />
            </div>

            <p className="text-sm text-indigo-700 italic font-medium flex items-center gap-2">
               💡 {getMotivationalQuote(data.achievedAmount, data.monthlyTarget)}
            </p>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {data.stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow duration-200 border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      {stat.title}
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}> 
                      {formatValue(stat)}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Performance Metrics */}
        <ErrorBoundary fallback={<div className="text-center py-4 text-gray-500">Performance metrics unavailable</div>}>
          <PerformanceMetrics 
            userId={data.user.id}
            conversionRate={typeof data.stats[5]?.value === 'number' ? data.stats[5].value : 0}
            successRate={typeof data.stats[4]?.value === 'number' ? data.stats[4].value : 0}
            avgCallDuration={5} 
          />
        </ErrorBoundary>

        {/* Attendance Widget */}
        <ErrorBoundary fallback={null}>
          <AttendanceWidget userId={data.user.id} />
        </ErrorBoundary>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6"> 
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Today's Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary 
                fallback={<EmptyState icon={Calendar} title="Unable to load tasks" description="Please try refreshing the page" />}
              >
                <TodaysTasks userId={data.user.id} />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>

        {/* LOGINS BUTTON (Replaces Daily Call Target Progress) */}
        <div className="grid grid-cols-1">
            <Button 
                className="w-full py-6 text-lg font-bold shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
                onClick={() => router.push("/admin/logins")}
            >
                <LogIn className="mr-3 h-6 w-6" />
                View Logins
            </Button>
        </div>

      </div>
    </NotificationProvider>
  )
}
