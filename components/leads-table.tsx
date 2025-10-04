"use client";

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download, 
  MoreHorizontal, Check, X, AlertCircle, Star,
  TrendingUp, TrendingDown, Activity, MessageSquare,
  FileText, PhoneCall, Send, Tag, Plus, Trash2,
  BarChart3, Users, DollarSign, Target, Zap,
  Layout, Table as TableIcon, Settings, Save,
  AlertTriangle, CheckCircle2, XCircle, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { LeadStatusDialog } from "@/components/lead-status-dialog"
import { QuickActions } from "@/components/quick-actions"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useTelecallerStatus } from "@/hooks/use-telecaller-status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

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
  assigned_to: string | null
  assigned_user: {
    id: string
    full_name: string
  } | null
  city: string | null
  follow_up_date: string | null
  lead_score?: number
  tags?: string[]
}

interface Activity {
  id: string
  type: 'call' | 'email' | 'note' | 'status_change'
  description: string
  created_at: string
  created_by: string
}

interface SavedFilter {
  id: string
  name: string
  filters: any
}

interface LeadsTableProps {
  leads: Lead[]
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadsTable({ leads = [], telecallers = [] }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [scoreFilter, setScoreFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    contact: true,
    company: true,
    status: true,
    priority: true,
    score: true,
    created: true,
    lastContacted: true,
    loanAmount: true,
    loanType: true,
    source: true,
    assignedTo: true,
    tags: true,
    actions: true
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  
  // Saved Filters
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [filterName, setFilterName] = useState("")
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false)
  
  // Tags Management
  const [availableTags, setAvailableTags] = useState<string[]>([
    "VIP", "Hot Lead", "Referral", "Event", "Follow Up", "High Value"
  ])
  const [newTag, setNewTag] = useState("")
  const [selectedLeadForTags, setSelectedLeadForTags] = useState<Lead | null>(null)
  
  // Email/SMS
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showSMSDialog, setShowSMSDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [smsBody, setSmsBody] = useState("")
  
  // Auto-assignment
  const [showAutoAssignDialog, setShowAutoAssignDialog] = useState(false)
  const [autoAssignRules, setAutoAssignRules] = useState({
    enabled: false,
    method: 'round-robin', // round-robin, location, loan-type
    criteria: ''
  })
  
  // Success/Error Messages
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  
  // Duplicate Detection
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false)
  
  const supabase = createClient()

  // Stabilize telecaller IDs array
  const allTelecallerIds = useMemo(() => {
    const ids = [
      ...leads.map(lead => lead.assigned_user?.id).filter(Boolean) as string[],
      ...telecallers.map(t => t.id)
    ]
    return ids.filter((id, index, self) => self.indexOf(id) === index)
  }, [leads, telecallers])

  const { telecallerStatus, loading: statusLoading } = useTelecallerStatus(allTelecallerIds)

  // Calculate Lead Score (0-100)
  const calculateLeadScore = (lead: Lead): number => {
    let score = 0
    
    // Loan amount score (0-30 points)
    if (lead.loan_amount) {
      if (lead.loan_amount >= 5000000) score += 30
      else if (lead.loan_amount >= 2000000) score += 20
      else if (lead.loan_amount >= 1000000) score += 10
    }
    
    // Recency score (0-25 points)
    if (lead.created_at) {
      const daysOld = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
      if (daysOld <= 1) score += 25
      else if (daysOld <= 3) score += 20
      else if (daysOld <= 7) score += 15
      else if (daysOld <= 14) score += 10
      else if (daysOld <= 30) score += 5
    }
    
    // Status score (0-20 points)
    const statusScores: Record<string, number> = {
      'Interested': 20,
      'Documents_Sent': 18,
      'Login': 15,
      'contacted': 12,
      'follow_up': 10,
      'new': 8,
      'Not_Interested': 2,
      'not_eligible': 1
    }
    score += statusScores[lead.status] || 5
    
    // Priority score (0-15 points)
    if (lead.priority === 'high') score += 15
    else if (lead.priority === 'medium') score += 10
    else score += 5
    
    // Source score (0-10 points)
    const sourceScores: Record<string, number> = {
      'referral': 10,
      'website': 8,
      'social_media': 6,
      'other': 3
    }
    score += sourceScores[lead.source?.toLowerCase() || 'other'] || 5
    
    return Math.min(score, 100)
  }

