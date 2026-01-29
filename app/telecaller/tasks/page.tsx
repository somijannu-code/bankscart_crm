import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button" 
import { 
  CheckSquare, Calendar, Clock, ArrowRight, AlertTriangle, 
  CheckCircle2, History, Plus 
} from "lucide-react"
import { isSameDay, startOfToday, isBefore, format, endOfToday } from "date-fns"
import { redirect } from "next/navigation"
import Link from "next/link" 
import { TaskCard } from "@/components/task-card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default function TasksPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* HEADER WITH ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Tasks</h1>
          <p className="text-gray-500 mt-1">Manage your follow-ups and scheduled activities</p>
        </div>
        <Link href="/leads">
            <Button className="shadow-sm bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> New Follow-up
            </Button>
        </Link>
      </div>

      <Suspense fallback={<TasksSkeleton />}>
        <TasksContent />
      </Suspense>
    </div>
  )
}

async function TasksContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Fetch Pending Tasks
  const { data: rawTasks } = await supabase
    .from("follow_ups")
    .select(`
      id, title, scheduled_at, priority, status, description,
      leads(id, name, phone, email, company, status)
    `)
    .eq("user_id", user.id)
    .neq("status", "completed") 
    .order("scheduled_at", { ascending: true })
    .limit(200)

  // --- 🛡️ DATA SANITIZATION (Fixes the .replace error) ---
  // We clean the data here so <TaskCard> never receives null values
  const followUps = (rawTasks || []).map(task => ({
    ...task,
    status: task.status || "pending", // Default to pending
    priority: task.priority || "medium", // Default to medium
    // Handle orphaned tasks (where lead was deleted)
    leads: task.leads || { 
      id: "unknown", 
      name: "Unknown Lead", 
      status: "unknown", 
      company: "N/A" 
    }
  }))

  // --- DATE LOGIC ---
  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  
  // Safe date parsing helper
  const safeDate = (dateStr: string | null) => dateStr ? new Date(dateStr) : new Date()

  const overdueTasks = followUps.filter(task => isBefore(safeDate(task.scheduled_at), todayStart))
  const todayTasks = followUps.filter(task => {
      const date = safeDate(task.scheduled_at)
      return date >= todayStart && date <= todayEnd
  })
  const upcomingTasks = followUps.filter(task => safeDate(task.scheduled_at) > todayEnd)

  return (
    <Tabs defaultValue="focus" className="space-y-8">
      
      {/* 1. METRICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard 
          title="Overdue" 
          count={overdueTasks.length} 
          icon={AlertTriangle} 
          color="text-red-600" 
          bg="bg-red-50" 
          borderColor="border-red-200"
          pulse={overdueTasks.length > 0} 
        />
        <SummaryCard 
          title="Today" 
          count={todayTasks.length} 
          icon={Calendar} 
          color="text-blue-600" 
          bg="bg-blue-50" 
          borderColor="border-blue-200" 
        />
        <SummaryCard 
          title="Upcoming" 
          count={upcomingTasks.length} 
          icon={ArrowRight} 
          color="text-purple-600" 
          bg="bg-purple-50" 
          borderColor="border-purple-200" 
        />
        <SummaryCard 
          title="Total Pending" 
          count={followUps.length} 
          icon={CheckSquare} 
          color="text-slate-600" 
          bg="bg-slate-50" 
          borderColor="border-slate-200" 
        />
      </div>

      {/* 2. TABS NAVIGATION */}
      <div className="border-b sticky top-0 bg-white/95 backdrop-blur z-10 pt-2">
        <TabsList className="bg-transparent h-auto p-0 space-x-6 w-full justify-start">
          <TabTrigger value="focus" label="Focus Mode" count={overdueTasks.length + todayTasks.length} />
          <TabTrigger value="upcoming" label="Upcoming" count={upcomingTasks.length} />
          <TabTrigger value="history" label="History" />
        </TabsList>
      </div>

      {/* 3. TAB CONTENT */}
      
      {/* FOCUS TAB */}
      <TabsContent value="focus" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* A. Overdue Section */}
        {overdueTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4" /> Overdue ({overdueTasks.length})
                </h3>
            </div>
            <div className="grid gap-3">
              {overdueTasks.map(task => <TaskCard key={task.id} task={task} isOverdue={true} />)}
            </div>
          </div>
        )}

        {/* B. Today Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
            <Calendar className="h-4 w-4" /> Today's Schedule ({todayTasks.length})
          </h3>
          {todayTasks.length > 0 ? (
            <div className="grid gap-3">
              {todayTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          ) : (
            <EmptyState 
              icon={CheckCircle2} 
              title="All Caught Up!" 
              description="You have no tasks scheduled for the rest of today."
              variant="dashed"
            />
          )}
        </div>
      </TabsContent>

      {/* UPCOMING TAB */}
      <TabsContent value="upcoming" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {upcomingTasks.length > 0 ? (
          <GroupedTasks tasks={upcomingTasks} />
        ) : (
          <EmptyState icon={Calendar} title="No Upcoming Tasks" description="Your schedule is clear for the coming days." />
        )}
      </TabsContent>

      {/* HISTORY TAB (Suspended for Performance) */}
      <TabsContent value="history">
        <Suspense fallback={<HistorySkeleton />}>
            <CompletedTasksList userId={user.id} />
        </Suspense>
      </TabsContent>

    </Tabs>
  )
}

