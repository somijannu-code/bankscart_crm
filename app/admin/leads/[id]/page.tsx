"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, History } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
import { LeadStatusUpdater } from "@/components/lead-status-updater"
import { LeadAuditHistory } from "@/components/lead-audit-history" // <--- IMPORT THIS

// ... [Keep existing Interfaces] ...
// (Lead, Telecaller, AttendanceRecord, Note, CallLog types remain unchanged)

interface EditLeadPageProps {
  params: {
    id: string
  }
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  designation: string | null
  source: string | null
  status: string
  priority: string
  created_at: string
  last_contacted: string | null
  next_follow_up: string | null
  assigned_to: string | null
  assigned_user: { id: string; full_name: string } | null
  assigner: { id: string; full_name: string } | null
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zip_code: string | null
}

interface Telecaller {
  id: string
  full_name: string
}

interface Note {
  id: string
  content: string
  created_at: string
  user: { full_name: string } | null
}

interface CallLog {
  id: string
  call_type: string
  duration_seconds: number | null
  outcome: string
  created_at: string
  user: { full_name: string } | null
}

export default function EditLeadPage({ params }: EditLeadPageProps) {
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [telecallers, setTelecallers] = useState<Telecaller[] | null>(null)
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [callHistory, setCallHistory] = useState<CallLog[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !currentUser) {
          router.push("/auth/login")
          return
        }
        setUser(currentUser)

        // Get lead data
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .select("*, assigned_user:users!leads_assigned_to_fkey(id, full_name), assigner:users!leads_assigned_by_fkey(id, full_name)")
          .eq("id", params.id)
          .single()

        if (leadError || !leadData) {
          setError("Lead not found")
          setLoading(false)
          return
        }

        // Structure Lead Data
        const leadWithUserData = {
            ...leadData,
            assigned_user: leadData.assigned_user || null,
            assigner: leadData.assigner || null
        }
        setLead(leadWithUserData as Lead)

        // Get telecallers
        const { data: telecallersData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "telecaller")
          .eq("is_active", true)
        if (telecallersData) setTelecallers(telecallersData as Telecaller[])

        // Fetch Timeline (Notes/Calls/Followups)
        await fetchTimelineData(params.id, supabase)

        setLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load lead data")
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, router])

  const fetchTimelineData = async (leadId: string, supabase: any) => {
    // ... [Keep existing fetchTimelineData implementation] ...
    // (This populates the "Overview -> Recent Activity" section)
    try {
        const { data: notes } = await supabase.from("notes").select("*, users!notes_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })
        const { data: followUps } = await supabase.from("follow_ups").select("*").eq("lead_id", leadId).order("scheduled_date", { ascending: false })
        const { data: callHistory } = await supabase.from("call_logs").select("*, users!call_logs_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })

        const timeline = [
            ...(notes || []).map((n: any) => ({ type: 'note', id: n.id, title: n.note_type === 'status_change' ? 'Status Change' : 'Note', description: n.content, date: n.created_at, icon: <MessageSquare className="h-4 w-4"/>, user: n.users?.full_name })),
            ...(followUps || []).map((f: any) => ({ type: 'follow_up', id: f.id, title: 'Follow Up', description: `Scheduled: ${new Date(f.scheduled_date).toLocaleString()}`, date: f.created_at, icon: <Calendar className="h-4 w-4"/>, user: 'System' })),
            ...(callHistory || []).map((c: any) => ({ type: 'call', id: c.id, title: 'Call', description: `${c.outcome} (${c.duration_seconds}s)`, date: c.created_at, icon: <Phone className="h-4 w-4"/>, user: c.users?.full_name }))
        ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setTimelineData(timeline)
    } catch(e) { console.error(e) }
  }

  // ... [Keep handleSubmit, getSafeValue, etc.] ...
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUpdating(true)
    // ... (Your existing submit logic) ...
    // Note: Make sure to call fetchTimelineData() after update to refresh the overview
    setUpdating(false)
  }

  // --- RENDER HELPERS ---
  const getStatusColor = (status: string) => {
    const map: any = { new: "bg-blue-100 text-blue-800", contacted: "bg-yellow-100 text-yellow-800", Disbursed: "bg-green-100 text-green-800" }
    return map[status] || "bg-gray-100 text-gray-800"
  }

  if (loading) return <div className="p-6 text-center">Loading Lead...</div>
  if (error || !lead) return <div className="p-6 text-center text-red-500">{error}</div>

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/admin/leads">
            <Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4"/> Back</Button>
            </Link>
            <div>
            <h1 className="text-3xl font-bold text-gray-900">{lead.name}</h1>
            <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(lead.status)}>{lead.status.replace("_", " ")}</Badge>
                <span className="text-sm text-gray-500">ID: {lead.id}</span>
            </div>
            </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-white border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="calls">Call History</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          
          {/* NEW TAB TRIGGER */}
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Audit History
          </TabsTrigger>
        </TabsList>

        {/* ... [Existing TabsContent for overview, timeline, etc.] ... */}
        <TabsContent value="overview">
            {/* ... Your Existing Overview Code ... */}
            <div className="p-4 text-center text-gray-500 border rounded bg-white">Overview Content Placeholder</div>
        </TabsContent>

        <TabsContent value="timeline">
            <Card><CardContent className="pt-6"><TimelineView data={timelineData} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="notes">
            <Card><CardContent className="pt-6"><LeadNotes leadId={lead.id} userId={user?.id} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="calls">
            <Card><CardContent className="pt-6"><LeadCallHistory leadId={lead.id} userId={user?.id} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="followups">
            <Card><CardContent className="pt-6"><FollowUpsList leadId={lead.id} /></CardContent></Card>
        </TabsContent>

        {/* NEW AUDIT HISTORY TAB CONTENT */}
        <TabsContent value="history">
          <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-blue-600" />
                Detailed Audit Log
              </CardTitle>
              <p className="text-sm text-slate-500">
                Complete system record of every change made to this lead.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
                {/* Use the new component here */}
                <LeadAuditHistory leadId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
