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
import { // <--- FIXED SYNTAX ERROR HERE
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
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([]) // Preserved state
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  
  // State for single-lead actions
  const [isCallInitiated, setIsCallInitiated] = useState(false)
  
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
    method: 'round-robin', // round-robin, workload, location, loan-type
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
  
  // --- START: Missing Utility Functions ---

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId) 
        : [...prev, leadId]
    )
  }

  const selectAllLeads = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedLeads(paginatedLeads.map(lead => lead.id))
    } else {
      setSelectedLeads([])
    }
  }
  
  // Handlers for single-lead status and action
  const handleStatusUpdate = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, last_contacted: new Date().toISOString() })
        .eq("id", leadId)
      
      if (error) throw error
      console.log(`Lead ${leadId} status updated to ${newStatus}`)
      window.location.reload()
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const handleStatusChange = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
  }

  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsCallInitiated(true)
    setIsStatusDialogOpen(true)
  }

  const handleCallLogged = async (leadId: string, duration: number, notes: string) => {
    // Logic to log the call activity
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const createdBy = user?.id || 'system'
        
        await supabase.from("activities").insert({
            lead_id: leadId,
            type: 'call',
            description: `Call logged. Duration: ${duration}s. Notes: ${notes}`,
            created_by: createdBy
        })
        
        // Update lead's last contacted time
        await supabase.from("leads").update({ last_contacted: new Date().toISOString() }).eq("id", leadId)
        
        console.log(`Call logged for lead ${leadId}`)
        window.location.reload()
    } catch (error) {
        console.error("Error logging call:", error)
    }
  }
  
  // --- END: Missing Utility Functions ---


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

  // --- START: Leads Assignment Functions from leads-table (7).tsx ---

  const handleAssignLead = async (leadId: string, telecallerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id

      const { error } = await supabase
        .from("leads")
        .update({ 
          assigned_to: telecallerId === "unassigned" ? null : telecallerId,
          assigned_by: assignedById,
          assigned_at: new Date().toISOString()
        })
        .eq("id", leadId)

      if (error) throw error

      console.log(`Lead ${leadId} assigned to ${telecallerId}`)
      window.location.reload()
      
    } catch (error) {
      console.error("Error assigning lead:", error)
    }
  }

  // Bulk assignment function using round-robin logic (from leads-table (7).tsx)
  const handleBulkAssign = async () => {
    // Check if any telecallers or leads are selected
    if (bulkAssignTo.length === 0 || selectedLeads.length === 0) return

    try {
      // Get the current user ID once
      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id

      const updates: any[] = []
      const telecallerIds = bulkAssignTo; // bulkAssignTo is already an array

      // Distribute leads equally among telecallers using round-robin
      selectedLeads.forEach((leadId, index) => {
          const telecallerId = telecallerIds[index % telecallerIds.length];
          updates.push({
              id: leadId,
              assigned_to: telecallerId,
              assigned_by: assignedById,
              assigned_at: new Date().toISOString()
          });
      });

      // Execute all updates concurrently
      const results = await Promise.all(
          updates.map(update => 
              supabase
                  .from("leads")
                  .update({
                      assigned_to: update.assigned_to,
                      assigned_by: update.assigned_by,
                      assigned_at: update.assigned_at
                  })
                  .eq("id", update.id)
          )
      );
      
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
          throw new Error(`Failed to assign ${errors.length} leads`)
      }

      console.log(`Bulk assigned ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setBulkAssignTo([]) // Reset state to an empty array
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk assigning leads:", error)
    }
  }
  
  // --- END: Leads Assignment Functions from leads-table (7).tsx ---


  // NOTE: Keeping the handleBulkStatusUpdate from leads-table (6).tsx 
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
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages (from 6) */}
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
      
      {/* Quick Stats Dashboard (from 6) */}
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
            <CardTitle className="text-sm font-medium">Unassigned Leads</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.unassigned}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-500">{dashboardStats.overdue}</span> overdue follow-ups
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Controls Section (from 6) */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'table' | 'kanban')}>
            <TabsList>
              <TabsTrigger value="table"><TableIcon className="h-4 w-4 mr-2" /> Table View</TabsTrigger>
              <TabsTrigger value="kanban"><Layout className="h-4 w-4 mr-2" /> Kanban View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <div className="relative w-full sm:w-64 lg:w-auto">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search leads..." 
              className="pl-8" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>

          {/* Filters Dropdown (from 6) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-3 space-y-3">
              <DropdownMenuLabel>Filter Leads</DropdownMenuLabel>
              <Separator />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.keys(dashboardStats.statusDist).map(status => (
                    <SelectItem key={status} value={status}>
                      {status} ({dashboardStats.statusDist[status]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
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

              <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Telecallers</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {telecallers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Lead Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="hot">Hot (80+)</SelectItem>
                  <SelectItem value="warm">Warm (50-79)</SelectItem>
                  <SelectItem value="cold">Cold (0-49)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {uniqueTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Saved Filters Dropdown (from 6) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Save className="h-4 w-4" /> Saved Filters ({savedFilters.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Load Saved Filter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedFilters.length === 0 ? (
                <DropdownMenuItem disabled>No saved filters</DropdownMenuItem>
              ) : (
                savedFilters.map(filter => (
                  <DropdownMenuItem key={filter.id} onClick={() => loadFilter(filter)}>
                    {filter.name}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Plus className="h-4 w-4 mr-2" /> Save Current Filter
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Current Filter</DialogTitle>
                    <DialogDescription>
                      Name this filter set to easily apply it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="filter-name">Filter Name</Label>
                    <Input id="filter-name" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowSaveFilterDialog(false)} variant="outline">Cancel</Button>
                    <Button onClick={saveCurrentFilter} disabled={!filterName}>Save Filter</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Columns Visibility Dropdown (from 6) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.keys(visibleColumns).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={visibleColumns[column]}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, [column]: checked }))
                  }
                >
                  {column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> CSV
          </Button>

          {/* Auto-Assignment Dialog (from 6) */}
          <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="flex items-center gap-2">
                <Zap className="h-4 w-4" /> Auto Assign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lead Auto-Assignment Rules</DialogTitle>
                <DialogDescription>
                  Configure how unassigned leads are automatically distributed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-assign-toggle">Auto-Assignment Enabled</Label>
                  <Switch 
                    id="auto-assign-toggle"
                    checked={autoAssignRules.enabled}
                    onCheckedChange={(checked) => setAutoAssignRules(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Assignment Method</Label>
                  <Select 
                    value={autoAssignRules.method} 
                    onValueChange={(value) => setAutoAssignRules(prev => ({ ...prev, method: value as 'round-robin' | 'workload' | 'location' | 'loan-type' }))}
                    disabled={!autoAssignRules.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">Round Robin (Even distribution)</SelectItem>
                      <SelectItem value="workload">Least Workload (To telecaller with fewest leads)</SelectItem>
                      <SelectItem value="location">Location-based (Requires lead location data)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Criteria (Optional)</Label>
                  <Input 
                    placeholder="e.g., Only for 'High' Priority Leads" 
                    disabled={!autoAssignRules.enabled}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setShowAutoAssignDialog(false)} variant="outline">Close</Button>
                <Button onClick={handleAutoAssignLeads} disabled={!autoAssignRules.enabled || telecallers.length === 0}>
                  Run Assignment Now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Actions Bar (from 6) */}
      {selectedLeads.length > 0 && (
        <Card className="p-3 bg-primary-100 border-primary-300">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default" className="text-base font-semibold">
              {selectedLeads.length} Leads Selected
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-1">
                  <User className="h-4 w-4" /> Bulk Assign
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-3 space-y-2">
                <DropdownMenuLabel>Select Telecallers for Round Robin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* NOTE: You need to integrate a MultiSelect component here
                For now, using a placeholder for setting bulkAssignTo state */}
                <div className="space-y-2">
                  <Label>Telecallers (IDs for Round-Robin):</Label>
                  <Input 
                    placeholder="e.g., id1,id2,id3" 
                    value={bulkAssignTo.join(',')}
                    onChange={(e) => setBulkAssignTo(e.target.value.split(',').map(id => id.trim()).filter(Boolean))}
                  />
                  <small className="text-gray-500">
                    Enter comma-separated Telecaller IDs. Leads will be distributed in a round-robin fashion.
                  </small>
                </div>

                <Button 
                  onClick={handleBulkAssign} 
                  disabled={bulkAssignTo.length === 0} 
                  className="w-full"
                >
                  Assign {selectedLeads.length} Leads
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-4 w-4" /> Bulk Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-3 space-y-2">
                <DropdownMenuLabel>Change Status To:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
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
                <Button onClick={() => handleBulkStatusUpdate(bulkStatus)} disabled={!bulkStatus} className="w-full">
                  Update Status
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-1">
                  <Tag className="h-4 w-4" /> Bulk Tags
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-3 space-y-2">
                <DropdownMenuLabel>Add Tag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Select onValueChange={handleBulkAddTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Tag to Add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-1">
                  <Send className="h-4 w-4" /> Bulk Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Bulk Email</DialogTitle>
                  <DialogDescription>
                    Email will be sent to the {selectedLeads.length} selected leads.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                  <Textarea placeholder="Email Body" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} />
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowEmailDialog(false)} variant="outline">Cancel</Button>
                  <Button onClick={handleBulkEmail} disabled={!emailSubject || !emailBody}>Send Email</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> Bulk SMS
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Bulk SMS</DialogTitle>
                  <DialogDescription>
                    SMS will be sent to the {selectedLeads.length} selected leads.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea placeholder="SMS Body (max 160 chars)" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={4} maxLength={160} />
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowSMSDialog(false)} variant="outline">Cancel</Button>
                  <Button onClick={handleBulkSMS} disabled={!smsBody}>Send SMS</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </Card>
      )}

      {/* Table/Kanban View (from 6) */}
      {viewMode === 'table' ? (
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                    onChange={selectAllLeads}
                  />
                </TableHead>
                <TableHead className="w-[40px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('lead_score')} className="flex items-center">
                    Score {sortField === 'lead_score' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                  </Button>
                </TableHead>
                {visibleColumns.name && <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="flex items-center">
                    Name {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                  </Button>
                </TableHead>}
                {visibleColumns.contact && <TableHead>Contact</TableHead>}
                {visibleColumns.company && <TableHead>Company/City</TableHead>}
                {visibleColumns.status && <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="flex items-center">
                    Status {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                  </Button>
                </TableHead>}
                {visibleColumns.priority && <TableHead>Priority</TableHead>}
                {visibleColumns.loanAmount && <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('loan_amount')} className="flex items-center justify-end w-full">
                    Loan Amount {sortField === 'loan_amount' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                  </Button>
                </TableHead>}
                {visibleColumns.assignedTo && <TableHead>Assigned To</TableHead>}
                {visibleColumns.tags && <TableHead>Tags</TableHead>}
                {visibleColumns.created && <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('created_at')} className="flex items-center">
                    Created {sortField === 'created_at' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}
                  </Button>
                </TableHead>}
                {visibleColumns.actions && <TableHead className="text-right w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => (
                <React.Fragment key={lead.id}>
                  <TableRow className={selectedLeads.includes(lead.id) ? "bg-blue-50" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      <Badge className={getScoreBadge(lead.lead_score || 0).color}>
                        {getScoreBadge(lead.lead_score || 0).label}
                      </Badge>
                      <Progress value={lead.lead_score || 0} className="h-1 mt-1" />
                    </TableCell>
                    {visibleColumns.name && (
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline">
                          {lead.name}
                        </Link>
                        {lead.follow_up_date && new Date(lead.follow_up_date) < new Date() && (
                          <Badge variant="destructive" className="ml-2">Overdue</Badge>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.contact && (
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <a href={`tel:${lead.phone}`} className="hover:underline">{getSafeValue(lead.phone)}</a>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <a href={`mailto:${lead.email}`} className="hover:underline">{getSafeValue(lead.email)}</a>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.company && <TableCell>{getSafeValue(lead.company)} - {getSafeValue(lead.city)}</TableCell>}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge className={`${getStatusColor(lead.status)} text-xs font-medium`}>
                          {lead.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.priority && (
                      <TableCell>
                        <Badge variant={lead.priority === 'high' ? 'destructive' : lead.priority === 'medium' ? 'default' : 'secondary'}>
                          {lead.priority}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.loanAmount && (
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lead.loan_amount)}
                      </TableCell>
                    )}
                    {visibleColumns.assignedTo && (
                      <TableCell className="text-sm">
                        {lead.assigned_user ? (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{lead.assigned_user.full_name}</span>
                            {telecallerStatus[lead.assigned_user.id]?.isOnline ? (
                              <Badge className="ml-1 bg-green-500 hover:bg-green-600 text-white h-2 w-2 p-0 rounded-full" title="Online" />
                            ) : (
                              <Badge className="ml-1 bg-red-500 hover:bg-red-600 text-white h-2 w-2 p-0 rounded-full" title="Offline" />
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Unassigned</Badge>
                        )}
                        <Select onValueChange={(value) => handleAssignLead(lead.id, value)}>
                          <SelectTrigger className="mt-1 h-8 text-xs w-[120px]">
                            <SelectValue placeholder="Reassign" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassign</SelectItem>
                            {telecallers.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {visibleColumns.tags && (
                        <TableCell>
                            <div className="flex flex-wrap gap-1">
                                {(lead.tags || []).slice(0, 2).map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                ))}
                                {(lead.tags || []).length > 2 && (
                                    <Badge variant="secondary" className="text-xs">+{lead.tags!.length - 2}</Badge>
                                )}
                            </div>
                        </TableCell>
                    )}
                    {visibleColumns.created && (
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                        {lead.last_contacted && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(lead.last_contacted).toLocaleDateString()}</span>
                          </div>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.actions && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(lead.id)}>
                            {expandedRows.has(lead.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleCallInitiated(lead)}>
                            <PhoneCall className="h-4 w-4" />
                          </Button>
                          <QuickActions 
                            lead={lead} 
                            onStatusChange={handleStatusChange} 
                            onAssignLead={handleAssignLead} 
                            telecallers={telecallers}
                            onAddTag={() => setSelectedLeadForTags(lead)}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  
                  {/* Expanded Row Content (from 6) */}
                  {expandedRows.has(lead.id) && (
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableCell colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).length + 2} className="py-2 px-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-600">Details</p>
                            <p><strong>Loan Type:</strong> {getSafeValue(lead.loan_type)}</p>
                            <p><strong>Source:</strong> {getSafeValue(lead.source)}</p>
                            <p><strong>Last Contacted:</strong> {lead.last_contacted ? new Date(lead.last_contacted).toLocaleString() : 'Never'}</p>
                            <p><strong>Follow-up:</strong> {lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString() : 'N/A'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-600">Activity Snapshot</p>
                            {/* NOTE: Activity data is not present in the provided snippets. Placeholder text is used. */}
                            <p className="text-muted-foreground">Last Note: Discussed loan terms. [Yesterday]</p>
                            <p className="text-muted-foreground">Email Sent: Loan package details. [2 days ago]</p>
                            <p className="text-muted-foreground">Status Change: Contacted. [3 days ago]</p>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-600">All Tags</p>
                            <div className="flex flex-wrap gap-1">
                              {(lead.tags || []).map(tag => (
                                <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>
                              ))}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                onClick={() => setSelectedLeadForTags(lead)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        // Kanban View Implementation (Placeholder as I don't have the full JSX for this)
        <div className="text-center py-8 border rounded-lg bg-gray-50">
          <p className="text-lg font-semibold text-gray-700">Kanban View</p>
          <p className="text-gray-500">Kanban board structure and rendering logic goes here. Current view: {viewMode}</p>
        </div>
      )}

      {/* Pagination (from 7) */}
      {filteredLeads.length > pageSize && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {paginatedLeads.length} of {filteredLeads.length} leads
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            {/* Pagination buttons logic from leads-table (7).tsx */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leads found. Try adjusting your filters or upload some leads.
        </div>
      )}
      
      {/* Lead Status Dialog (from 7/6) */}
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) setIsCallInitiated(false) // Reset when dialog is closed
          }}
          onStatusUpdate={handleStatusUpdate} 
          isCallInitiated={isCallInitiated} 
          onCallLogged={handleCallLogged}
        />
      )}

      {/* Tags Management Dialog (from 6) */}
      <Dialog open={!!selectedLeadForTags} onOpenChange={(open) => !open && setSelectedLeadForTags(null)}>
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
      
      {/* Duplicate Detection Dialog (from 6) */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" /> Potential Duplicates Found
            </DialogTitle>
            <DialogDescription>
              {duplicates.length} sets of leads share the same phone or email. Review and merge them if necessary.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-4">
            {duplicates.map((dup, index) => (
              <Card key={index} className="border-yellow-400 bg-yellow-50">
                <CardHeader className="py-2">
                  <CardTitle className="text-sm font-semibold">
                    {dup.type.charAt(0).toUpperCase() + dup.type.slice(1)} Match: {dup.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {dup.leads.map((lead: Lead) => (
                      <li key={lead.id}>
                        <Link href={`/leads/${lead.id}`} className="hover:underline text-blue-600">
                          {lead.name} ({lead.status})
                        </Link> - Created: {new Date(lead.created_at).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                  <Button variant="link" size="sm" className="p-0 mt-2">
                    Merge Leads (Action)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDuplicatesDialog(false)} variant="outline">Close</Button>
            <Button onClick={detectDuplicates}>Re-run Check</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
