"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, SlidersHorizontal, RefreshCcw, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import { Badge } from "@/components/ui/badge"

export function TelecallerLeadFilters({ initialSearchParams }: { initialSearchParams: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearchParams.search || "")
  const [status, setStatus] = useState(initialSearchParams.status || "all")
  const [priority, setPriority] = useState(initialSearchParams.priority || "all")

  // Sync state with URL
  useEffect(() => {
    setSearch(searchParams.get("search") || "")
    setStatus(searchParams.get("status") || "all")
    setPriority(searchParams.get("priority") || "all")
  }, [searchParams])

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", "1")
    if (value && value !== "all") params.set(key, value)
    else params.delete(key)
    
    startTransition(() => {
      router.push(`/telecaller/leads?${params.toString()}`)
    })
  }

  const applySearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", "1")
    if (search) params.set("search", search)
    else params.delete("search")
    
    startTransition(() => {
      router.push(`/telecaller/leads?${params.toString()}`)
    })
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    startTransition(() => {
      router.push("/telecaller/leads")
    })
  }

  const hasActiveFilters = status !== "all" || priority !== "all" || search !== "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3 p-1">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by name, phone, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white"
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
        </div>

        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <Select value={status} onValueChange={(val) => { setStatus(val); updateFilters('status', val); }}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New Lead</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="Interested">Interested</SelectItem>
              <SelectItem value="Documents_Sent">Docs Sent</SelectItem>
              <SelectItem value="Login">Login</SelectItem>
              <SelectItem value="Disbursed">Disbursed</SelectItem>
              <SelectItem value="Call_Back">Call Back</SelectItem>
              <SelectItem value="nr">Not Reachable</SelectItem>
              <SelectItem value="not_eligible">Not Eligible</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={(val) => { setPriority(val); updateFilters('priority', val); }}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={applySearch} className="bg-slate-900 hover:bg-slate-800" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <SlidersHorizontal className="h-4 w-4 mr-2" />} 
            Filter
          </Button>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} title="Reset" disabled={isPending}>
              <RefreshCcw className="h-4 w-4 text-slate-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 px-1">
          {status !== "all" && (
            <Badge variant="secondary" className="px-2 py-1 text-xs gap-1 cursor-pointer hover:bg-slate-200" onClick={() => updateFilters('status', 'all')}>
              Status: {status} <X className="h-3 w-3" />
            </Badge>
          )}
          {priority !== "all" && (
            <Badge variant="secondary" className="px-2 py-1 text-xs gap-1 cursor-pointer hover:bg-slate-200" onClick={() => updateFilters('priority', 'all')}>
              Priority: {priority} <X className="h-3 w-3" />
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="px-2 py-1 text-xs gap-1 cursor-pointer hover:bg-slate-200" onClick={() => { setSearch(""); applySearch(); }}>
              Search: {search} <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
