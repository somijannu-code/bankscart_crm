"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, History, 
  Building, User, AlertTriangle, MoreHorizontal, CheckCircle2 
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
import { LeadStatusUpdater } from "@/components/lead-status-updater"
import { LeadAuditHistory } from "@/components/lead-audit-history"
import { formatDistanceToNow } from "date-fns"

// --- TYPES ---
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

export default function EditLeadPage({ params }: EditLeadPageProps) {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [lead, setLead] = useState<Lead | null>(null)
  const [telecallers, setTelecallers] = useState<Telecaller[] | null>(null)
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Auth Check
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !currentUser) {
          router.push("/auth/login")
          return
        }
        setUser(currentUser)

        // 2. Fetch Lead Details
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

        const leadWithUserData = {
            ...leadData,
            assigned_user: leadData.assigned_user || null,
            assigner: leadData.assigner || null
        }
        setLead(leadWithUserData as Lead)

        // 3. Fetch Telecallers
        const { data: telecallersData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "telecaller")
          .eq("is_active", true)
        
        if (telecallersData) setTelecallers(telecallersData as Telecaller[])

        // 4. Fetch Attendance
        const today = new Date().toISOString().split('T')[0]
        const { data: attendance } = await supabase.from("attendance").select("user_id").eq("date", today).not("check_in", "is", null)
        if(attendance) {
            const statusMap: any = {}
            attendance.forEach((a: any) => statusMap[a.user_id] = true)
            setTelecallerStatus(statusMap)
        }

        // 5. Fetch Timeline
        await fetchTimelineData(params.id)

        setLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load lead data")
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, router, supabase])

  // --- HELPER: Fetch Timeline ---
  const fetchTimelineData = async (leadId: string) => {
    try {
        const { data: notes } = await supabase.from("notes").select("*, users!notes_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })
        const { data: followUps } = await supabase.from("follow_ups").select("*").eq("lead_id", leadId).order("scheduled_date", { ascending: false })
        const { data: callHistory } = await supabase.from("call_logs").select("*, users!call_logs_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })

        const timeline = [
            ...(notes || []).map((n: any) => ({ 
                type: 'note', 
                id: n.id, 
                title: n.note_type === 'status_change' ? 'Status Change' : 'Note Added', 
                description: n.content, 
                date: n.created_at, 
                icon: <MessageSquare className="h-4 w-4"/>, 
                user: n.users?.full_name || 'Unknown' 
            })),
            ...(followUps || []).map((f: any) => ({ 
                type: 'follow_up', 
                id: f.id, 
                title: 'Follow Up Scheduled', 
                description: `For: ${new Date(f.scheduled_date).toLocaleString()} - ${f.status}`, 
                date: f.created_at, 
                icon: <Calendar className="h-4 w-4"/>, 
                user: 'System' 
            })),
            ...(callHistory || []).map((c: any) => ({ 
                type: 'call', 
                id: c.id, 
                title: 'Call Logged', 
                description: `Outcome: ${c.outcome} (${c.duration_seconds}s)`, 
                date: c.created_at, 
                icon: <Phone className="h-4 w-4"/>, 
                user: c.users?.full_name || 'Unknown' 
            }))
        ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setTimelineData(timeline)
    } catch(e) { console.error("Timeline Error", e) }
  }

  // --- FORM SUBMIT ---
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUpdating(true)
    
    try {
      const formData = new FormData(event.currentTarget)
      const assignedToValue = formData.get("assigned_to") as string
      
      const updates = {
        name: formData.get("name") as string,
        email: (formData.get("email") as string) || null,
        phone: formData.get("phone") as string,
        company: (formData.get("company") as string) || null,
        designation: (formData.get("designation") as string) || null,
        address: (formData.get("address") as string) || null,
        city: (formData.get("city") as string) || null,
        state: (formData.get("state") as string) || null,
        zip_code: (formData.get("zip_code") as string) || null,
        country: (formData.get("country") as string) || null,
        status: formData.get("status") as string,
        priority: formData.get("priority") as string,
        assigned_to: assignedToValue === "unassigned" ? null : assignedToValue,
        source: (formData.get("source") as string) || null,
        notes: (formData.get("notes") as string) || null,
      }
      
      const { error } = await supabase.from("leads").update(updates).eq("id", params.id)
      if (error) throw error

      if (lead?.status !== updates.status && user) {
          await supabase.from("notes").insert({
              lead_id: params.id,
              user_id: user.id,
              content: `Status manually updated from ${lead?.status} to ${updates.status}`,
              note_type: 'status_change'
          })
          await fetchTimelineData(params.id)
      }
      
      setLead(prev => prev ? { ...prev, ...updates } as Lead : null)
      alert("Lead updated successfully!")

    } catch (err) {
      console.error("Error updating lead:", err)
      alert("Failed to update lead.")
    } finally {
      setUpdating(false)
    }
  }

  // --- UTILS ---
  const makeCall = (phone: string) => {
    if (phone) window.open(`tel:${phone}`, "_self")
  }

  const sendEmail = (email: string) => {
    if (email) window.open(`mailto:${email}`, "_blank")
  }

  const getStatusColor = (status: string) => {
    const map: any = { 
        new: "bg-blue-100 text-blue-800", 
        contacted: "bg-yellow-100 text-yellow-800", 
        Interested: "bg-green-100 text-green-800",
        Disbursed: "bg-emerald-100 text-emerald-800",
        Not_Interested: "bg-red-100 text-red-800"
    }
    return map[status] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const map: any = { 
        high: "bg-red-100 text-red-800 border-red-200", 
        medium: "bg-blue-100 text-blue-800 border-blue-200", 
        low: "bg-slate-100 text-slate-800 border-slate-200" 
    }
    return map[priority] || "bg-gray-100 text-gray-800"
  }

  const getSafeValue = (val: any, def: string) => val || def

  const isStale = (lastContacted: string | null) => {
      if(!lastContacted) return true
      const diff = new Date().getTime() - new Date(lastContacted).getTime()
      return diff > (7 * 24 * 60 * 60 * 1000) // 7 days
  }

  if (loading) return (
    <div className="p-10 flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500">Loading Lead Details...</p>
    </div>
  )
  
  if (error || !lead) return <div className="p-10 text-center text-red-500 font-medium">{error}</div>

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* 1. Enhanced Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
            <Link href="/admin/leads">
                <Button variant="outline" size="sm" className="gap-2 bg-white shadow-sm hover:bg-slate-50 border-slate-200">
                    <ArrowLeft className="h-4 w-4"/>
                </Button>
            </Link>
            <div>
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-lg">
                            {lead.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            {getSafeValue(lead.name, "Unknown Lead")}
                        </h1>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5"/> {getSafeValue(lead.company, "No Company")}</span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5"/> {getSafeValue(lead.assigned_user?.full_name, "Unassigned")}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center gap-2">
            {isStale(lead.last_contacted) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-xs font-medium mr-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Stale Lead (>7 days)</span>
                </div>
            )}
            <Badge variant="outline" className="px-3 py-1.5 text-xs font-mono bg-white text-slate-500">ID: {lead.id.slice(0,8)}</Badge>
        </div>
      </div>

      {/* 2. Main Tabs Layout */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="bg-white border rounded-lg p-1 shadow-sm inline-flex mb-6">
          <TabsList className="h-auto bg-transparent p-0 gap-1">
            {['overview', 'timeline', 'notes', 'calls', 'followups', 'history'].map((tab) => (
                <TabsTrigger 
                    key={tab} 
                    value={tab} 
                    className="px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md capitalize"
                >
                    {tab === 'history' ? <><History className="h-4 w-4 mr-2" /> Audit Logs</> : tab}
                </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Lead Information</CardTitle>
                        <CardDescription>Manage core details and assignment.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge className={getStatusColor(lead.status)}>{lead.status.replace(/_/g, ' ')}</Badge>
                        <Badge variant="outline" className={getPriorityColor(lead.priority)}>{lead.priority}</Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <Separator />
                
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Section 1: Contact Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" /> Contact Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><Label className="text-xs text-slate-500">Full Name</Label><Input name="name" defaultValue={lead.name} required className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Company</Label><Input name="company" defaultValue={lead.company || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Email</Label><Input name="email" type="email" defaultValue={lead.email || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Phone</Label><Input name="phone" defaultValue={lead.phone} required className="mt-1" /></div>
                        </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Section 2: Location & Meta */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" /> Location & Context
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div><Label className="text-xs text-slate-500">Designation</Label><Input name="designation" defaultValue={lead.designation || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Source</Label><Input name="source" defaultValue={lead.source || ""} className="mt-1" /></div>
                        </div>
                        <div className="mb-4"><Label className="text-xs text-slate-500">Address</Label><Textarea name="address" defaultValue={lead.address || ""} rows={2} className="mt-1 resize-none" /></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><Label className="text-xs text-slate-500">City</Label><Input name="city" defaultValue={lead.city || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">State</Label><Input name="state" defaultValue={lead.state || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Zip</Label><Input name="zip_code" defaultValue={lead.zip_code || ""} className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Country</Label><Input name="country" defaultValue={lead.country || ""} className="mt-1" /></div>
                        </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Section 3: Status & Assignment */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Building className="h-4 w-4 text-slate-400" /> Management
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-xs text-slate-500">Status</Label>
                                <Select name="status" defaultValue={lead.status || "new"}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New</SelectItem>
                                        <SelectItem value="contacted">Contacted</SelectItem>
                                        <SelectItem value="Interested">Interested</SelectItem>
                                        <SelectItem value="Disbursed">Disbursed</SelectItem>
                                        <SelectItem value="Not_Interested">Not Interested</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Priority</Label>
                                <Select name="priority" defaultValue={lead.priority || "medium"}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Assign To</Label>
                                <Select name="assigned_to" defaultValue={lead.assigned_to || "unassigned"}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select Telecaller" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {telecallers?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${telecallerStatus[t.id] ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                    <span className={telecallerStatus[t.id] ? "font-medium text-slate-900" : "text-slate-500"}>{t.full_name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={updating}>
                            {updating ? "Saving Changes..." : <><Save className="w-4 h-4 mr-2"/> Save Changes</>}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500"/> Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <TimelineView data={timelineData.slice(0, 5)} />
                    {timelineData.length > 5 && (
                        <div className="pt-4 text-center border-t mt-4">
                            <Button variant="link" size="sm" onClick={() => (document.querySelector('[value="timeline"]') as HTMLElement)?.click()}>
                                View Full History
                            </Button>
                        </div>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Actions & Stats */}
            <div className="space-y-6">
                
                {/* Status Updater */}
                <Card className="shadow-sm border-slate-200 bg-blue-50/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-blue-900">Quick Status Update</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LeadStatusUpdater 
                            leadId={lead.id} 
                            currentStatus={lead.status} 
                            leadPhoneNumber={lead.phone} 
                            telecallerName={user?.full_name || "Admin"}
                            onStatusUpdate={() => fetchTimelineData(lead.id)} 
                        />
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Communication</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <Button onClick={() => makeCall(lead.phone)} className="w-full gap-2 justify-start" variant="outline">
                            <Phone className="h-4 w-4 text-green-600"/> Call {lead.phone}
                        </Button>
                        <Button onClick={() => sendEmail(lead.email || "")} variant="outline" className="w-full gap-2 justify-start" disabled={!lead.email}>
                            <Mail className="h-4 w-4 text-blue-600"/> Email Lead
                        </Button>
                        <Link href={`/admin/leads/${lead.id}/follow-up`} className="block">
                            <Button variant="outline" className="w-full gap-2 justify-start"><Calendar className="h-4 w-4 text-purple-600"/> Schedule Follow-up</Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Lead Stats */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Insights</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Created</span>
                            <span className="font-medium">{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Last Contact</span>
                            <span className="font-medium">
                                {lead.last_contacted 
                                    ? formatDistanceToNow(new Date(lead.last_contacted), { addSuffix: true }) 
                                    : "Never"}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Engagement</span>
                            <span className="font-medium bg-slate-100 px-2 py-0.5 rounded-full text-xs">
                                {timelineData.length} Interactions
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>
        </TabsContent>

        {/* OTHER TABS */}
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

        <TabsContent value="history">
          <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center justify-between">
                  <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <History className="h-5 w-5 text-blue-600" />
                        Audit Log
                      </CardTitle>
                      <CardDescription>
                        Complete system record of every change made to this lead.
                      </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-white">Secure Record</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
                <LeadAuditHistory leadId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
