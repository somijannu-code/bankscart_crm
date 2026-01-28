"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, History, 
  Building, User, AlertTriangle, Printer, Trash2, CheckCircle2, Circle, Copy, ExternalLink, ArrowRightCircle
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
import { LeadStatusUpdater } from "@/components/lead-status-updater"
import { LeadAuditHistory } from "@/components/lead-audit-history"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { toast } from "sonner" // Ensure you have installed sonner
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  updated_at: string // Used for stagnation calculation
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

const PIPELINE_STEPS = [
    { id: 'new', label: 'New Lead' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'Interested', label: 'Interested' },
    { id: 'Login', label: 'Login' },
    { id: 'Disbursed', label: 'Disbursed' }
]

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
  const [deleting, setDeleting] = useState(false)
  const [timelineData, setTimelineData] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !currentUser) {
          router.push("/auth/login")
          return
        }
        setUser(currentUser)

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

        const { data: telecallersData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "telecaller")
          .eq("is_active", true)
        
        if (telecallersData) setTelecallers(telecallersData as Telecaller[])

        const today = new Date().toISOString().split('T')[0]
        const { data: attendance } = await supabase.from("attendance").select("user_id").eq("date", today).not("check_in", "is", null)
        if(attendance) {
            const statusMap: any = {}
            attendance.forEach((a: any) => statusMap[a.user_id] = true)
            setTelecallerStatus(statusMap)
        }

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

  const fetchTimelineData = async (leadId: string) => {
    try {
        const { data: notes } = await supabase.from("notes").select("*, users!notes_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })
        const { data: followUps } = await supabase.from("follow_ups").select("*").eq("lead_id", leadId).order("scheduled_date", { ascending: false })
        const { data: callHistory } = await supabase.from("call_logs").select("*, users!call_logs_user_id_fkey(full_name)").eq("lead_id", leadId).order("created_at", { ascending: false })

        const timeline = [
            ...(notes || []).map((n: any) => ({ type: 'note', id: n.id, title: n.note_type === 'status_change' ? 'Status Change' : 'Note Added', description: n.content, date: n.created_at, icon: <MessageSquare className="h-4 w-4"/>, user: n.users?.full_name || 'Unknown' })),
            ...(followUps || []).map((f: any) => ({ type: 'follow_up', id: f.id, title: 'Follow Up Scheduled', description: `For: ${new Date(f.scheduled_date).toLocaleString()} - ${f.status}`, date: f.created_at, icon: <Calendar className="h-4 w-4"/>, user: 'System' })),
            ...(callHistory || []).map((c: any) => ({ type: 'call', id: c.id, title: 'Call Logged', description: `Outcome: ${c.outcome} (${c.duration_seconds}s)`, date: c.created_at, icon: <Phone className="h-4 w-4"/>, user: c.users?.full_name || 'Unknown' }))
        ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setTimelineData(timeline)
    } catch(e) { console.error("Timeline Error", e) }
  }

  // --- HANDLERS ---
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
        updated_at: new Date().toISOString() // Force update timestamp
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
      
      // Merge new data with existing complex objects (users)
      setLead(prev => prev ? { ...prev, ...updates } as Lead : null)
      toast.success("Lead updated successfully")

    } catch (err) {
      console.error("Error updating lead:", err)
      toast.error("Failed to update lead")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
      setDeleting(true)
      try {
          const { error } = await supabase.from('leads').delete().eq('id', params.id)
          if(error) throw error
          toast.success("Lead deleted successfully")
          router.push('/admin/leads')
      } catch(e) {
          console.error(e)
          toast.error("Failed to delete lead")
          setDeleting(false)
      }
  }

  // --- UTILS ---
  const copyToClipboard = (text: string, label: string) => {
      if(!text) return
      navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
  }

  const makeCall = (phone: string) => { if (phone) window.open(`tel:${phone}`, "_self") }
  const sendEmail = (email: string) => { if (email) window.open(`mailto:${email}`, "_blank") }
  const handlePrint = () => { window.print() }

  const getStatusColor = (status: string) => {
    const map: any = { new: "bg-blue-100 text-blue-800", contacted: "bg-yellow-100 text-yellow-800", Interested: "bg-green-100 text-green-800", Disbursed: "bg-emerald-100 text-emerald-800", Not_Interested: "bg-red-100 text-red-800" }
    return map[status] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const map: any = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-blue-100 text-blue-800 border-blue-200", low: "bg-slate-100 text-slate-800 border-slate-200" }
    return map[priority] || "bg-gray-100 text-gray-800"
  }

  const getSafeValue = (val: any, def: string) => val || def

  const isStale = (lastContacted: string | null) => {
      if(!lastContacted) return true
      const diff = differenceInDays(new Date(), new Date(lastContacted))
      return diff > 7
  }

  const daysInStatus = useMemo(() => {
      if (!lead?.updated_at) return 0
      return differenceInDays(new Date(), new Date(lead.updated_at))
  }, [lead])

  const engagementScore = useMemo(() => {
      if (!timelineData) return 0
      let score = 0
      timelineData.forEach(item => {
          if (item.type === 'call') score += 10
          if (item.type === 'note') score += 5
          if (item.title === 'Status Change') score += 20
      })
      return Math.min(score, 100)
  }, [timelineData])

  const getCurrentStepIndex = () => {
      if (!lead) return 0
      const idx = PIPELINE_STEPS.findIndex(s => s.id.toLowerCase() === lead.status.toLowerCase())
      return idx === -1 ? 0 : idx
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
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
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
                            {/* Assigner Visibility */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger className="cursor-default">
                                        <span className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                                            <User className="h-3.5 w-3.5"/> 
                                            {lead.assigned_user?.full_name || "Unassigned"}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Assigned by: {lead.assigner?.full_name || "System"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
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
                    <span>No contact 7+ days</span>
                </div>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 bg-white">
                <Printer className="h-4 w-4" /> Print
            </Button>
            <Badge variant="outline" className="px-3 py-1.5 text-xs font-mono bg-white text-slate-500">ID: {lead.id.slice(0,8)}</Badge>
        </div>
      </div>

      {/* 2. Pipeline Visualizer */}
      <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-6 pb-6">
              <div className="relative flex items-center justify-between w-full px-4 overflow-x-auto">
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-100 -z-0 min-w-[500px]" />
                  {PIPELINE_STEPS.map((step, index) => {
                      const currentIdx = getCurrentStepIndex();
                      const isActive = index === currentIdx;
                      const isCompleted = index < currentIdx;
                      return (
                          <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2 min-w-[80px]">
                              <div className={`
                                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                  ${isActive ? 'border-blue-600 bg-blue-50 text-blue-600 scale-110 shadow-sm' : ''}
                                  ${isCompleted ? 'border-green-500 bg-green-500 text-white' : ''}
                                  ${!isActive && !isCompleted ? 'border-slate-200 bg-white text-slate-300' : ''}
                              `}>
                                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : 
                                   isActive ? <Circle className="h-4 w-4 fill-current" /> :
                                   <Circle className="h-4 w-4" />}
                              </div>
                              <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-blue-700' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                                  {step.label}
                              </span>
                          </div>
                      )
                  })}
              </div>
          </CardContent>
      </Card>

      {/* 3. Main Tabs Layout */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="bg-white border rounded-lg p-1 shadow-sm inline-flex mb-6 overflow-x-auto max-w-full">
          <TabsList className="h-auto bg-transparent p-0 gap-1">
            {['overview', 'timeline', 'notes', 'calls', 'followups', 'history'].map((tab) => (
                <TabsTrigger 
                    key={tab} 
                    value={tab} 
                    className="px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md capitalize transition-all"
                >
                    {tab === 'history' ? <><History className="h-4 w-4 mr-2" /> Audit Logs</> : tab}
                </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Edit Form */}
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
                    {/* Contact Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" /> Contact Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><Label className="text-xs text-slate-500">Full Name</Label><Input name="name" defaultValue={lead.name} required className="mt-1" /></div>
                            <div><Label className="text-xs text-slate-500">Company</Label><Input name="company" defaultValue={lead.company || ""} className="mt-1" /></div>
                            <div>
                                <Label className="text-xs text-slate-500">Email</Label>
                                <div className="relative mt-1">
                                    <Input name="email" type="email" defaultValue={lead.email || ""} className="pr-8" />
                                    <button type="button" onClick={() => copyToClipboard(lead.email || "", "Email")} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"><Copy className="h-4 w-4"/></button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Phone</Label>
                                <div className="relative mt-1">
                                    <Input name="phone" defaultValue={lead.phone} required className="pr-8" />
                                    <button type="button" onClick={() => copyToClipboard(lead.phone, "Phone")} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"><Copy className="h-4 w-4"/></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Location & Meta */}
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

                    {/* Management */}
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
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 shadow-md" disabled={updating}>
                            {updating ? "Saving Changes..." : <><Save className="w-4 h-4 mr-2"/> Save Changes</>}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* DANGER ZONE */}
              <Card className="border-red-100 bg-red-50/30">
                  <CardHeader>
                      <CardTitle className="text-red-700 text-sm font-bold flex items-center gap-2">
                          <Trash2 className="h-4 w-4" /> Danger Zone
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center">
                      <p className="text-sm text-red-600/80">Permanently delete this lead and all associated history.</p>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">Delete Lead</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the lead
                                <strong> {lead.name}</strong> and remove all data from our servers.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                {deleting ? "Deleting..." : "Confirm Delete"}
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </CardContent>
              </Card>
            </div>

            {/* Right Column: Actions & Stats */}
            <div className="space-y-6">
                
                {/* Engagement Score */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-3xl font-bold">{engagementScore}</span>
                            <span className="text-xs text-slate-500 mb-1">/ 100</span>
                        </div>
                        <Progress value={engagementScore} className="h-2" />
                        
                        {/* Stagnation Indicator */}
                        {daysInStatus > 3 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                <AlertTriangle className="h-3 w-3" />
                                <span>In current status for {daysInStatus} days</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

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
