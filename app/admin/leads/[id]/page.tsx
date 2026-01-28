"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, History, Building, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
import { LeadStatusUpdater } from "@/components/lead-status-updater"
import { LeadAuditHistory } from "@/components/lead-audit-history" // Ensure you created this component

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

        // Structure Lead Data safely
        const leadWithUserData = {
            ...leadData,
            assigned_user: leadData.assigned_user || null,
            assigner: leadData.assigner || null
        }
        setLead(leadWithUserData as Lead)

        // 3. Fetch Telecallers (for dropdown)
        const { data: telecallersData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "telecaller")
          .eq("is_active", true)
        
        if (telecallersData) setTelecallers(telecallersData as Telecaller[])

        // 4. Fetch Telecaller Attendance Status (Optional enhancement)
        const today = new Date().toISOString().split('T')[0]
        const { data: attendance } = await supabase.from("attendance").select("user_id").eq("date", today).not("check_in", "is", null)
        if(attendance) {
            const statusMap: any = {}
            attendance.forEach((a: any) => statusMap[a.user_id] = true)
            setTelecallerStatus(statusMap)
        }

        // 5. Fetch Full Timeline
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

  // --- FORM SUBMIT HANDLER ---
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
      
      // Update Lead
      const { error } = await supabase.from("leads").update(updates).eq("id", params.id)
      if (error) throw error

      // Log Change if Status changed
      if (lead?.status !== updates.status && user) {
          await supabase.from("notes").insert({
              lead_id: params.id,
              user_id: user.id,
              content: `Status manually updated from ${lead?.status} to ${updates.status}`,
              note_type: 'status_change'
          })
          // Re-fetch timeline to show the change
          await fetchTimelineData(params.id)
      }
      
      // Update Local State without page reload
      setLead(prev => prev ? { ...prev, ...updates } as Lead : null)
      alert("Lead updated successfully!")

    } catch (err) {
      console.error("Error updating lead:", err)
      alert("Failed to update lead.")
    } finally {
      setUpdating(false)
    }
  }

  // --- ACTIONS ---
  const makeCall = (phone: string) => {
    if (phone) window.open(`tel:${phone}`, "_self")
  }

  const sendEmail = (email: string) => {
    if (email) window.open(`mailto:${email}`, "_blank")
  }

  // --- RENDER HELPERS ---
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
        high: "bg-red-100 text-red-800", 
        medium: "bg-blue-100 text-blue-800", 
        low: "bg-gray-100 text-gray-800" 
    }
    return map[priority] || "bg-gray-100 text-gray-800"
  }

  const getSafeValue = (val: any, def: string) => val || def

  if (loading) return <div className="p-10 text-center animate-pulse">Loading Lead Details...</div>
  if (error || !lead) return <div className="p-10 text-center text-red-500 font-medium">{error}</div>

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* 1. Header & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/admin/leads">
                <Button variant="outline" size="sm" className="gap-2 bg-white"><ArrowLeft className="h-4 w-4"/> Back</Button>
            </Link>
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    {getSafeValue(lead.name, "Unknown Lead")}
                    <Badge variant="outline" className="text-sm font-normal text-slate-500">ID: {lead.id.slice(0,8)}</Badge>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-500 text-sm flex items-center gap-1"><Building className="h-3 w-3"/> {getSafeValue(lead.company, "No Company")}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 text-sm flex items-center gap-1"><User className="h-3 w-3"/> {getSafeValue(lead.assigned_user?.full_name, "Unassigned")}</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. Main Tabs Layout */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-white border w-full justify-start p-0 h-auto">
          <TabsTrigger value="overview" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Overview</TabsTrigger>
          <TabsTrigger value="timeline" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Timeline</TabsTrigger>
          <TabsTrigger value="notes" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Notes</TabsTrigger>
          <TabsTrigger value="calls" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Calls</TabsTrigger>
          <TabsTrigger value="followups" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Follow-ups</TabsTrigger>
          
          {/* NEW: History Tab */}
          <TabsTrigger value="history" className="px-6 py-3 gap-2 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">
            <History className="h-4 w-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* 3. Tab Contents */}
        
        {/* OVERVIEW TAB (Form + Sidebar) */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Edit Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Lead Details
                    <div className="flex gap-2">
                        <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                        <Badge className={getPriorityColor(lead.priority)}>{lead.priority}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Full Name *</Label><Input name="name" defaultValue={lead.name} required /></div>
                      <div><Label>Company</Label><Input name="company" defaultValue={lead.company || ""} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Email</Label><Input name="email" type="email" defaultValue={lead.email || ""} /></div>
                      <div><Label>Phone *</Label><Input name="phone" defaultValue={lead.phone} required /></div>
                    </div>
                    
                    {/* Address & Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><Label>Designation</Label><Input name="designation" defaultValue={lead.designation || ""} /></div>
                        <div><Label>Source</Label><Input name="source" defaultValue={lead.source || ""} /></div>
                    </div>
                    <div><Label>Address</Label><Textarea name="address" defaultValue={lead.address || ""} rows={2} /></div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><Label>City</Label><Input name="city" defaultValue={lead.city || ""} /></div>
                        <div><Label>State</Label><Input name="state" defaultValue={lead.state || ""} /></div>
                        <div><Label>Zip</Label><Input name="zip_code" defaultValue={lead.zip_code || ""} /></div>
                        <div><Label>Country</Label><Input name="country" defaultValue={lead.country || ""} /></div>
                    </div>

                    {/* Status & Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 mt-4">
                        <div>
                            <Label>Status</Label>
                            <Select name="status" defaultValue={lead.status || "new"}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="Interested">Interested</SelectItem>
                                    <SelectItem value="Disbursed">Disbursed</SelectItem>
                                    <SelectItem value="Not_Interested">Not Interested</SelectItem>
                                    {/* Add other statuses as needed */}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Priority</Label>
                            <Select name="priority" defaultValue={lead.priority || "medium"}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Assign To</Label>
                            <Select name="assigned_to" defaultValue={lead.assigned_to || "unassigned"}>
                                <SelectTrigger><SelectValue placeholder="Select Telecaller" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {telecallers?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            <span className={telecallerStatus[t.id] ? "text-green-600 font-medium" : ""}>
                                                {t.full_name} {telecallerStatus[t.id] && "●"}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div><Label>Internal Notes</Label><Textarea name="notes" defaultValue={lead.notes || ""} rows={3} placeholder="Admin internal notes..." /></div>

                    <Button type="submit" className="w-full bg-slate-900" disabled={updating}>
                        {updating ? "Saving..." : <><Save className="w-4 h-4 mr-2"/> Save Changes</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Recent Activity Timeline Preview */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5"/> Recent Activity</CardTitle></CardHeader>
                <CardContent>
                    <TimelineView data={timelineData.slice(0, 5)} />
                    {timelineData.length > 5 && (
                        <Button variant="link" className="mt-2 w-full" onClick={() => (document.querySelector('[value="timeline"]') as HTMLElement)?.click()}>
                            View all history
                        </Button>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Actions & Stats */}
            <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                    <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <Button onClick={() => makeCall(lead.phone)} className="w-full gap-2" disabled={!lead.phone}>
                            <Phone className="h-4 w-4"/> Call Now
                        </Button>
                        <Button onClick={() => sendEmail(lead.email || "")} variant="outline" className="w-full gap-2" disabled={!lead.email}>
                            <Mail className="h-4 w-4"/> Send Email
                        </Button>
                        <Link href={`/admin/leads/${lead.id}/follow-up`} className="block">
                            <Button variant="outline" className="w-full gap-2"><Calendar className="h-4 w-4"/> Schedule Follow-up</Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Status Updater Component */}
                <Card>
                    <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
                    <CardContent>
                        <LeadStatusUpdater 
                            leadId={lead.id} 
                            currentStatus={lead.status} 
                            leadPhoneNumber={lead.phone} 
                            telecallerName={user?.full_name || "Admin"}
                            onStatusUpdate={() => fetchTimelineData(lead.id)} // Refresh timeline on update
                        />
                    </CardContent>
                </Card>

                {/* Lead Stats */}
                <Card>
                    <CardHeader><CardTitle>Lead Stats</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Created:</span>
                            <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Last Contact:</span>
                            <span>{lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Activity Count:</span>
                            <span>{timelineData.length} events</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline">
            <Card><CardContent className="pt-6"><TimelineView data={timelineData} /></CardContent></Card>
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes">
            <Card><CardContent className="pt-6"><LeadNotes leadId={lead.id} userId={user?.id} /></CardContent></Card>
        </TabsContent>

        {/* CALLS TAB */}
        <TabsContent value="calls">
            <Card><CardContent className="pt-6"><LeadCallHistory leadId={lead.id} userId={user?.id} /></CardContent></Card>
        </TabsContent>

        {/* FOLLOW-UPS TAB */}
        <TabsContent value="followups">
            <Card><CardContent className="pt-6"><FollowUpsList leadId={lead.id} /></CardContent></Card>
        </TabsContent>

        {/* NEW: AUDIT HISTORY TAB */}
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
                <LeadAuditHistory leadId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
