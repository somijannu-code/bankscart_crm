"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Search, X, Calendar as CalendarIcon, Filter } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface LeadFiltersProps {
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadFilters({ telecallers }: LeadFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State initialization from URL
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "all")
  const [priority, setPriority] = useState(searchParams.get("priority") || "all")
  const [assignedTo, setAssignedTo] = useState(searchParams.get("assigned_to") || "all")
  const [source, setSource] = useState(searchParams.get("source") || "all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(searchParams.get("date_from") ? new Date(searchParams.get("date_from")!) : undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(searchParams.get("date_to") ? new Date(searchParams.get("date_to")!) : undefined)

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (status !== "all") params.set("status", status)
    if (priority !== "all") params.set("priority", priority)
    if (assignedTo !== "all") params.set("assigned_to", assignedTo)
    if (source !== "all") params.set("source", source)
    if (dateFrom) params.set("date_from", dateFrom.toISOString().split('T')[0])
    if (dateTo) params.set("date_to", dateTo.toISOString().split('T')[0])
    
    router.push(`/admin/leads?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    setAssignedTo("all")
    setSource("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    router.push("/admin/leads")
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3"> 
        
        {/* 1. Search */}
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>

        {/* 2. Status */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="Interested">Interested</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
            <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
            <SelectItem value="Login">Login</SelectItem>
            <SelectItem value="Disbursed">Disbursed</SelectItem>
            <SelectItem value="nr">Not Reachable</SelectItem>
            <SelectItem value="Not_Interested">Not Interested</SelectItem>
          </SelectContent>
        </Select>

        {/* 3. Assignee */}
        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger>
            <SelectValue placeholder="Telecaller" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Telecallers</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {telecallers.map((telecaller) => (
              <SelectItem key={telecaller.id} value={telecaller.id}>
                {telecaller.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 4. Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "PPP") : "From Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
          </PopoverContent>
        </Popover>

        {/* 5. Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "PPP") : "To Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
          </PopoverContent>
        </Popover>

      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={clearFilters} className="h-8">
          <X className="h-4 w-4 mr-2" /> Reset
        </Button>
        <Button onClick={applyFilters} className="h-8">
          <Filter className="h-4 w-4 mr-2" /> Apply Filters
        </Button>
      </div>
    </div>
  )
}
