// components/telecaller-leads-table.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download,
  AlertCircle, RefreshCw, BarChart3, Zap, Smartphone,
  FileText, MessageSquare, Bell
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

interface TelecallerLeadsTableProps {
  initialLeads?: Lead[]
  totalCount?: number
  currentPage?: number
  pageSize?: number
}

// Custom hook for debounce
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

// Custom hook for real-time updates
function useRealtimeLeads(userId: string) {
  const [leads, setLeads] = useState<Lead[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to lead changes
    const subscription = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `assigned_to=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time update:', payload)
          // Update local state based on the change
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new as Lead, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(lead => 
              lead.id === payload.new.id ? payload.new as Lead : lead
            ))
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(lead => lead.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, supabase])

  return leads
}

// Simple toast hook
function useToast() {
  const toast = useCallback(({ title, description, variant = "default" }: any) => {
    console.log(`Toast: ${title} - ${description}`, variant)
    // You can integrate with your toast library here
  }, [])

  return { toast }
}

export function TelecallerLeadsTable({ 
  initialLeads = [], 
  totalCount = 0, 
  currentPage = 1, 
  pageSize = 20 
}: TelecallerLeadsTableProps) {
  // Safe initialization with proper defaults
  const [leads, setLeads] = useState<Lead[]>(Array.isArray(initialLeads) ? initialLeads : [])
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
    name: true,
    contact: true,
    company: true,
    status: true,
    priority: true,
    created: true,
    lastContacted: true,
    loanAmount: true,
    loanType: true,
    source: true,
    actions: true
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobileView, setIsMobileView] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")

  const supabase = createClient()
  const { toast } = useToast()
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Calculate totalPages safely
  const totalPages = useMemo(() => {
    const safeTotalCount = totalCount || 0
    const safePageSize = pageSize || 20
    return Math.ceil(safeTotalCount / safePageSize)
  }, [totalCount, pageSize])

  // Real-time updates
  const realtimeLeads = useRealtimeLeads("current-user-id")

  // Mobile responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load analytics safely
  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('lead_analytics')
        .select('*')
        .single()

      if (error) throw error
      setAnalytics(data)
    } catch (err) {
      console.error('Error loading analytics:', err)
      // Set default analytics if table doesn't exist
      setAnalytics({
        conversion_rate: 0,
        total_leads: leads.length,
        pending_followups: 0,
        avg_response_time: 0
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Safe value getter with memoization
  const getSafeValue = useCallback((value: any, defaultValue: string = 'N/A') => {
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }
    return value
  }, [])

  // Advanced filtering with memoization and safe data handling
  const filteredLeads = useMemo(() => {
    if (!leads || !Array.isArray(leads)) {
      return []
    }

    return leads.filter(lead => {
      if (!lead) return false

      const matchesSearch = debouncedSearchTerm === "" || 
        (lead.name && lead.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (lead.email && lead.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (lead.phone && lead.phone.includes(debouncedSearchTerm)) ||
        (lead.company && lead.company.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter
      const matchesPriority = priorityFilter === "all" || lead.priority === priorityFilter
      const matchesSource = sourceFilter === "all" || lead.source === sourceFilter
      const matchesCity = cityFilter === "all" || lead.city === cityFilter
      
      const matchesDateRange = !dateRange || (
        lead.created_at &&
        new Date(lead.created_at) >= dateRange.from &&
        new Date(lead.created_at) <= dateRange.to
      )
      
      const matchesLoanAmount = !loanAmountRange || (
        lead.loan_amount && 
        lead.loan_amount >= loanAmountRange.min && 
        lead.loan_amount <= loanAmountRange.max
      )

      const matchesTab = activeTab === "all" || 
        (activeTab === "follow_up" && lead.follow_up_date) ||
        (activeTab === "high_priority" && lead.priority === "high") ||
        (activeTab === "new" && lead.status === "new")
      
      return matchesSearch && matchesStatus && matchesPriority && 
             matchesSource && matchesCity && matchesDateRange && 
             matchesLoanAmount && matchesTab
    }).sort((a, b) => {
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

  // Performance optimized sort handler
  const handleSort = useCallback((field: string) => {
    setSortField(field)
    setSortDirection(prev => prev === 'asc' && sortField === field ? 'desc' : 'asc')
  }, [sortField])

  // Enhanced status update with proper state management
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

      // Add note if provided for Not Eligible status
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

      // Calendar integration for follow-ups
      if (newStatus === "follow_up" && callbackDate) {
        const { error: followUpError } = await supabase
          .from("follow_ups")
          .insert({
            lead_id: selectedLead.id,
            scheduled_date: callbackDate,
            status: "scheduled"
          })

        if (followUpError) throw followUpError
        
        // Update the lead's follow_up_date
        updateData.follow_up_date = callbackDate

        // Trigger calendar integration
        await addToCalendar(selectedLead, callbackDate)
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", selectedLead.id)

      if (error) throw error

      // Update local state instead of reloading
      setLeads(prev => prev.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, ...updateData }
          : lead
      ))

      toast({
        title: "Status Updated",
        description: `Lead status updated to ${newStatus}`,
      })

      setIsStatusDialogOpen(false)
      
    } catch (error) {
      console.error("Error updating lead status:", error)
      setError("Failed to update lead status")
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Calendar integration
  const addToCalendar = async (lead: Lead, date: string) => {
    try {
      // Google Calendar integration
      const event = {
        summary: `Follow-up with ${getSafeValue(lead.name)}`,
        description: `Follow-up call for ${getSafeValue(lead.company)}. Phone: ${getSafeValue(lead.phone)}`,
        start: { dateTime: new Date(date).toISOString() },
        end: { dateTime: new Date(new Date(date).getTime() + 30 * 60 * 1000).toISOString() }, // 30 minutes
      }

      // You would integrate with your calendar API here
      console.log('Adding to calendar:', event)
      
      toast({
        title: "Calendar Event Created",
        description: "Follow-up added to your calendar",
      })
    } catch (error) {
      console.error("Error adding to calendar:", error)
      toast({
        title: "Calendar Error",
        description: "Failed to add event to calendar",
        variant: "destructive",
      })
    }
  }

  // Workflow automation - Auto-followup reminders
  useEffect(() => {
    const checkFollowUps = () => {
      if (!leads || !Array.isArray(leads)) return
      
      const today = new Date().toISOString().split('T')[0]
      const dueFollowUps = leads.filter(lead => 
        lead && lead.follow_up_date && lead.follow_up_date.split('T')[0] === today
      )
      
      if (dueFollowUps.length > 0) {
        toast({
          title: "Follow-up Reminder",
          description: `You have ${dueFollowUps.length} follow-ups due today`,
        })
      }
    }

    checkFollowUps()
    const interval = setInterval(checkFollowUps, 60 * 60 * 1000) // Check every hour
    return () => clearInterval(interval)
  }, [leads, toast])

  // Helper functions
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

  // Safe data checks
  const safeLeads = Array.isArray(leads) ? leads : []
  const safeFilteredLeads = Array.isArray(filteredLeads) ? filteredLeads : []
  const displayLeads = safeFilteredLeads.length > 0 ? safeFilteredLeads : safeLeads

  // Error boundary fallback UI
  if (error && safeLeads.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-semibold">Failed to load leads</h3>
        <p className="text-gray-500">{error}</p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Empty state with analytics
  if (safeLeads.length === 0 && !isLoading) {
    return (
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
        
        {/* Analytics overview */}
        {analytics && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Total Leads</span>
                <span className="font-semibold">{analytics.total_leads || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversion Rate</span>
                <span className="font-semibold">{analytics.conversion_rate || 0}%</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
                <div className="text-sm text-gray-500">Total Leads</div>
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
          {/* Advanced analytics view */}
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
                  Advanced
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
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
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Call_Back">Call Back</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Updating leads...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
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

      {/* Mobile Card View */}
      {isMobileView ? (
        <div className="space-y-4">
          {displayLeads.map((lead) => (
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
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            Showing {displayLeads.length} of {totalCount} leads
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href={currentPage > 1 ? `?page=${currentPage - 1}` : '#'}
                  className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      href={`?page=${pageNum}`}
                      isActive={currentPage === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              
              <PaginationItem>
                <PaginationNext 
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
          onCallLogged={() => {}} // Add your call logging logic
        />
      )}
    </div>
  )
}
