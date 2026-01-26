"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, SlidersHorizontal, RefreshCcw } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export function TelecallerLeadFilters({ initialSearchParams }: { initialSearchParams: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(initialSearchParams.search || "")
  const [status, setStatus] = useState(initialSearchParams.status || "all")
  const [priority, setPriority] = useState(initialSearchParams.priority || "all")

  useEffect(() => {
    setSearch(searchParams.get("search") || "")
    setStatus(searchParams.get("status") || "all")
    setPriority(searchParams.get("priority") || "all")
  }, [searchParams])

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", "1") // Reset page on filter

    if (search) params.set("search", search); else params.delete("search")
    if (status !== "all") params.set("status", status); else params.delete("status")
    if (priority !== "all") params.set("priority", priority); else params.delete("priority")

    router.push(`/telecaller/leads?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setStatus("all")
    setPriority("all")
    router.push("/telecaller/leads")
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 p-1">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Search by name, phone, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white"
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
      </div>

      <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
        <Select value={status} onValueChange={setStatus}>
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

        <Select value={priority} onValueChange={setPriority}>
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

        <Button onClick={applyFilters} className="bg-slate-900 hover:bg-slate-800">
          <SlidersHorizontal className="h-4 w-4 mr-2" /> Filter
        </Button>
        <Button variant="outline" onClick={clearFilters} title="Reset">
          <RefreshCcw className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </div>
  )
}
