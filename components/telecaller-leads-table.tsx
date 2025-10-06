// components/telecaller-leads-table.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download,
  AlertCircle, RefreshCw, BarChart3, Zap, Smartphone,
  FileText, MessageSquare, Bell, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { LeadStatusDialog } from "@/components/lead-status-dialog"
import { QuickActions } from "@/components/quick-actions"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import Link from "next/link"

// Define the Lead interface
interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  priority: string
  created_at: string
  last_contacted: string | null
  loan_amount: number | null
  loan_type: string | null
  source: string | null
  assignee_id: string | null
  city: string | null
  follow_up_date: string | null
}

// Updated props: requires userId to fetch assigned leads
interface TelecallerLeadsTableProps {
  userId: string
  pageSize?: number
}

// Custom hook for debounce (kept as is)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function TelecallerLeadsTable({ 
  userId, 
  pageSize = 20 
}: TelecallerLeadsTableProps) {
  
  // State for data and fetching
  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0) 
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State for filters, sorting, etc.
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [cityFilter, setCityFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null)
  const [loanAmountRange, setLoanAmountRange] = useState<{ min: number; max: number } | null>(null)
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true, contact: true, company: true, status: true, priority: true, created: true, 
    lastContacted: true, loanAmount: true, loanType: true, source: true, actions: true
  })
  const [isMobileView, setIsMobileView] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [appliedFilters, setAppliedFilters] = useState<string[]>([])

  const supabase = createClient()
  
  // ⭐️ CORRECT DECLARED LOCATION ⭐️
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Function to fetch leads 
  const fetchLeads = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from("leads")
        .select("*", { count: "exact" }) 
        .eq("assignee_id", userId) 

      const { data, count, error } = await query
        .order(sortField, { ascending: sortDirection === "asc" })
        .limit(1000) 

      if (error) {
        throw error
      }

      setLeads(data || [])
      setTotalCount(count || 0)

    } catch (err: any) {
      console.error("Error fetching leads:", err)
      setError(err.message || "Failed to load leads from the server.")
      setLeads([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [userId, sortField, sortDirection]) 

  // Initial data load hook
  useEffect(() => {
    fetchLeads()
  }, [fetchLeads]) 
  
  // Calculate totalPages safely
  const totalPages = useMemo(() => {
    const safeTotalCount = totalCount || 0
    const safePageSize = pageSize || 20
    return Math.ceil((leads.length > 0 ? leads.length : safeTotalCount) / safePageSize)
  }, [totalCount, pageSize, leads.length])

  // Mobile responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load analytics 
  useEffect(() => {
    loadAnalytics()
  }, [leads])

  const loadAnalytics = async () => { 
    try {
      const localTotalLeads = leads.length
      const convertedLeads = leads.filter(lead => 
        ['Interested', 'Documents_Sent', 'Login', 'Disbursed'].includes(lead.status)
      ).length
      const conversionRate = localTotalLeads > 0 ? Math.round((convertedLeads / localTotalLeads) * 100) : 0
      const pendingFollowups = leads.filter(lead => lead.status === 'Call_Back' || lead.follow_up_date).length

      setAnalytics({
        conversion_rate: conversionRate,
        total_leads: localTotalLeads,
        pending_followups: pendingFollowups,
        avg_response_time: 2 
      })
    } catch (err) {
      console.error('Error loading analytics:', err)
      setAnalytics({
        conversion_rate: 0,
        total_leads: leads.length,
        pending_followups: 0,
        avg_response_time: 0
      })
    }
  }

  const getSafeValue = useCallback((value: any, defaultValue: string = 'N/A') => { 
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }
    return value
  }, [])

  useEffect(() => { 
    const filters = []
    if (statusFilter !== "all") filters.push(`Status: ${statusFilter}`)
    if (priorityFilter !== "all") filters.push(`Priority: ${priorityFilter}`)
    if (sourceFilter !== "all") filters.push(`Source: ${sourceFilter}`)
    if (cityFilter !== "all") filters.push(`City: ${cityFilter}`)
    if (dateRange) filters.push(`Date Range: ${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`)
    if (loanAmountRange) filters.push(`Loan: ${loanAmountRange.min} - ${loanAmountRange.max}`)
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (activeTab !== "all") filters.push(`Tab: ${activeTab.replace('_', ' ')}`)

    setAppliedFilters(filters)
  }, [statusFilter, priorityFilter, sourceFilter, cityFilter, dateRange, loanAmountRange, searchTerm, activeTab])

  const clearAllFilters = () => { 
    setSearchTerm("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setSourceFilter("all")
    setCityFilter("all")
    setDateRange(null)
    setLoanAmountRange(null)
    setActiveTab("all")
  }

  const filteredLeads = useMemo(() => { 
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return []
    }

    const filtered = leads.filter(lead => {
      if (!lead) return false

      // Search filter
      const matchesSearch = debouncedSearchTerm === "" || 
        (lead.name && lead.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (lead.email && lead.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (lead.phone && lead.phone.includes(debouncedSearchTerm)) ||
        (lead.company && lead.company.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      
      // Status filter
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter
      
      // Priority filter
      const matchesPriority = priorityFilter === "all" || lead.priority === priorityFilter
      
      // Source filter
      const matchesSource = sourceFilter === "all" || lead.source === sourceFilter
      
      // City filter
      const matchesCity = cityFilter === "all" || lead.city === cityFilter
      
      // Date range filter
      const matchesDateRange = !dateRange || (
        lead.created_at &&
        new Date(lead.created_at) >= dateRange.from &&
        new Date(lead.created_at) <= dateRange.to
      )
      
      // Loan amount filter
      const matchesLoanAmount = !loanAmountRange || (
        lead.loan_amount && 
        lead.loan_amount >= loanAmountRange.min && 
        lead.loan_amount <= loanAmountRange.max
      )

      // Tab filter
      const matchesTab = activeTab === "all" || 
        (activeTab === "follow_up" && lead.follow_up_date) ||
        (activeTab === "high_priority" && lead.priority === "high") ||
        (activeTab === "new" && lead.status === "new")
      
      return matchesSearch && matchesStatus && matchesPriority && 
             matchesSource && matchesCity && matchesDateRange && 
             matchesLoanAmount && matchesTab
    })

    // Sort the filtered results
    return filtered.sort((a, b) => {
      let aValue = a[sortField as keyof Lead]
      let bValue = b[sortField as keyof Lead]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [leads, debouncedSearchTerm, statusFilter, priorityFilter, sourceFilter, cityFilter, dateRange, loanAmountRange, sortField, sortDirection, activeTab])


  const handleSort = useCallback((field: string) => { 
    setSortField(field)
    setSortDirection(prev => prev === 'asc' && sortField === field ? 'desc' : 'asc')
  }, [sortField])
  
  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => { 
    setIsLoading(true)
    setError(null)
    
    try {
      if (!selectedLead?.id) {
        throw new Error("No lead selected")
      }
      
      const updateData: any = { 
        status: newStatus,
        last_contacted: new Date().toISOString()
      }

      if (newStatus === "not_eligible" && note) {
        const { error: noteError } = await supabase
          .from("notes")
          .insert({
            lead_id: selectedLead.id,
            note: note,
            note_type: "status_change"
          })

        if (noteError) throw noteError
      }

      if (newStatus === "follow_up" && callbackDate) {
        const { error: followUpError } = await supabase
          .from("follow_ups")
          .insert({
            lead_id: selectedLead.id,
            scheduled_date: callbackDate,
            status: "scheduled"
          })

        if (followUpError) throw followUpError
        
        updateData.follow_up_date = callbackDate
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", selectedLead.id)

      if (error) throw error

      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, ...updateData }
          : lead
      ))

      setIsStatusDialogOpen(false)
      
    } catch (error) {
      console.error("Error updating lead status:", error)
      setError("Failed to update lead status")
    } finally {
      setIsLoading(false)
    }
  }

  const getPriorityVariant = (priority: string) => { 
    switch (priority) {
      case "high": return "destructive"
      case "medium": return "default"
      case "low": return "secondary"
      default: return "secondary"
    }
  }

  const getStatusColor = (status: string) => { 
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      Interested: "bg-green-100 text-green-800",
      Documents_Sent: "bg-purple-100 text-purple-800",
      Login: "bg-orange-100 text-orange-800",
      Disbursed: "bg-green-100 text-green-800",
      Not_Interested: "bg-red-100 text-red-800",
      Call_Back: "bg-indigo-100 text-indigo-800",
      not_eligible: "bg-red-100 text-red-800",
      nr: "bg-gray-100 text-gray-800",
      self_employed: "bg-amber-100 text-amber-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const formatCurrency = (amount: number | null) => { 
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleCallInitiated = (lead: Lead) => { 
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
  }

  // Safe data checks and display leads
  const safeLeads = Array.isArray(leads) ? leads : []
  const safeFilteredLeads = Array.isArray(filteredLeads) ? filteredLeads : []
  const displayLeads = safeFilteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize) // Apply client-side pagination

  // Error boundary fallback UI
  if (error && safeLeads.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-semibold">Failed to load leads</h3>
        <p className="text-gray-500">{error}</p>
        <Button onClick={() => fetchLeads()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Loading state overlay (new)
  if (isLoading && leads.length === 0) {
    return (
        <div className="text-center py-12 space-y-4">
            <RefreshCw className="h-8 w-8 text-blue-500 mx-auto animate-spin" />
            <h3 className="text-lg font-semibold">Loading Leads...</h3>
            <p className="text-gray-500">Fetching your assigned leads from the server.</p>
        </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header with lead count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Assigned Leads ({totalCount})</h2>
          <p className="text-gray-600 mt-1">Manage and follow up with your assigned leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Create Lead
          </Button>
        </div>
      </div>

      {/* Analytics & Insights Bar */}
      {analytics && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{analytics.conversion_rate || 0}%</div>
                <div className="text-sm text-gray-500">Conversion Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{analytics.total_leads || 0}</div>
                <div className="text-sm text-gray-500">Leads in View</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{analytics.pending_followups || 0}</div>
                <div className="text-sm text-gray-500">Pending Follow-ups</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{analytics.avg_response_time || 0}h</div>
                <div className="text-sm text-gray-500">Avg Response Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different lead views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="all">All Leads</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="follow_up">Follow-up</TabsTrigger>
          <TabsTrigger value="high_priority">High Priority</TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['new', 'contacted', 'interested', 'disbursed'].map(status => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="capitalize">{status}</span>
                      <div className="w-24">
                        <Progress value={Math.random() * 100} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Call Success Rate</span>
                    <span className="font-semibold">68%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Response Rate</span>
                    <span className="font-semibold">45%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Enhanced Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                {/* Advanced Filters Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filters
                      {appliedFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                          {appliedFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Advanced Filters</h4>
                        {appliedFilters.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                            Clear All
                          </Button>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Date Range</label>
                        <CalendarComponent
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Loan Amount Range</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            onChange={(e) => setLoanAmountRange(prev => ({
                              ...prev,
                              min: parseInt(e.target.value) || 0
                            }))}
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            onChange={(e) => setLoanAmountRange(prev => ({
                              ...prev,
                              max: parseInt(e.target.value) || 1000000
                            }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="campaign">Campaign</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="City" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Cities</SelectItem>
                            <SelectItem value="mumbai">Mumbai</SelectItem>
                            <SelectItem value="delhi">Delhi</SelectItem>
                            <SelectItem value="bangalore">Bangalore</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Statuses" />
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
                    <SelectItem value="Call_Back">Call Back</SelectItem>
                    <SelectItem value="not_eligible">Not Eligible</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Columns <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(visibleColumns).map(([key, value]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        className="capitalize"
                        checked={value}
                        onCheckedChange={(checked) =>
                          setVisibleColumns({ ...visibleColumns, [key]: checked })
                        }
                      >
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile view toggle */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMobileView(!isMobileView)}
                  className="lg:hidden"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Applied filters display */}
            {appliedFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-500">Applied filters:</span>
                {appliedFilters.map((filter, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {filter}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        // Implement individual filter removal logic here
                        if (filter.includes('Status:')) setStatusFilter('all')
                        else if (filter.includes('Priority:')) setPriorityFilter('all')
                        else if (filter.includes('Source:')) setSourceFilter('all')
                        else if (filter.includes('City:')) setCityFilter('all')
                        else if (filter.includes('Date Range:')) setDateRange(null)
                        else if (filter.includes('Loan:')) setLoanAmountRange(null)
                        else if (filter.includes('Search:')) setSearchTerm('')
                        else if (filter.includes('Tab:')) setActiveTab('all')
                      }}
                    />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear All
                </Button>
              </div>
            )}

            {/* Loading state indicator for background refresh/filter change */}
            {isLoading && leads.length > 0 && (
              <div className="flex items-center justify-center py-2">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span>Loading leads...</span>
              </div>
            )}

            {/* Error state */}
            {error && leads.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800">{error}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {displayLeads.length} of {totalCount} assigned leads
          {appliedFilters.length > 0 && ` (Filtered: ${safeFilteredLeads.length})`}
        </div>
        {appliedFilters.length > 0 && safeFilteredLeads.length === 0 && (
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear filters to see all leads
          </Button>
        )}
      </div>

      {/* Empty state - only show when there are truly no leads */}
      {totalCount === 0 && !isLoading ? (
        <div className="text-center py-12 space-y-6">
          <FileText className="h-16 w-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-gray-500 mb-4">Get started by importing leads or creating a new one</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button>Import Leads</Button>
            <Button variant="outline">Create Lead</Button>
          </div>
        </div>
      ) : safeFilteredLeads.length === 0 && !isLoading ? (
        // No results after filtering
        <div className="text-center py-12 space-y-6">
          <Search className="h-16 w-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No matching leads found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
          </div>
          <Button variant="outline" onClick={clearAllFilters}>
            Clear all filters
          </Button>
        </div>
      ) : isMobileView ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {displayLeads.map((lead) => ( // Limit for mobile performance
            <Card key={lead.id} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {getSafeValue(lead.name)}
                    </h3>
                    <p className="text-sm text-gray-500">{getSafeValue(lead.company)}</p>
                  </div>
                  <Badge className={getStatusColor(lead.status)}>
                    {getSafeValue(lead.status).replace("_", " ")}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{getSafeValue(lead.phone)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <QuickActions
                    phone={getSafeValue(lead.phone, '')}
                    email={getSafeValue(lead.email, '')}
                    leadId={lead.id}
                    onCallInitiated={() => handleCallInitiated(lead)}
                    compact
                  />
                  <Link href={`/telecaller/leads/${lead.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.name && (
                  <TableHead 
                    className="cursor-pointer" 
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name 
                      {sortField === 'name' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.contact && <TableHead>Contact</TableHead>}
                {visibleColumns.company && (
                  <TableHead 
                    className="cursor-pointer" 
                    onClick={() => handleSort('company')}
                  >
                    <div className="flex items-center gap-1">
                      Company
                      {sortField === 'company' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.status && <TableHead>Status</TableHead>}
                {visibleColumns.priority && <TableHead>Priority</TableHead>}
                {visibleColumns.loanAmount && (
                  <TableHead 
                    className="cursor-pointer" 
                    onClick={() => handleSort('loan_amount')}
                  >
                    <div className="flex items-center gap-1">
                      Loan Amount
                      {sortField === 'loan_amount' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.loanType && <TableHead>Loan Type</TableHead>}
                {visibleColumns.source && <TableHead>Source</TableHead>}
                {visibleColumns.created && (
                  <TableHead 
                    className="cursor-pointer" 
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Created
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.lastContacted && (
                  <TableHead 
                    className="cursor-pointer" 
                    onClick={() => handleSort('last_contacted')}
                  >
                    <div className="flex items-center gap-1">
                      Last Contacted
                      {sortField === 'last_contacted' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
                {visibleColumns.actions && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-gray-50/50">
                  {visibleColumns.name && (
                    <TableCell className="font-medium">
                      <Link href={`/telecaller/leads/${lead.id}`} className="flex items-center gap-2 hover:text-blue-600">
                        <User className="h-4 w-4" />
                        {getSafeValue(lead.name)}
                      </Link>
                    </TableCell>
                  )}
                  {visibleColumns.contact && (
                    <TableCell>
                      <QuickActions
                        phone={getSafeValue(lead.phone, '')}
                        email={getSafeValue(lead.email, '')}
                        leadId={lead.id}
                        onCallInitiated={() => handleCallInitiated(lead)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.company && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        {getSafeValue(lead.company)}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge className={getStatusColor(lead.status)}>
                        {getSafeValue(lead.status).replace("_", " ")}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.priority && (
                    <TableCell>
                      <Badge variant={getPriorityVariant(getSafeValue(lead.priority, 'medium'))}>
                        {getSafeValue(lead.priority).toUpperCase()}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.loanAmount && (
                    <TableCell>
                      {formatCurrency(lead.loan_amount)}
                    </TableCell>
                  )}
                  {visibleColumns.loanType && (
                    <TableCell>
                      {getSafeValue(lead.loan_type)}
                    </TableCell>
                  )}
                  {visibleColumns.source && (
                    <TableCell>
                      {getSafeValue(lead.source)}
                    </TableCell>
                  )}
                  {visibleColumns.created && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.lastContacted && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {lead.last_contacted
                          ? new Date(lead.last_contacted).toLocaleDateString()
                          : "Never"}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.actions && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/telecaller/leads/${lead.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead)
                            setIsStatusDialogOpen(true)
                          }}
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Enhanced Pagination */}
      {totalPages > 1 && safeFilteredLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, safeFilteredLeads.length)} of {safeFilteredLeads.length} leads
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  href={currentPage > 1 ? `?page=${currentPage - 1}` : '#'}
                  className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      href={`?page=${pageNum}`}
                      isActive={currentPage === pageNum}
                      onClick={() => setCurrentPage(pageNum)} 
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  href={currentPage < totalPages ? `?page=${currentPage + 1}` : '#'}
                  className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Status Update Dialog */}
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) setSelectedLead(null)
          }}
          onStatusUpdate={handleStatusUpdate}
          onCallLogged={() => {}} 
        />
      )}
    </div>
  )
}
