"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { 
  Search, Filter, ArrowUpDown, Loader2,
  FileText, ShieldCheck, Download, MoreHorizontal, Eye, CheckCircle, XCircle, Clock
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// --- TYPES ---
type Lead = {
  id: string
  name: string
  phone: string
  email: string | null
  company: string | null
  status: string
  loan_amount: number | null
  created_at: string
  updated_at: string
  source: string | null
  kyc_member_id: string
  assigned_to: string | null // Telecaller ID
  telecaller_name?: string   // Fetched name
}

// --- CONSTANTS ---
const STATUS_OPTS = [
  { label: "All Leads", value: "all" },
  { label: "Transferred to KYC", value: "Transferred to KYC" },
  { label: "Underwriting", value: "Underwriting" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Disbursed", value: "Disbursed" },
]

const triggerGhostClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"

export default function KycLeadsPage() {
  const supabase = createClient()
  const router = useRouter()
  
  // State
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      setCurrentUser(user.id)

      // 1. Fetch leads assigned to this KYC member
      const { data: leadsData, error } = await supabase
        .from("leads")
        .select("*")
        .eq("kyc_member_id", user.id)
        .order("updated_at", { ascending: false })

      if (error) {
        console.error("Error fetching leads:", error)
        setLeads([])
      } else if (leadsData) {
        // 2. Extract Telecaller IDs to fetch their names
        // (This avoids complex joins if FK relationships aren't perfect)
        const telecallerIds = Array.from(new Set(leadsData.map((l) => l.assigned_to).filter(Boolean))) as string[]
        
        let userMap: Record<string, string> = {}

        if (telecallerIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, full_name")
            .in("id", telecallerIds)
          
          if (usersData) {
            userMap = usersData.reduce((acc, curr) => {
              acc[curr.id] = curr.full_name || "Unknown"
              return acc
            }, {} as Record<string, string>)
          }
        }

        // 3. Merge Lead data with Telecaller Names
        const enrichedLeads: Lead[] = leadsData.map((l) => ({
          ...l,
          telecaller_name: l.assigned_to ? userMap[l.assigned_to] || "Unknown" : "Unassigned"
        }))

        setLeads(enrichedLeads)
      }
      setLoading(false)
    }

    fetchLeads()
  }, [supabase, router])

  // --- FILTER & SORT LOGIC ---
  const filteredLeads = useMemo(() => {
    let result = [...leads]

    if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l => 
        l.name.toLowerCase().includes(q) || 
        l.phone.includes(q) ||
        (l.company && l.company.toLowerCase().includes(q))
      )
    }

    result.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime()
      const dateB = new Date(b.updated_at).getTime()
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA
    })

    return result
  }, [leads, statusFilter, searchQuery, sortOrder])

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    return {
      total: leads.length,
      pending: leads.filter(l => ["Transferred to KYC", "Underwriting"].includes(l.status)).length,
      approved: leads.filter(l => l.status === "Approved").length,
      disbursed: leads.filter(l => l.status === "Disbursed").length,
    }
  }, [leads])

  // --- HELPER: STATUS BADGE ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Transferred to KYC":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">New Assignment</Badge>
      case "Underwriting":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">In Review</Badge>
      case "Approved":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Approved</Badge>
      case "Rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Rejected</Badge>
      case "Disbursed":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">Disbursed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—"
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  // Helper to open profile
  const handleOpenProfile = (id: string) => {
    router.push(`/kyc-team/leads/${id}`)
  }

  return (
    <div className="space-y-8 p-6 md:p-8 bg-gray-50/50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            KYC Leads Management
          </h1>
          <p className="text-gray-500 mt-1">Manage verification, underwriting, and approvals.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export List
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <FileText className="h-4 w-4" /> View Guidelines
          </Button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total Assigned</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Disbursed</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{stats.disbursed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* FILTERS & TOOLBAR */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name, phone, or company..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                title="Sort by Date"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MAIN TABLE */}
      <Card className="shadow-md border-0 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-semibold text-gray-600">Applicant Details</TableHead>
                <TableHead className="font-semibold text-gray-600">Status</TableHead>
                <TableHead className="font-semibold text-gray-600">Telecaller</TableHead> {/* NEW COLUMN */}
                <TableHead className="font-semibold text-gray-600">Loan Amount</TableHead>
                <TableHead className="font-semibold text-gray-600">
                  <div className="flex items-center gap-1 cursor-pointer" onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}>
                    Last Updated <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                    <span className="text-sm text-gray-500 mt-2 block">Loading leads...</span>
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                    No leads found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        {/* UPDATED: CLICKABLE NAME */}
                        <span 
                          onClick={() => handleOpenProfile(lead.id)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          {lead.name}
                        </span>
                        <span className="text-xs text-gray-500">{lead.phone}</span>
                        {lead.email && <span className="text-xs text-gray-400">{lead.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(lead.status)}
                    </TableCell>
                    {/* NEW CELL: TELECALLER */}
                    <TableCell>
                      <span className="text-sm text-gray-600 font-medium">
                        {lead.telecaller_name}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-gray-700">
                      {formatCurrency(lead.loan_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(lead.updated_at).toLocaleDateString()}
                      </div>
                      <span className="text-xs">{new Date(lead.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className={triggerGhostClass}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenProfile(lead.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Quick Actions (only if active) */}
                          <DropdownMenuItem disabled={lead.status === "Approved"} onClick={() => router.push(`/kyc-team/leads/${lead.id}?action=approve`)}>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={lead.status === "Rejected"} onClick={() => router.push(`/kyc-team/leads/${lead.id}?action=reject`)}>
                            <XCircle className="mr-2 h-4 w-4 text-red-600" /> Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* PAGINATION INFO */}
      <div className="text-xs text-gray-500 text-center">
        Showing {filteredLeads.length} of {leads.length} records
      </div>
    </div>
  )
}
