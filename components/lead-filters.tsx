"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface LeadFiltersProps {
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadFilters({ telecallers }: LeadFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [priority, setPriority] = useState(searchParams.get("priority") || "all")
  const [assignedTo, setAssignedTo] = useState(searchParams.get("assigned_to") || "all")
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})

  // --- NEW FILTER STATES ---
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || "")
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || "")
  const [lastCallFrom, setLastCallFrom] = useState(searchParams.get("last_call_from") || "")
  const [lastCallTo, setLastCallTo] = useState(searchParams.get("last_call_to") || "")
  const [source, setSource] = useState(searchParams.get("source") || "all")
  // -------------------------

  // Fetch telecaller status
  useEffect(() => {
    const fetchTelecallerStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("user_id, check_in")
          .eq("date", today)
        
        if (attendanceRecords) {
          // Create a map of telecaller ID to checked-in status
          const statusMap: Record<string, boolean> = {}
          attendanceRecords.forEach(record => {
            statusMap[record.user_id] = !!record.check_in
          })
          setTelecallerStatus(statusMap)
        }
      } catch (err) {
        console.error("Error fetching telecaller status:", err)
      }
    }

    fetchTelecallerStatus()
  }, [supabase])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (status !== "all") params.set("status", status)
    if (priority !== "all") params.set("priority", priority)
    if (assignedTo !== "all") params.set("assigned_to", assignedTo)

    // --- NEW FILTER PARAMETER APPLICATION ---
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo) params.set("date_to", dateTo)
    if (lastCallFrom) params.set("last_call_from", lastCallFrom)
    if (lastCallTo) params.set("last_call_to", lastCallTo)
    if (source !== "all") params.set("source", source)
    // ----------------------------------------

    router.push(`/admin/leads?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    setAssignedTo("all")

    // --- NEW FILTER CLEARING ---
    setDateFrom("")
    setDateTo("")
    setLastCallFrom("")
    setLastCallTo("")
    setSource("all")
    // ---------------------------
    
    router.push("/admin/leads")
  }

  return (
    <div className="space-y-4">
      {/* Primary Select Filters (can use a larger grid layout for more filters) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"> 
        
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="Interested">Interested</SelectItem>
            <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
            <SelectItem value="Login">Login</SelectItem>
            <SelectItem value="Disbursed">Disbursed</SelectItem>
            <SelectItem value="Not_Interested">Not Interested</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
            <SelectItem value="not_eligible">not eligible</SelectItem>
            <SelectItem value="nr">nr</SelectItem>
            <SelectItem value="self_employed">selfemployed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by telecaller" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Telecallers</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {telecallers.map((telecaller) => (
              <SelectItem key={telecaller.id} value={telecaller.id}>
                <div className="flex items-center gap-2">
                  {/* Status indicator for telecaller */}
                  <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                       title={telecallerStatus[telecaller.id] ? 'Checked in' : 'Not checked in'} />
                  {telecaller.full_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* --- NEW SOURCE FILTER --- */}
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="cold_call">Cold Call</SelectItem>
            {/* Add more source options as needed */}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filters */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-7 pt-2 border-t">
        <Input
          type="date"
          placeholder="Created From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Lead Creation Date From"
        />

        <Input
          type="date"
          placeholder="Created To"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Lead Creation Date To"
        />

        <Input
          type="date"
          placeholder="Last Call From"
          value={lastCallFrom}
          onChange={(e) => setLastCallFrom(e.target.value)}
          title="Last Call Date From"
        />

        <Input
          type="date"
          placeholder="Last Call To"
          value={lastCallTo}
          onChange={(e) => setLastCallTo(e.target.value)}
          title="Last Call Date To"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={applyFilters} className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Apply Filters
        </Button>
        <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2 bg-transparent">
          <X className="h-4 w-4" />
          Clear Filters
        </Button>
      </div>
    </div>
  )
}