// --- HELPER COMPONENTS ---

function SummaryCard({ title, count, icon: Icon, color, bg, borderColor, pulse }: any) {
  return (
    <Card className={`border shadow-sm transition-all hover:shadow-md ${borderColor} ${pulse ? "animate-pulse ring-1 ring-red-100" : ""}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className={`text-3xl font-bold tracking-tight ${color}`}>{count}</p>
        </div>
        <div className={`p-3 rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  )
}

function TabTrigger({ value, label, count }: any) {
  return (
    <TabsTrigger 
      value={value}
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none px-2 py-3 transition-all hover:text-slate-900"
    >
      <span className="mr-2 text-sm font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}

function GroupedTasks({ tasks }: { tasks: any[] }) {
  const grouped = tasks.reduce((acc, task) => {
    // Check if scheduled_at exists before formatting
    const dateStr = task.scheduled_at || new Date().toISOString()
    const dateKey = format(new Date(dateStr), "yyyy-MM-dd")
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(task)
    return acc
  }, {} as Record<string, typeof tasks>)

  return Object.entries(grouped).map(([dateKey, groupTasks]) => {
    const date = new Date(dateKey)
    const isTom = isSameDay(date, addDays(new Date(), 1)) 
    const label = isTom ? "Tomorrow" : format(date, "EEEE, MMM do")

    return (
      <div key={dateKey} className="space-y-3">
        <div className="flex items-center gap-4">
          <div className={`text-sm font-bold px-3 py-1 rounded-full ${isTom ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
            {label}
          </div>
          <div className="h-px bg-slate-100 w-full" />
        </div>
        <div className="grid gap-3">
          {groupTasks.map((task: any) => <TaskCard key={task.id} task={task} />)}
        </div>
      </div>
    )
  })
}

// Async component for History Tab
async function CompletedTasksList({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from("follow_ups")
    .select(`*, leads(name, company)`)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50)

  if (!data?.length) return <EmptyState icon={History} title="No History" description="You haven't completed any tasks yet." />

  return (
    <div className="space-y-2">
      {data.map(task => (
        <div key={task.id} className="group flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-green-50 p-2 rounded-full text-green-600 border border-green-100">
                <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 line-through decoration-slate-300 decoration-2">{task.title}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                 <span className="font-medium">{task.leads?.name || "Unknown Lead"}</span>
                 <span>•</span>
                 <span>{format(new Date(task.completed_at || task.scheduled_at || new Date()), "MMM d, h:mm a")}</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-wide">
            Done
          </span>
        </div>
      ))}
    </div>
  )
}

// --- SKELETONS ---

function TasksSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <div className="flex gap-6 border-b pb-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 mb-4" />
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    </div>
  )
}

function HistorySkeleton() {
    return (
        <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-xl">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                </div>
            ))}
        </div>
    )
}
