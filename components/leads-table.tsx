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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

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
  
  // --- KEEPING ORIGINAL BULK ASSIGN STATE ---
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  // ------------------------------------------
  
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

  // --- KEEPING ORIGINAL BULK ASSIGN FUNCTION ---
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
  // ---------------------------------------------

  // --- KEEPING ORIGINAL BULK STATUS UPDATE FUNCTION ---
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedLeads.length === 0) return

    try {
      // Update status for all selected leads
      const updates = selectedLeads.map(leadId => 
        supabase
          .from("leads")
          .update({ 
            status: bulkStatus,
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

      console.log(`Bulk updated status for ${selectedLeads.length} leads to ${bulkStatus}`)
      setSelectedLeads([])
      setBulkStatus("")
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk updating lead status:", error)
    }
  }
  // ----------------------------------------------------

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

  // --- KEEPING ORIGINAL CALL INITIATION LOGIC ---
  const [isCallInitiated, setIsCallInitiated] = useState(false)

  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false)
  }

  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    try {
      if (!selectedLead?.id) return
      
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

      // Add callback date if provided for Call Back status
      if (newStatus === "follow_up" && callbackDate) {
        const { error: followUpError } = await supabase
          .from("follow_ups")
          .insert({
            lead_id: selectedLead.id,
            scheduled_date: callbackDate,
            status: "scheduled"
          })

        if (followUpError) throw followUpError
        
        // Also update the lead's follow_up_date
        updateData.follow_up_date = callbackDate
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", selectedLead.id)

      if (error) throw error

      console.log(`Status updated for lead ${selectedLead.id} to ${newStatus}`)
      window.location.reload()
      
    } catch (error) {
      console.error("Error updating lead status:", error)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ 
          status: newStatus,
          last_contacted: new Date().toISOString()
        })
        .eq("id", leadId)

      if (error) throw error

      console.log(`Status changed for lead ${leadId} to ${newStatus}`)
      window.location.reload()
      
    } catch (error) {
      console.error("Error changing lead status:", error)
    }
  }

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
  // ---------------------------------------------

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(paginatedLeads.map(lead => lead.id))
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

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
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
              {dashboardStats.unassigned} unassigned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
                <SelectItem value="Login">Login</SelectItem>
                <SelectItem value="Disbursed">Disbursed</SelectItem>
                <SelectItem value="Not_Interested">Not Interested</SelectItem>
                <SelectItem value="not_eligible">Not Eligible</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {telecallers.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Advanced Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <div className="p-2">
                <Label className="text-xs">Source</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map((source) => (
                      <SelectItem key={source} value={source || ''}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-2">
                <Label className="text-xs">Lead Score</Label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Scores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="hot">Hot (80+)</SelectItem>
                    <SelectItem value="warm">Warm (50-79)</SelectItem>
                    <SelectItem value="cold">Cold (0-49)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-2">
                <Label className="text-xs">Tags</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {uniqueTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveFilterDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Current Filter
              </DropdownMenuItem>
              {savedFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
                  {savedFilters.map((filter) => (
                    <DropdownMenuItem key={filter.id} onClick={() => loadFilter(filter)}>
                      {filter.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layout className="h-4 w-4 mr-2" />
                Columns
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(visibleColumns).map(([key, visible]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visible}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, [key]: checked }))
                  }
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" size="sm" onClick={detectDuplicates}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Duplicates
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Actions
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowAutoAssignDialog(true)}>
                <Users className="h-4 w-4 mr-2" />
                Auto-Assign Rules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Bulk Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSMSDialog(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Bulk SMS
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Bulk Add Tags</DropdownMenuLabel>
              {availableTags.slice(0, 5).map((tag) => (
                <DropdownMenuItem key={tag} onClick={() => handleBulkAddTag(tag)}>
                  <Tag className="h-4 w-4 mr-2" />
                  Add "{tag}" Tag
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Bulk Status Update */}
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="Interested">Interested</SelectItem>
                    <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
                    <SelectItem value="Login">Login</SelectItem>
                    <SelectItem value="Disbursed">Disbursed</SelectItem>
                    <SelectItem value="Not_Interested">Not Interested</SelectItem>
                    <SelectItem value="not_eligible">Not Eligible</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  size="sm" 
                  onClick={handleBulkStatusUpdate}
                  disabled={!bulkStatus}
                >
                  Update Status
                </Button>

                {/* Bulk Assign */}
                <Select 
                  value={bulkAssignTo[0] || ""} 
                  onValueChange={(value) => setBulkAssignTo([value])}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Assign To" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassign</SelectItem>
                    {telecallers.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id}>
                        {tc.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  size="sm" 
                  onClick={handleBulkAssign}
                  disabled={bulkAssignTo.length === 0}
                >
                  Assign
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedLeads([])}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                    onChange={selectAllLeads}
                    className="rounded border-gray-300"
                  />
                </TableHead>
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
                {visibleColumns.contact && (
                  <TableHead>Contact</TableHead>
                )}
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
                {visibleColumns.status && (
                  <TableHead>Status</TableHead>
                )}
                {visibleColumns.priority && (
                  <TableHead>Priority</TableHead>
                )}
                {visibleColumns.score && (
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('lead_score')}
                  >
                    <div className="flex items-center gap-1">
                      Score
                      {sortField === 'lead_score' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
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
                      Last Contact
                      {sortField === 'last_contacted' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                )}
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
                {visibleColumns.loanType && (
                  <TableHead>Loan Type</TableHead>
                )}
                {visibleColumns.source && (
                  <TableHead>Source</TableHead>
                )}
                {visibleColumns.assignedTo && (
                  <TableHead>Assigned To</TableHead>
                )}
                {visibleColumns.tags && (
                  <TableHead>Tags</TableHead>
                )}
                {visibleColumns.actions && (
                  <TableHead className="w-20">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8">
                    <div className="text-gray-500">No leads found</div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLeads.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    
                    {visibleColumns.name && (
                      <TableCell>
                        <div className="font-medium">{getSafeValue(lead.name)}</div>
                        <div className="text-xs text-muted-foreground">ID: {lead.id.slice(-8)}</div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.contact && (
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span className="text-sm">{getSafeValue(lead.phone)}</span>
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="text-sm truncate">{lead.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.company && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{getSafeValue(lead.company)}</span>
                        </div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.status && (
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="Interested">Interested</SelectItem>
                            <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
                            <SelectItem value="Login">Login</SelectItem>
                            <SelectItem value="Disbursed">Disbursed</SelectItem>
                            <SelectItem value="Not_Interested">Not Interested</SelectItem>
                            <SelectItem value="not_eligible">Not Eligible</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    
                    {visibleColumns.priority && (
                      <TableCell>
                        <Badge variant={getPriorityVariant(lead.priority) as any}>
                          {lead.priority}
                        </Badge>
                      </TableCell>
                    )}
                    
                    {visibleColumns.score && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>{lead.lead_score || 0}</span>
                              <span className="text-muted-foreground">/100</span>
                            </div>
                            <Progress 
                              value={lead.lead_score || 0} 
                              className="h-2"
                            />
                          </div>
                          {lead.lead_score && (
                            <Badge 
                              variant="outline" 
                              className={getScoreBadge(lead.lead_score).color}
                            >
                              {getScoreBadge(lead.lead_score).label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.created && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.lastContacted && (
                      <TableCell>
                        {lead.last_contacted ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(lead.last_contacted).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    )}
                    
                    {visibleColumns.loanAmount && (
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(lead.loan_amount)}
                        </div>
                      </TableCell>
                    )}
                    
                    {visibleColumns.loanType && (
                      <TableCell>
                        <Badge variant="outline">
                          {getSafeValue(lead.loan_type, 'N/A')}
                        </Badge>
                      </TableCell>
                    )}
                    
                    {visibleColumns.source && (
                      <TableCell>
                        <Badge variant="outline">
                          {getSafeValue(lead.source, 'N/A')}
                        </Badge>
                      </TableCell>
                    )}
                    
                    {visibleColumns.assignedTo && (
                      <TableCell>
                        <Select
                          value={lead.assigned_to || "unassigned"}
                          onValueChange={(value) => handleAssignLead(lead.id, value)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {telecallers.map((tc) => (
                              <SelectItem key={tc.id} value={tc.id}>
                                {tc.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    
                    {visibleColumns.tags && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(lead.tags || []).slice(0, 2).map((tag) => (
                            <Badge 
                              key={tag} 
                              variant="secondary" 
                              className="text-xs"
                            >
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
                    
                    {visibleColumns.actions && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <QuickActions 
                            lead={lead} 
                            onCallInitiated={() => handleCallInitiated(lead)}
                            onStatusChange={(status) => handleStatusChange(lead.id, status)}
                          />
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/leads/${lead.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedLeadForTags(lead)}>
                                <Tag className="h-4 w-4 mr-2" />
                                Manage Tags
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowSMSDialog(true)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send SMS
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
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
                  <PaginationItem key={pageNum}>
                    <PaginationLink
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Dialogs */}
      <LeadStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        lead={selectedLead}
        onStatusUpdate={handleStatusUpdate}
        onCallLogged={handleCallLogged}
        isCallInitiated={isCallInitiated}
      />

      {/* Save Filter Dialog */}
      <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Save your current filter settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Enter filter name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFilter} disabled={!filterName.trim()}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Bulk Email</DialogTitle>
            <DialogDescription>
              Send email to {selectedLeads.length} selected lead{selectedLeads.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Enter your email message..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEmail} disabled={!emailSubject || !emailBody}>
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk SMS</DialogTitle>
            <DialogDescription>
              Send SMS to {selectedLeads.length} selected lead{selectedLeads.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-body">Message</Label>
              <Textarea
                id="sms-body"
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder="Enter your SMS message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSMSDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkSMS} disabled={!smsBody}>
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Assign Rules Dialog */}
      <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Assign Rules</DialogTitle>
            <DialogDescription>
              Configure automatic lead assignment rules for unassigned leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-assign-enabled">Enable Auto-Assignment</Label>
              <Switch
                id="auto-assign-enabled"
                checked={autoAssignRules.enabled}
                onCheckedChange={(checked) => setAutoAssignRules(prev => ({ ...prev, enabled: checked }))}
              />
            </div>
            
            {autoAssignRules.enabled && (
              <>
                <div>
                  <Label htmlFor="assignment-method">Assignment Method</Label>
                  <Select
                    value={autoAssignRules.method}
                    onValueChange={(value) => setAutoAssignRules(prev => ({ ...prev, method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">Round Robin</SelectItem>
                      <SelectItem value="workload">Workload Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="assignment-criteria">Assignment Criteria</Label>
                  <Input
                    id="assignment-criteria"
                    value={autoAssignRules.criteria}
                    onChange={(e) => setAutoAssignRules(prev => ({ ...prev, criteria: e.target.value }))}
                    placeholder="Optional: Specify criteria for assignment"
                  />
                </div>
                
                <Button onClick={handleAutoAssignLeads} className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Auto-Assign Unassigned Leads Now
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Duplicate Leads Detected</DialogTitle>
            <DialogDescription>
              Found {duplicates.length} potential duplicate groups
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {duplicates.map((dup, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Duplicate {dup.type}: {dup.value}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dup.leads.map((lead: Lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {lead.phone} • {lead.email} • Created: {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/leads/${lead.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicatesDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <Dialog open={!!selectedLeadForTags} onOpenChange={(open) => !open && setSelectedLeadForTags(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags for {selectedLeadForTags?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(selectedLeadForTags?.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(selectedLeadForTags!.id, tag)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Add New Tag</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Enter new tag"
                />
                <Button 
                  onClick={() => {
                    if (newTag.trim() && selectedLeadForTags) {
                      handleAddTag(selectedLeadForTags.id, newTag.trim())
                      setNewTag("")
                    }
                  }}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            
            <div>
              <Label>Quick Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableTags.map((tag) => (
                  <Button
                    key={tag}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedLeadForTags && !selectedLeadForTags.tags?.includes(tag)) {
                        handleAddTag(selectedLeadForTags.id, tag)
                      }
                    }}
                    disabled={selectedLeadForTags?.tags?.includes(tag)}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLeadForTags(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
