// pages/admin/leads/[id]/page (36).tsx
"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"
import { LeadStatusUpdater } from "@/components/lead-status-updater"

// Define types
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
  assigned_user: {
    id: string
    full_name: string
  } | null
  assigner: {
    id: string
    full_name: string
  } | null
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

interface AttendanceRecord {
  user_id: string
  check_in: string | null
}

interface Note {
  id: string
  content: string
  created_at: string
  user: {
    full_name: string
  } | null
}

interface CallLog {
  id: string
  call_type: string
  duration_seconds: number | null
  outcome: string
  created_at: string
  user: {
    full_name: string
  } | null
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
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !currentUser) {
          router.push("/auth/login")
          return
        }

        setUser(currentUser)

        // Get lead data
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", params.id)
          .single()

        if (leadError || !leadData) {
          setError("Lead not found")
          setLoading(false)
          return
        }

        // Fetch assigned user and assigner data separately
        let assignedUserData = null
        let assignerData = null

        if (leadData.assigned_to) {
          const { data: userData } = await supabase
            .from("users")
            .select("id, full_name")
            .eq("id", leadData.assigned_to)
            .single()
          assignedUserData = userData
        }

        if (leadData.assigned_by) {
          const { data: userData } = await supabase
            .from("users")
            .select("id, full_name")
            .eq("id", leadData.assigned_by)
            .single()
          assignerData = userData
        }

        // Combine the data
        const leadWithUserData = {
          ...leadData,
          assigned_user: assignedUserData,
          assigner: assignerData
        }

        setLead(leadWithUserData as Lead)

        // Get telecallers for assignment
        const { data: telecallersData, error: telecallersError } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "telecaller")
          .eq("is_active", true)

        if (!telecallersError && telecallersData) {
          setTelecallers(telecallersData as Telecaller[])
        }

        // Get telecaller status for today
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: attendanceRecords, error: attendanceError } = await supabase
            .from("attendance")
            .select("user_id, check_in")
            .eq("date", today)
          
          if (!attendanceError && attendanceRecords) {
            // Create a map of telecaller ID to checked-in status
            const statusMap = attendanceRecords.reduce((acc: Record<string, boolean>, record: AttendanceRecord) => {
              acc[record.user_id] = !!record.check_in
              return acc
            }, {} as Record<string, boolean>)
            setTelecallerStatus(statusMap)
          }
        } catch (err) {
          console.error("Error fetching telecaller status:", err)
        }

        // Get notes for this lead
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .eq("lead_id", params.id)
          .order("created_at", { ascending: false })

        if (!notesError && notesData) {
          // Fetch user data for each note
          const notesWithUserData = await Promise.all(notesData.map(async (note: any) => {
            if (note.user_id) {
              const { data: userData } = await supabase
                .from("users")
                .select("full_name")
                .eq("id", note.user_id)
                .single()
              return { ...note, user: userData }
            }
            return note
          }))
          setNotes(notesWithUserData as Note[])
        }

        // Get call history
        const { data: callHistoryData, error: callHistoryError } = await supabase
          .from("call_logs")
          .select("*")
          .eq("lead_id", params.id)
          .order("created_at", { ascending: false })

        if (!callHistoryError && callHistoryData) {
          // Fetch user data for each call log
          const callHistoryWithUserData = await Promise.all(callHistoryData.map(async (call: any) => {
            if (call.user_id) {
              const { data: userData } = await supabase
                .from("users")
                .select("full_name")
                .eq("id", call.user_id)
                .single()
              return { ...call, user: userData }
            }
            return call
          }))
          setCallHistory(callHistoryWithUserData as CallLog[])
        }

        // Fetch timeline data (notes, follow-ups, calls)
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
    try {
      // Fetch notes
      const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("*, users!notes_user_id_fkey(full_name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })

      if (notesError) console.error("Error fetching notes:", notesError)
      
      // Fetch follow-ups
      const { data: followUps, error: followUpsError } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("lead_id", leadId)
        .order("scheduled_date", { ascending: false })

      if (followUpsError) console.error("Error fetching follow-ups:", followUpsError)

      // Fetch call history
      const { data: callHistory, error: callHistoryError } = await supabase
        .from("call_logs")
        .select("*, users!call_logs_user_id_fkey(full_name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })

      if (callHistoryError) console.error("Error fetching call history:", callHistoryError)

      // Combine all data into a timeline
      const timeline = [
        ...(notes || []).map((note: any) => ({
          type: "note",
          id: note.id,
          title: note.note_type === "status_change" ? "Status changed" : "Note added", // Logic to identify status change
          description: note.content || "No description",
          user: note.users?.full_name || "Unknown",
          date: note.created_at,
          icon: <MessageSquare className="h-4 w-4" />,
        })),
        ...(followUps || []).map((followUp: any) => ({
          type: "follow_up",
          id: followUp.id,
          title: "Follow-up scheduled",
          description: `Scheduled for ${followUp.scheduled_date ? new Date(followUp.scheduled_date).toLocaleString() : "Unknown date"} - Status: ${followUp.status || "unknown"}`,
          user: "You",
          date: followUp.created_at,
          icon: <Calendar className="h-4 w-4" />,
        })),
        ...(callHistory || []).map((call: any) => ({
          type: "call",
          id: call.id,
          title: "Call made",
          description: `Duration: ${call.duration_seconds || "N/A"} seconds, Outcome: ${call.outcome || "N/A"}`,
          user: call.users?.full_name || "Unknown",
          date: call.created_at,
          icon: <Phone className="h-4 w-4" />,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setTimelineData(timeline)
    } catch (error) {
      console.error("Error fetching timeline data:", error)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUpdating(true)
    
    try {
      const formData = new FormData(event.currentTarget)
      
      // Handle assigned_to field properly
      const assignedToValue = formData.get("assigned_to") as string
      const assignedTo = assignedToValue === "unassigned" ? null : assignedToValue || null

      const updates = {
        name: formData.get("name") as string,
        email: (formData.get("email") as string) || null,
        phone: formData.get("phone") as string,
        company: (formData.get("company") as string) || null,
        designation: (formData.get("designation") as string) || null,
        address: (formData.get("address") as string) || null,
        city: (formData.get("city") as string) || null,
        state: (formData.get("state") as string) || null,
        country: (formData.get("country") as string) || null,
        zip_code: (formData.get("zip_code") as string) || null,
        status: formData.get("status") as string,
        priority: formData.get("priority") as string,
        assigned_to: assignedTo,
        source: (formData.get("source") as string) || null,
        notes: (formData.get("notes") as string) || null,
      }
      
      const newStatus = formData.get("status") as string
      const currentStatus = lead?.status

      const supabase = createClient()
      const { error } = await supabase.from("leads").update(updates).eq("id", params.id)

      if (error) {
        console.error("Error updating lead:", error)
        alert("Failed to update lead. Please try again.")
      } else {
        // --- ADDED: Log status change if updated via the general form ---
        if (newStatus !== currentStatus && user) {
            const statusChangeNoteContent = `Status changed from ${currentStatus} to ${newStatus} (via Lead Information form save).`
            const { error: noteError } = await supabase.from("notes").insert({
                lead_id: params.id,
                user_id: user.id,
                content: statusChangeNoteContent,
                note_type: "status_change", // Critical for timeline recognition
            })
            if (noteError) console.error("Error logging status change note from form:", noteError)
        }
        // --- END ADDED ---
        
        // Refresh the lead data after update
        const { data: updatedLead } = await supabase
          .from("leads")
          .select("*, assigned_user:users!leads_assigned_to_fkey(id, full_name), assigner:users!leads_assigned_by_fkey(id, full_name)")
          .eq("id", params.id)
          .single()
        
        if (updatedLead) {
            // Manually structure the fetched data to match the Lead interface
            const leadWithUserData = {
                ...updatedLead,
                assigned_user: updatedLead.assigned_user || null,
                assigner: updatedLead.assigner || null,
            }
            setLead(leadWithUserData as Lead)
            // Re-fetch timeline to include the new status change note
            await fetchTimelineData(params.id, supabase)
        }
        
        alert("Lead updated successfully!")
      }
    } catch (err) {
      console.error("Error updating lead:", err)
      alert("Failed to update lead. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  const getSafeValue = (value: any, defaultValue = "N/A") => {
    return value ?? defaultValue
  }

  const getStatusColor = (status: string) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      Interested: "bg-green-100 text-green-800",
      Documents_Sent: "bg-purple-100 text-purple-800",
      Login: "bg-orange-100 text-orange-800",
      Disbursed: "bg-emerald-100 text-emerald-800",
      Not_Interested: "bg-red-100 text-red-800",
      Call_Back: "bg-indigo-100 text-indigo-800",
      not_eligible: "bg-red-100 text-red-800",
      nr: "bg-gray-100 text-gray-800",
      self_employed: "bg-amber-100 text-amber-800",
    }
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    }
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const makeCall = (phone: string) => {
    if (phone && phone !== "N/A") {
      if (typeof window !== "undefined") {
        window.open(`tel:${phone}`, "_self")
      }
    }
  }

  const sendEmail = (email: string) => {
    if (email && email !== "N/A") {
      if (typeof window !== "undefined") {
        window.open(`mailto:${email}`, "_blank")
      }
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
          <Link href="/admin/leads">
            <Button variant="outline" className="mt-4 bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Lead not found</p>
          <Link href="/admin/leads">
            <Button variant="outline" className="mt-4 bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/leads">
          <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back to Leads
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{getSafeValue(lead.name, "Unknown Lead")}</h1>
          <p className="text-gray-600 mt-1">Lead Details & Management</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="calls">Call History</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lead Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Lead Information
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(getSafeValue(lead.status, "new"))}>
                        {getSafeValue(lead.status, "new").replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge className={getPriorityColor(getSafeValue(lead.priority, "medium"))}>
                        {getSafeValue(lead.priority, "medium").toUpperCase()}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input id="name" name="name" defaultValue={lead.name} required />
                      </div>
                      <div>
                        <Label htmlFor="company">Company</Label>
                        <Input id="company" name="company" defaultValue={lead.company || ""} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" defaultValue={lead.email || ""} />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <Input id="phone" name="phone" defaultValue={lead.phone} required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="designation">Designation</Label>
                        <Input id="designation" name="designation" defaultValue={lead.designation || ""} />
                      </div>
                      <div>
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source"
                          name="source"
                          defaultValue={lead.source || ""}
                          placeholder="e.g., Website, Referral, Cold Call"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Textarea id="address" name="address" defaultValue={lead.address || ""} rows={2} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" name="city" defaultValue={lead.city || ""} />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input id="state" name="state" defaultValue={lead.state || ""} />
                      </div>
                      <div>
                        <Label htmlFor="zip_code">Zip Code</Label>
                        <Input id="zip_code" name="zip_code" defaultValue={lead.zip_code || ""} />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" name="country" defaultValue={lead.country || ""} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select name="status" defaultValue={lead.status || "new"}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="Interested">Interested</SelectItem>
                            <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
                            <SelectItem value="Login">Login</SelectItem>
                            <SelectItem value="Disbursed">Disbursed</SelectItem>
                            <SelectItem value="Not_Interested">Not Interested</SelectItem>
                            <SelectItem value="Call_Back">Call Back</SelectItem>
                            <SelectItem value="not_eligible">Not Eligible</SelectItem>
                            <SelectItem value="nr">NR</SelectItem>
                            <SelectItem value="self_employed">Self Employed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Select name="priority" defaultValue={lead.priority || "medium"}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="assigned_to">Assign To</Label>
                        <Select name="assigned_to" defaultValue={lead.assigned_to || "unassigned"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select telecaller" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {telecallers?.map((telecaller) => (
                              <SelectItem key={telecaller.id} value={telecaller.id}>
                                <div className={`flex items-center gap-2`}>
                                  {/* Status indicator for telecaller */}
                                  <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                                       title={telecallerStatus[telecaller.id] ? 'Checked in' : 'Not checked in'} />
                                  {telecaller.full_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" name="notes" defaultValue={lead.notes || ""} rows={3} />
                    </div>

                    <Button type="submit" className="w-full" disabled={updating}>
                      {updating ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Recent Activity Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineData.length > 0 ? (
                    <div className="space-y-4">
                      {timelineData.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-start gap-3">
                          <div className="mt-1 p-1 bg-gray-100 rounded-full">{item.icon}</div>
                          <div className="flex-1">
                            <p className="font-medium">{getSafeValue(item.title)}</p>
                            <p className="text-sm text-gray-600">{getSafeValue(item.description)}</p>
                            <p className="text-xs text-gray-500">
                              By {getSafeValue(item.user)} •{" "}
                              {item.date ? new Date(item.date).toLocaleString() : "Unknown date"}
                            </p>
                          </div>
                        </div>
                      ))}
                      {timelineData.length > 5 && (
                        <Button
                          variant="link"
                          onClick={() => {
                            const timelineTab = document.querySelector('[data-value="timeline"]') as HTMLElement
                            if (timelineTab) timelineTab.click()
                          }}
                        >
                          View all activities
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No recent activity</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actions Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => makeCall(lead.phone)}
                    className="w-full flex items-center gap-2"
                    disabled={!lead.phone || lead.phone === "N/A"}
                  >
                    <Phone className="h-4 w-4" />
                    Call Now
                  </Button>
                  {lead.email && lead.email !== "N/A" && (
                    <Button
                      variant="outline"
                      onClick={() => sendEmail(lead.email)}
                      className="w-full flex items-center gap-2 bg-transparent"
                    >
                      <Mail className="h-4 w-4" />
                      Send Email
                    </Button>
                  )}
                  <Link href={`/admin/leads/${lead.id}/follow-up`}>
                    <Button variant="outline" className="w-full flex items-center gap-2 bg-transparent">
                      <Calendar className="h-4 w-4" />
                      Schedule Follow-up
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <LeadStatusUpdater leadId={lead.id} currentStatus={lead.status} leadPhoneNumber={lead.phone} telecallerName={user?.full_name || "Unknown"} onStatusUpdate={() => fetchTimelineData(params.id, createClient())} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lead Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge className={getStatusColor(getSafeValue(lead.status, "new"))}>
                      {getSafeValue(lead.status, "new").replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Priority:</span>
                    <Badge className={getPriorityColor(getSafeValue(lead.priority, "medium"))}>
                      {getSafeValue(lead.priority, "medium")}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="text-sm">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Last Contacted:</span>
                    <span className="text-sm">
                      {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Status Changes:</span>
                    <span className="text-sm">{timelineData.filter((item) => item.title === "Status changed").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Notes:</span>
                    <span className="text-sm">{timelineData.filter((item) => item.type === "note").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Calls:</span>
                    <span className="text-sm">{timelineData.filter((item) => item.type === "call").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Follow-ups:</span>
                    <span className="text-sm">{timelineData.filter((item) => item.type === "follow_up").length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Complete Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineView data={timelineData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notes & Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadNotes leadId={lead.id} userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadCallHistory leadId={lead.id} userId={user?.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUpsList leadId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
