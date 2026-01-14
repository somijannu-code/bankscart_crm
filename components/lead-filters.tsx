"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Calendar } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface LeadFiltersProps {
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadFilters({ telecallers }: LeadFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Existing States
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [priority, setPriority] = useState(searchParams.get("priority") || "all")
  const [assignedTo, setAssignedTo] = useState(searchParams.get("assigned_to") || "all")
  const [source, setSource] = useState(searchParams.get("source") || "all")
  
  // --- NEW DATE FILTER STATES ---
  const [dateRange, setDateRange] = useState(searchParams.get("date_range") || "all") // all, today, yesterday, custom
  const [customStart, setCustomStart] = useState(searchParams.get("from") || "")
  const [customEnd, setCustomEnd] = useState(searchParams.get("to") || "")
  // -----------------------------

  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})

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
    if (source !== "all") params.set("source", source)

    // --- APPLY DATE FILTERS ---
    if (dateRange !== "all") {
      params.set("date_range", dateRange)
      if (dateRange === "custom") {
        if (customStart) params.set("from", customStart)
        if (customEnd) params.set("to", customEnd)
      }
    }
    // --------------------------

    router.push(`/admin/leads?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    setAssignedTo("all")
    setSource("all")
    
    // Clear Date Filters
    setDateRange("all")
    setCustomStart("")
    setCustomEnd("")
    
    router.push("/admin/leads")
  }

  return (
    <div className="space-y-4">
      {/* Primary Select Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"> 
        
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
            <SelectValue placeholder="Status" />
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
            <SelectItem value="not_eligible">Not Eligible</SelectItem>
            <SelectItem value="self_employed">Self Employed</SelectItem>
            <SelectItem value="nr">Not Reachable</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger>
            <SelectValue placeholder="Telecaller" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Telecallers</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {telecallers.map((telecaller) => (
              <SelectItem key={telecaller.id} value={telecaller.id}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                       title={telecallerStatus[telecaller.id] ? 'Checked in' : 'Not checked in'} />
                  {telecaller.full_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={setSource}>
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="cold_call">Cold Call</SelectItem>
          </SelectContent>
        </Select>

        {/* --- DATE FILTER --- */}
        <div className="relative">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className={dateRange !== "all" ? "border-blue-500 bg-blue-50 text-blue-700" : ""}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <SelectValue placeholder="Created Date" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- CUSTOM DATE RANGE INPUTS --- */}
      {dateRange === "custom" && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
            <Input 
              type="date" 
              value={customStart} 
              onChange={(e) => setCustomStart(e.target.value)} 
              className="h-8 w-auto bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
            <Input 
              type="date" 
              value={customEnd} 
              onChange={(e) => setCustomEnd(e.target.value)} 
              className="h-8 w-auto bg-white"
            />
          </div>
        </div>
      )}

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