  // Enrich leads with scores
  const enrichedLeads = useMemo(() => {
    return leads.map(lead => ({
      ...lead,
      lead_score: calculateLeadScore(lead),
      tags: lead.tags || []
    }))
  }, [leads])

  // Calculate Dashboard Stats
  const dashboardStats = useMemo(() => {
    const total = enrichedLeads.length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const newToday = enrichedLeads.filter(l => 
      new Date(l.created_at) >= today
    ).length
    
    const contacted = enrichedLeads.filter(l => 
      l.status === 'contacted' || l.status === 'Interested'
    ).length
    
    const converted = enrichedLeads.filter(l => 
      l.status === 'Disbursed'
    ).length
    
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0'
    
    const avgScore = total > 0 
      ? (enrichedLeads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / total).toFixed(0)
      : '0'
    
    const unassigned = enrichedLeads.filter(l => !l.assigned_to).length
    
    const highValue = enrichedLeads.filter(l => 
      (l.loan_amount || 0) >= 2000000
    ).length
    
    const overdue = enrichedLeads.filter(l => 
      l.follow_up_date && new Date(l.follow_up_date) < today
    ).length

    // Status distribution
    const statusDist = enrichedLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total,
      newToday,
      contacted,
      converted,
      conversionRate,
      avgScore,
      unassigned,
      highValue,
      overdue,
      statusDist
    }
  }, [enrichedLeads])

  // Get unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set(enrichedLeads.map(l => l.source).filter(Boolean))
    return Array.from(sources)
  }, [enrichedLeads])

  // Get unique tags
  const uniqueTags = useMemo(() => {
    const tags = new Set(enrichedLeads.flatMap(l => l.tags || []))
    return Array.from(tags)
  }, [enrichedLeads])

  // Filter and sort leads
  const filteredLeads = enrichedLeads.filter(lead => {
    const matchesSearch = searchTerm === "" || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.phone.includes(searchTerm) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    const matchesPriority = priorityFilter === "all" || lead.priority === priorityFilter
    const matchesAssignedTo = assignedToFilter === "all" || 
      (assignedToFilter === "unassigned" && !lead.assigned_to) ||
      lead.assigned_to === assignedToFilter
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter
    
    const matchesScore = scoreFilter === "all" || 
      (scoreFilter === "hot" && (lead.lead_score || 0) >= 80) ||
      (scoreFilter === "warm" && (lead.lead_score || 0) >= 50 && (lead.lead_score || 0) < 80) ||
      (scoreFilter === "cold" && (lead.lead_score || 0) < 50)
    
    const matchesTag = tagFilter === "all" || (lead.tags || []).includes(tagFilter)
    
    return matchesSearch && matchesStatus && matchesPriority && 
           matchesAssignedTo && matchesSource && matchesScore && matchesTag
  }).sort((a, b) => {
    let aValue = a[sortField as keyof Lead]
    let bValue = b[sortField as keyof Lead]
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue === null) return sortDirection === 'asc' ? -1 : 1
    if (bValue === null) return sortDirection === 'asc' ? 1 : -1
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / pageSize)
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Detect Duplicates
  const detectDuplicates = () => {
    const phoneMap = new Map<string, Lead[]>()
    const emailMap = new Map<string, Lead[]>()
    
    enrichedLeads.forEach(lead => {
      if (lead.phone) {
        if (!phoneMap.has(lead.phone)) phoneMap.set(lead.phone, [])
        phoneMap.get(lead.phone)!.push(lead)
      }
      if (lead.email) {
        if (!emailMap.has(lead.email)) emailMap.set(lead.email, [])
        emailMap.get(lead.email)!.push(lead)
      }
    })
    
    const dups: any[] = []
    phoneMap.forEach((leads, phone) => {
      if (leads.length > 1) {
        dups.push({ type: 'phone', value: phone, leads })
      }
    })
    emailMap.forEach((leads, email) => {
      if (leads.length > 1) {
        dups.push({ type: 'email', value: email, leads })
      }
    })
    
    setDuplicates(dups)
    setShowDuplicatesDialog(true)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = Object.keys(visibleColumns).filter(k => visibleColumns[k])
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => 
        headers.map(h => {
          const val = lead[h as keyof Lead]
          return typeof val === 'string' ? `"${val}"` : val
        }).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-export-${new Date().toISOString()}.csv`
    a.click()
  }

  // Save Filter
  const saveCurrentFilter = () => {
    const filter = {
      id: Date.now().toString(),
      name: filterName,
      filters: {
        searchTerm,
        statusFilter,
        priorityFilter,
        assignedToFilter,
        sourceFilter,
        scoreFilter,
        tagFilter
      }
    }
    setSavedFilters([...savedFilters, filter])
    setFilterName("")
    setShowSaveFilterDialog(false)
    
    // Save to localStorage
    localStorage.setItem('savedFilters', JSON.stringify([...savedFilters, filter]))
  }

  // Load Filter
  const loadFilter = (filter: SavedFilter) => {
    setSearchTerm(filter.filters.searchTerm || "")
    setStatusFilter(filter.filters.statusFilter || "all")
    setPriorityFilter(filter.filters.priorityFilter || "all")
    setAssignedToFilter(filter.filters.assignedToFilter || "all")
    setSourceFilter(filter.filters.sourceFilter || "all")
    setScoreFilter(filter.filters.scoreFilter || "all")
    setTagFilter(filter.filters.tagFilter || "all")
  }

  // Load saved filters on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedFilters')
    if (saved) {
      setSavedFilters(JSON.parse(saved))
    }
  }, [])

  // Handle functions
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const toggleRowExpansion = (leadId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(leadId)) {
      newExpanded.delete(leadId)
    } else {
      newExpanded.add(leadId)
    }
    setExpandedRows(newExpanded)
  }

  const handleBulkEmail = async () => {
    if (selectedLeads.length === 0) return
    
    // Implementation would connect to email service
    console.log('Sending email to', selectedLeads.length, 'leads')
    console.log('Subject:', emailSubject)
    console.log('Body:', emailBody)
    
    setShowEmailDialog(false)
    setEmailSubject("")
    setEmailBody("")
  }

  const handleBulkSMS = async () => {
    if (selectedLeads.length === 0) return
    
    // Implementation would connect to SMS service
    console.log('Sending SMS to', selectedLeads.length, 'leads')
    console.log('Message:', smsBody)
    
    setShowSMSDialog(false)
    setSmsBody("")
  }

  const handleBulkAssign = async (telecallerId: string) => {
    if (selectedLeads.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id

      // Update all selected leads
      const updates = selectedLeads.map(leadId => 
        supabase
          .from("leads")
          .update({ 
            assigned_to: telecallerId === 'unassigned' ? null : telecallerId,
            assigned_by: assignedById,
            assigned_at: new Date().toISOString()
          })
          .eq("id", leadId)
      )

      const results = await Promise.all(updates)
      
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw new Error(`Failed to assign ${errors.length} leads`)
      }

      console.log(`Bulk assigned ${selectedLeads.length} leads to ${telecallerId}`)
      setSelectedLeads([])
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk assigning leads:", error)
      alert('Error assigning leads. Please try again.')
    }
  }

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedLeads.length === 0) return

    try {
      // Update status for all selected leads
      const updates = selectedLeads.map(leadId => 
        supabase
          .from("leads")
          .update({ 
            status: newStatus,
            last_contacted: new Date().toISOString()
          })
          .eq("id", leadId)
      )

      // Execute all updates concurrently
      const results = await Promise.all(updates)
      
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw new Error(`Failed to update status for ${errors.length} leads`)
      }

      console.log(`Bulk updated status for ${selectedLeads.length} leads to ${newStatus}`)
      setSelectedLeads([])
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk updating lead status:", error)
      alert('Error updating status. Please try again.')
    }
  }

  const handleBulkAddTag = async (tag: string) => {
    if (selectedLeads.length === 0) return

    try {
      // Update tags for all selected leads
      const updates = selectedLeads.map(async (leadId) => {
        const lead = enrichedLeads.find(l => l.id === leadId)
        const currentTags = lead?.tags || []
        
        // Only add if tag doesn't exist
        if (!currentTags.includes(tag)) {
          return supabase
            .from("leads")
            .update({ 
              tags: [...currentTags, tag]
            })
            .eq("id", leadId)
        }
        return Promise.resolve({ error: null })
      })

      const results = await Promise.all(updates)
      
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw new Error(`Failed to add tag to ${errors.length} leads`)
      }

      console.log(`Added tag "${tag}" to ${selectedLeads.length} leads`)
      setSelectedLeads([])
      window.location.reload()
      
    } catch (error) {
      console.error("Error adding tag:", error)
      alert('Error adding tag. Please try again.')
    }
  }

  const handleAutoAssignLeads = async () => {
    if (!autoAssignRules.enabled || telecallers.length === 0) return

    try {
      const unassignedLeads = enrichedLeads.filter(l => !l.assigned_to)
      
      if (unassignedLeads.length === 0) {
        alert('No unassigned leads found')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id

      let updates: any[] = []

      if (autoAssignRules.method === 'round-robin') {
        // Round-robin distribution
        unassignedLeads.forEach((lead, index) => {
          const telecallerId = telecallers[index % telecallers.length].id
          updates.push(
            supabase
              .from("leads")
              .update({ 
                assigned_to: telecallerId,
                assigned_by: assignedById,
                assigned_at: new Date().toISOString()
              })
              .eq("id", lead.id)
          )
        })
      } else if (autoAssignRules.method === 'workload') {
        // Assign to telecaller with least leads
        const leadCounts = telecallers.map(tc => ({
          id: tc.id,
          count: enrichedLeads.filter(l => l.assigned_to === tc.id).length
        }))

        unassignedLeads.forEach((lead) => {
          // Find telecaller with minimum leads
          const minTelecaller = leadCounts.reduce((min, tc) => 
            tc.count < min.count ? tc : min
          )
          
          updates.push(
            supabase
              .from("leads")
              .update({ 
                assigned_to: minTelecaller.id,
                assigned_by: assignedById,
                assigned_at: new Date().toISOString()
              })
              .eq("id", lead.id)
          )
          
          // Increment count for next iteration
          minTelecaller.count++
        })
      }

      const results = await Promise.all(updates)
      
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        throw new Error(`Failed to auto-assign ${errors.length} leads`)
      }

      console.log(`Auto-assigned ${unassignedLeads.length} leads using ${autoAssignRules.method}`)
      alert(`Successfully auto-assigned ${unassignedLeads.length} leads!`)
      window.location.reload()
      
    } catch (error) {
      console.error("Error auto-assigning leads:", error)
      alert('Error auto-assigning leads. Please try again.')
    }
  }

  const handleAddTag = async (leadId: string, tag: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ 
          tags: [...(enrichedLeads.find(l => l.id === leadId)?.tags || []), tag]
        })
        .eq("id", leadId)

      if (error) throw error
      window.location.reload()
    } catch (error) {
      console.error("Error adding tag:", error)
    }
  }

  const handleRemoveTag = async (leadId: string, tag: string) => {
    try {
      const lead = enrichedLeads.find(l => l.id === leadId)
      const newTags = (lead?.tags || []).filter(t => t !== tag)
      
      const { error } = await supabase
        .from("leads")
        .update({ tags: newTags })
        .eq("id", leadId)

      if (error) throw error
      window.location.reload()
    } catch (error) {
      console.error("Error removing tag:", error)
    }
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { color: 'bg-green-100 text-green-800', label: 'Hot', icon: TrendingUp }
    if (score >= 50) return { color: 'bg-yellow-100 text-yellow-800', label: 'Warm', icon: Activity }
    return { color: 'bg-blue-100 text-blue-800', label: 'Cold', icon: TrendingDown }
  }

  const getSafeValue = (value: any, defaultValue: string = 'N/A') => {
    return value ?? defaultValue
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "new": "bg-blue-100 text-blue-800",
      "contacted": "bg-yellow-100 text-yellow-800",
      "Interested": "bg-green-100 text-green-800",
      "Documents_Sent": "bg-purple-100 text-purple-800",
      "Login": "bg-orange-100 text-orange-800",
      "Disbursed": "bg-green-600 text-white",
      "Not_Interested": "bg-red-100 text-red-800",
      "Call_Back": "bg-indigo-100 text-indigo-800",
      "not_eligible": "bg-red-100 text-red-800",
      "nr": "bg-gray-100 text-gray-800",
      "self_employed": "bg-amber-100 text-amber-800"
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

  if (!leads) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No leads data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-900">{successMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {errorMessage && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-red-900">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.total}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{dashboardStats.newToday}</span> new today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.converted} converted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.avgScore}</div>
            <p className="text-xs text-muted-foreground">
              Out of 100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Value Leads</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.highValue}</div>
            <p className="text-xs text-muted-foreground">
              ₹20L+ loan amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <Layout className="h-4 w-4 mr-2" />
            Kanban
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={detectDuplicates}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Find Duplicates
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Auto-Assign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Auto-Assignment Rules</DialogTitle>
                <DialogDescription>
                  Configure automatic lead assignment rules
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-assign">Enable Auto-Assignment</Label>
                  <Switch
                    id="auto-assign"
                    checked={autoAssignRules.enabled}
                    onCheckedChange={(checked) => 
                      setAutoAssignRules({...autoAssignRules, enabled: checked})
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assignment Method</Label>
                  <Select
                    value={autoAssignRules.method}
                    onValueChange={(value) => 
                      setAutoAssignRules({...autoAssignRules, method: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">
                        <div className="flex flex-col">
                          <span className="font-medium">Round Robin</span>
                          <span className="text-xs text-muted-foreground">Distribute equally among all telecallers</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="workload">
                        <div className="flex flex-col">
                          <span className="font-medium">By Workload</span>
                          <span className="text-xs text-muted-foreground">Assign to telecaller with least leads</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="location">
                        <div className="flex flex-col">
                          <span className="font-medium">By Location</span>
                          <span className="text-xs text-muted-foreground">Match lead city with telecaller (Coming soon)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="loan-type">
                        <div className="flex flex-col">
                          <span className="font-medium">By Loan Type</span>
                          <span className="text-xs text-muted-foreground">Match loan type with specialist (Coming soon)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Auto-Assignment Info</p>
                      <p className="text-blue-700 mt-1">
                        This will automatically assign all unassigned leads to telecallers based on the selected method.
                      </p>
                      <p className="text-blue-700 mt-1">
                        <strong>Unassigned Leads:</strong> {enrichedLeads.filter(l => !l.assigned_to).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  setShowAutoAssignDialog(false)
                  handleAutoAssignLeads()
                }}>
                  <Zap className="h-4 w-4 mr-2" />
                  Run Auto-Assignment Now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Saved Filters Dropdown */}
          {savedFilters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Saved Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {savedFilters.map((filter) => (
                  <DropdownMenuItem key={filter.id} onClick={() => loadFilter(filter)}>
                    {filter.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Save Filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Current Filter</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Filter Name</Label>
                  <Input
                    placeholder="e.g., Hot Leads This Week"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveCurrentFilter} disabled={!filterName}>
                  Save Filter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
              <SelectItem value="Call_Back">Call Back</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Lead Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="hot">🔥 Hot (80+)</SelectItem>
              <SelectItem value="warm">☀️ Warm (50-79)</SelectItem>
              <SelectItem value="cold">❄️ Cold (&lt;50)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source!}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {uniqueTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  <Tag className="h-3 w-3 inline mr-2" />
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {telecallers.map((telecaller) => (
                <SelectItem key={telecaller.id} value={telecaller.id}>
                  {telecaller.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(statusFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all' || 
            scoreFilter !== 'all' || tagFilter !== 'all' || assignedToFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setStatusFilter('all')
                setPriorityFilter('all')
                setSourceFilter('all')
                setScoreFilter('all')
                setTagFilter('all')
                setAssignedToFilter('all')
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium">
                {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
              </span>
              
              <div className="flex flex-wrap gap-2">
                <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Send Email to {selectedLeads.length} Leads</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                          placeholder="Email subject..."
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                          placeholder="Email body..."
                          rows={8}
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkEmail}>
                        <Send className="h-4 w-4 mr-2" />
                        Send Email
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send SMS to {selectedLeads.length} Leads</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                          placeholder="SMS message..."
                          rows={4}
                          value={smsBody}
                          onChange={(e) => setSmsBody(e.target.value)}
                          maxLength={160}
                        />
                        <p className="text-xs text-muted-foreground">
                          {smsBody.length}/160 characters
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkSMS}>
                        <Send className="h-4 w-4 mr-2" />
                        Send SMS
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <User className="h-4 w-4 mr-2" />
                      Assign
                    </Button>
                  </DropdownMenuTrigger>
                  {/* FIX APPLIED: Added forceMount and high z-index class for clipping/stacking issues */}
                  <DropdownMenuContent 
                    forceMount 
                    align="start" 
                    className="z-[9999]" // High z-index to fix potential stacking context issue
                  >
                    <DropdownMenuLabel>Assign to Telecaller</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkAssign('unassigned')}>
                      Unassign All
                    </DropdownMenuItem>
                    {telecallers.map((telecaller) => (
                      <DropdownMenuItem 
                        key={telecaller.id}
                        onClick={() => handleBulkAssign(telecaller.id)}
                      >
                        <div className="flex items-center gap-2">
                          {telecallerStatus[telecaller.id] !== undefined && (
                            <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} />
                          )}
                          {telecaller.full_name}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Check className="h-4 w-4 mr-2" />
                      Update Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('new')}>
                      New
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('contacted')}>
                      Contacted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Interested')}>
                      Interested
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Documents_Sent')}>
                      Documents Sent
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Login')}>
                      Login
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Disbursed')}>
                      Disbursed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Not_Interested')}>
                      Not Interested
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('Call_Back')}>
                      Call Back
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('not_eligible')}>
                      Not Eligible
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('nr')}>
                      NR
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Tag className="h-4 w-4 mr-2" />
                      Add Tags
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Add Tag to Selected</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableTags.map((tag) => (
                      <DropdownMenuItem 
                        key={tag}
                        onClick={() => handleBulkAddTag(tag)}
                      >
                        <Tag className="h-4 w-4 mr-2" />
                        {tag}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedLeads([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table or Kanban View */}
      {viewMode === 'table' ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                    onChange={() => {
                      if (selectedLeads.length === paginatedLeads.length) {
                        setSelectedLeads([])
                      } else {
                        setSelectedLeads(paginatedLeads.map(l => l.id))
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                {visibleColumns.name && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                    Name {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                )}
                {visibleColumns.score && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('lead_score')}>
                    Score {sortField === 'lead_score' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                )}
                {visibleColumns.contact && <TableHead>Contact</TableHead>}
                {visibleColumns.company && <TableHead>Company</TableHead>}
                {visibleColumns.status && <TableHead>Status</TableHead>}
                {visibleColumns.priority && <TableHead>Priority</TableHead>}
                {visibleColumns.loanAmount && <TableHead>Loan Amount</TableHead>}
                {visibleColumns.source && <TableHead>Source</TableHead>}
                {visibleColumns.tags && <TableHead>Tags</TableHead>}
                {visibleColumns.assignedTo && <TableHead>Assigned To</TableHead>}
                {visibleColumns.created && <TableHead>Created</TableHead>}
                {visibleColumns.actions && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => {
                const scoreBadge = getScoreBadge(lead.lead_score || 0)
                const ScoreIcon = scoreBadge.icon
                const isExpanded = expandedRows.has(lead.id)
                
                return (
                  <>
                    <TableRow key={lead.id} className="hover:bg-gray-50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => {
                            if (selectedLeads.includes(lead.id)) {
                              setSelectedLeads(selectedLeads.filter(id => id !== lead.id))
                            } else {
                              setSelectedLeads([...selectedLeads, lead.id])
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(lead.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      {visibleColumns.name && (
                        <TableCell className="font-medium">
                          <Link 
                            href={`/admin/leads/${lead.id}`}
                            className="text-blue-600 hover:underline flex items-center gap-2"
                          >
                            <User className="h-4 w-4" />
                            {lead.name}
                          </Link>
                        </TableCell>
                      )}
                      {visibleColumns.score && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={scoreBadge.color}>
                              <ScoreIcon className="h-3 w-3 mr-1" />
                              {lead.lead_score}
                            </Badge>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.contact && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`tel:${lead.phone}`}>
                                <Phone className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`mailto:${lead.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.company && (
                        <TableCell>{lead.company || 'N/A'}</TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.priority && (
                        <TableCell>
                          <Badge variant={lead.priority === 'high' ? 'destructive' : 'secondary'}>
                            {lead.priority}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.loanAmount && (
                        <TableCell>{formatCurrency(lead.loan_amount)}</TableCell>
                      )}
                      {visibleColumns.source && (
                        <TableCell>{lead.source || 'N/A'}</TableCell>
                      )}
                      {visibleColumns.tags && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(lead.tags || []).slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {(lead.tags || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(lead.tags || []).length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.assignedTo && (
                        <TableCell>
                          {lead.assigned_user ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${telecallerStatus[lead.assigned_user.id] ? 'bg-green-500' : 'bg-red-500'}`} />
                              {lead.assigned_user.full_name}
                            </div>
                          ) : (
                            <span className="text-gray-500">Unassigned</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.created && (
                        <TableCell>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </TableCell>
                      )}
                      {visibleColumns.actions && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/leads/${lead.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Phone className="mr-2 h-4 w-4" />
                                Call Lead
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedLeadForTags(lead)}>
                                <Tag className="mr-2 h-4 w-4" />
                                Manage Tags
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                <span className="text-red-500">Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                    
                    {/* Expandable Activity Timeline Row */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 2}>
                          <Card className="m-2">
                            <CardHeader>
                              <CardTitle className="text-sm">Activity Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-blue-100 rounded-full">
                                    <PhoneCall className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">Last Contact</p>
                                    <p className="text-xs text-muted-foreground">
                                      {lead.last_contacted 
                                        ? new Date(lead.last_contacted).toLocaleString()
                                        : 'Never contacted'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-green-100 rounded-full">
                                    <Calendar className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">Follow-up Date</p>
                                    <p className="text-xs text-muted-foreground">
                                      {lead.follow_up_date 
                                        ? new Date(lead.follow_up_date).toLocaleString()
                                        : 'No follow-up scheduled'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-purple-100 rounded-full">
                                    <FileText className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">Notes & Activities</p>
                                    <p className="text-xs text-muted-foreground">
                                      View full history in lead details
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t">
                                <Button variant="outline" size="sm" asChild className="w-full">
                                  <Link href={`/admin/leads/${lead.id}`}>
                                    View Full Details
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Kanban Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {['new', 'contacted', 'Interested', 'Documents_Sent', 'Disbursed'].map((status) => {
            const statusLeads = filteredLeads.filter(l => l.status === status)
            return (
              <Card key={status}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{status.replace('_', ' ')}</span>
                    <Badge variant="secondary">{statusLeads.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statusLeads.slice(0, 10).map((lead) => {
                    const scoreBadge = getScoreBadge(lead.lead_score || 0)
                    return (
                      <Card key={lead.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <Link 
                              href={`/admin/leads/${lead.id}`}
                              className="font-medium text-sm hover:underline"
                            >
                              {lead.name}
                            </Link>
                            <Badge className={scoreBadge.color} className="text-xs">
                              {lead.lead_score}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(lead.loan_amount)}
                          </p>
                          <div className="flex items-center gap-1">
                            {(lead.tags || []).slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                  {statusLeads.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground">
                      +{statusLeads.length - 10} more
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {viewMode === 'table' && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Duplicate Detection Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate Leads Detected</DialogTitle>
            <DialogDescription>
              {duplicates.length} potential duplicates found
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {duplicates.map((dup, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Duplicate by {dup.type}: {dup.value}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dup.leads.map((lead: Lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(lead.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/leads/${lead.id}`}>View</Link>
                          </Button>
                          <Button size="sm" variant="destructive">
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={!!selectedLeadForTags} onOpenChange={() => setSelectedLeadForTags(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Tags for {selectedLeadForTags?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Tags</Label>
              <div className="flex flex-wrap gap-2">
                {(selectedLeadForTags?.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => handleRemoveTag(selectedLeadForTags!.id, tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add Tag</Label>
              <div className="flex gap-2">
                <Select onValueChange={(value) => handleAddTag(selectedLeadForTags!.id, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags
                      .filter(t => !(selectedLeadForTags?.tags || []).includes(t))
                      .map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
