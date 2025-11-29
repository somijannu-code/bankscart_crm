"use client";

import { useState, useEffect, useMemo, useRef } from "react"
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
  AlertTriangle, CheckCircle2, XCircle, Sparkles, Upload,
  Pencil
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

// --- Helper Functions & Constants ---

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface KanbanColumn {
  id: string
  title: string
  color: string
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'new', title: 'New Leads', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
  { id: 'Interested', title: 'Interested', color: 'bg-orange-500' },
  { id: 'Documents_Sent', title: 'Docs Sent', color: 'bg-purple-500' },
  { id: 'Login', title: 'Login', color: 'bg-indigo-500' },
  { id: 'follow_up', title: 'Follow Up', color: 'bg-pink-500' },
  { id: 'Disbursed', title: 'Disbursed', color: 'bg-green-600' },
  { id: 'nr', title: 'Not Reachable', color: 'bg-gray-400' },
  { id: 'Not_Interested', title: 'Closed / Lost', color: 'bg-red-500' },
]

const parseCSV = (text: string) => {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const entry: any = {};
    headers.forEach((h, i) => {
      if (h.includes('name')) entry.name = values[i];
      else if (h.includes('email')) entry.email = values[i];
      else if (h.includes('phone') || h.includes('contact')) entry.phone = values[i];
      else if (h.includes('amount')) entry.loan_amount = parseFloat(values[i]) || 0;
      else if (h.includes('type')) entry.loan_type = values[i];
      else if (h.includes('company')) entry.company = values[i];
      else if (h.includes('source')) entry.source = values[i];
      else if (h.includes('city')) entry.city = values[i];
    });
    entry.status = entry.status || 'new';
    entry.priority = entry.priority || 'medium';
    entry.created_at = new Date().toISOString();
    return entry;
  });
};

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  notes?: string // FIX 1: Add notes to interface
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

interface SavedFilter {
  id: string
  name: string
  filters: any
}

interface LeadsTableProps {
  leads: Lead[]
  telecallers: Array<{ id: string; full_name: string }>
}

// --- Inline Editing Component ---
interface InlineEditableCellProps {
    value: string | number | null;
    onSave: (newValue: string) => Promise<void>;
    type?: "text" | "number" | "email" | "tel";
    className?: string;
    suffix?: React.ReactNode;
}

const InlineEditableCell = ({ value, onSave, type = "text", className, suffix }: InlineEditableCellProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value?.toString() || "");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentValue(value?.toString() || "");
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = async () => {
        setIsEditing(false);
        if (currentValue !== (value?.toString() || "")) {
           await onSave(currentValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setCurrentValue(value?.toString() || "");
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input
                    ref={inputRef}
                    type={type}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="h-7 text-xs px-2 min-w-[120px]"
                />
            </div>
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)} 
            className={cn(
                "cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -ml-1.5 border border-transparent hover:border-border transition-colors group flex items-center gap-2",
                !value && "text-muted-foreground italic",
                className
            )}
            title="Click to edit"
        >
            <span className="truncate">{value || "Empty"}</span>
            {suffix}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0" />
        </div>
    );
};

const triggerButtonClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3";
const triggerGhostClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3";

export function LeadsTable({ leads = [], telecallers = [] }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [scoreFilter, setScoreFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  
  // Sorting
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  
  // Columns Visibility - Added all missing columns here
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    contact: true,
    company: false, // Added
    status: true,
    notes: true,// FIX 2: Set notes to true to make it visible by default
    priority: false,
    score: true,
    created: true,
    lastContacted: true,
    loanAmount: true,
    loanType: false, // Added (default hidden)
    source: false,   // Added (default hidden)
    tags: true, // FIX 2: Set tags to true to make it visible by default
    assignedTo: true,
    actions: false
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(40)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [lastCallFrom, setLastCallFrom] = useState("")
  const [lastCallTo, setLastCallTo] = useState("")
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [bulkTagInput, setBulkTagInput] = useState("") // New state for custom bulk tag
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [filterName, setFilterName] = useState("")
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false)
  const [availableTags, setAvailableTags] = useState<string[]>([
    "VIP", "Hot Lead", "Referral", "Event", "Follow Up", "High Value"
  ])
  const [newTag, setNewTag] = useState("")
  const [selectedLeadForTags, setSelectedLeadForTags] = useState<Lead | null>(null)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showSMSDialog, setShowSMSDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [smsBody, setSmsBody] = useState("")
  const [showAutoAssignDialog, setShowAutoAssignDialog] = useState(false)
  const [autoAssignRules, setAutoAssignRules] = useState({
    enabled: false,
    method: 'round-robin', 
    criteria: '',
    reassignNR: false, 
    reassignInterested: false 
  })
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false)
  const supabase = createClient()
  const [lastCallTimestamps, setLastCallTimestamps] = useState<Record<string, string | null>>({})
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
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

      const leadIds = leads.map(l => l.id);
      if (leadIds.length === 0) return;

      try {
        const { data: callLogs, error } = await supabase
          .from("call_logs")
          .select("lead_id, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (error) return;
        
        const latestCalls: Record<string, string | null> = {};
        const seenLeadIds = new Set<string>();

        for (const log of callLogs) {
          if (!seenLeadIds.has(log.lead_id)) {
            latestCalls[log.lead_id] = log.created_at;
            seenLeadIds.add(log.lead_id);
          }
        }
        setLastCallTimestamps(latestCalls);
      } catch (error) {
        console.error("An error occurred during call log fetch:", error);
      }
    };
    fetchData();
  }, [leads, supabase]);

  const calculateLeadScore = (lead: Lead): number => {
    let score = 0
    if (lead.loan_amount) {
      if (lead.loan_amount >= 5000000) score += 30
      else if (lead.loan_amount >= 2000000) score += 20
      else if (lead.loan_amount >= 1000000) score += 10
    }
    if (lead.created_at) {
      const daysOld = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
      if (daysOld <= 1) score += 25
      else if (daysOld <= 3) score += 20
      else if (daysOld <= 7) score += 15
      else if (daysOld <= 14) score += 10
      else if (daysOld <= 30) score += 5
    }
    const statusScores: Record<string, number> = {
      'Interested': 20, 'Documents_Sent': 18, 'Login': 15, 'contacted': 12, 'follow_up': 10,
      'nr':0, 'new': 8, 'Not_Interested': 2, 'not_eligible': 1
    }
    score += statusScores[lead.status] || 5
    if (lead.priority === 'high') score += 15
    else if (lead.priority === 'medium') score += 10
    else score += 5
    const sourceScores: Record<string, number> = {
      'referral': 10, 'website': 8, 'social_media': 6, 'other': 3
    }
    score += sourceScores[lead.source?.toLowerCase() || 'other'] || 5
    return Math.min(score, 100)
  }

  const enrichedLeads = useMemo(() => {
    return leads.map(lead => ({
      ...lead,
      lead_score: calculateLeadScore(lead),
      tags: lead.tags || []
    }))
  }, [leads])

  const dashboardStats = useMemo(() => {
    const total = enrichedLeads.length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const newToday = enrichedLeads.filter(l => new Date(l.created_at) >= today).length
    const contacted = enrichedLeads.filter(l => l.status === 'contacted' || l.status === 'Interested').length
    const converted = enrichedLeads.filter(l => l.status === 'Disbursed').length
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0'
    const avgScore = total > 0 
      ? (enrichedLeads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / total).toFixed(0)
      : '0'
    const unassigned = enrichedLeads.filter(l => !l.assigned_to).length
    const highValue = enrichedLeads.filter(l => (l.loan_amount || 0) >= 2000000).length
    const overdue = enrichedLeads.filter(l => l.follow_up_date && new Date(l.follow_up_date) < today).length

    const statusDist = enrichedLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total, newToday, contacted, converted, conversionRate, avgScore, unassigned, highValue, overdue, statusDist
    }
  }, [enrichedLeads])

  const uniqueSources = useMemo(() => {
    const sources = new Set(enrichedLeads.map(l => l.source).filter(Boolean))
    return Array.from(sources)
  }, [enrichedLeads])

  const uniqueTags = useMemo(() => {
    const tags = new Set(enrichedLeads.flatMap(l => l.tags || []))
    return Array.from(tags)
  }, [enrichedLeads])

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
    
    const leadCreatedAt = new Date(lead.created_at).getTime();
    const matchesDateFrom = dateFrom === "" || leadCreatedAt >= new Date(dateFrom).getTime();
    const matchesDateTo = dateTo === "" || leadCreatedAt <= new Date(dateTo).setHours(23, 59, 59, 999); 

    const lastCalledAt = lastCallTimestamps[lead.id] ? new Date(lastCallTimestamps[lead.id]!).getTime() : 0;
    const matchesLastCallFrom = lastCallFrom === "" || lastCalledAt >= new Date(lastCallFrom).getTime();
    const matchesLastCallTo = lastCallTo === "" || lastCalledAt <= new Date(lastCallTo).setHours(23, 59, 59, 999);

    return matchesSearch && matchesStatus && matchesPriority && 
           matchesAssignedTo && matchesSource && matchesScore && matchesTag &&
           matchesDateFrom && matchesDateTo &&
           matchesLastCallFrom && matchesLastCallTo
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

  const totalPages = Math.ceil(filteredLeads.length / (pageSize > 0 ? pageSize : 1))
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "") {
      setPageSize(0)
      return
    }
    const newSize = parseInt(value)
    if (!isNaN(newSize) && newSize > 0) {
      setPageSize(newSize)
      setCurrentPage(1)
    }
  }

  const handleInlineUpdate = async (leadId: string, field: string, value: string | number) => {
    try {
        const { error } = await supabase
            .from("leads")
            .update({ [field]: value })
            .eq("id", leadId);

        if (error) throw error;
        window.location.reload(); 
    } catch (error) {
        console.error("Error updating lead inline:", error);
        setErrorMessage("Failed to update field");
    }
  };

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
      if (leads.length > 1) dups.push({ type: 'phone', value: phone, leads })
    })
    emailMap.forEach((leads, email) => {
      if (leads.length > 1) dups.push({ type: 'email', value: email, leads })
    })
    setDuplicates(dups)
    setShowDuplicatesDialog(true)
  }

  const exportToCSV = () => {
    const headers = Object.keys(visibleColumns).filter(k => visibleColumns[k])
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => 
        headers.map(h => {
          const val = (lead as any)[h]
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

  const saveCurrentFilter = () => {
    const filter = {
      id: Date.now().toString(),
      name: filterName,
      filters: {
        searchTerm, statusFilter, priorityFilter, assignedToFilter,
        sourceFilter, scoreFilter, tagFilter,
        dateFrom, dateTo, lastCallFrom, lastCallTo
      }
    }
    setSavedFilters([...savedFilters, filter])
    setFilterName("")
    setShowSaveFilterDialog(false)
    localStorage.setItem('savedFilters', JSON.stringify([...savedFilters, filter]))
  }

  const loadFilter = (filter: SavedFilter) => {
    setSearchTerm(filter.filters.searchTerm || "")
    setStatusFilter(filter.filters.statusFilter || "all")
    setPriorityFilter(filter.filters.priorityFilter || "all")
    setAssignedToFilter(filter.filters.assignedToFilter || "all")
    setSourceFilter(filter.filters.sourceFilter || "all")
    setScoreFilter(filter.filters.scoreFilter || "all")
    setTagFilter(filter.filters.tagFilter || "all")
    setDateFrom(filter.filters.dateFrom || "")
    setDateTo(filter.filters.dateTo || "")
    setLastCallFrom(filter.filters.lastCallFrom || "")
    setLastCallTo(filter.filters.lastCallTo || "")
  }

  useEffect(() => {
    const saved = localStorage.getItem('savedFilters')
    if (saved) setSavedFilters(JSON.parse(saved))
  }, [])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleBulkEmail = async () => {
    if (selectedLeads.length === 0) return
    setShowEmailDialog(false)
    setEmailSubject("")
    setEmailBody("")
  }

  const handleBulkSMS = async () => {
    if (selectedLeads.length === 0) return
    setShowSMSDialog(false)
    setSmsBody("")
  }

  const handleBulkAssign = async () => {
    if (bulkAssignTo.length === 0 || selectedLeads.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id

      const updates: any[] = []
      const telecallerIds = bulkAssignTo; 

      selectedLeads.forEach((leadId, index) => {
          const telecallerId = telecallerIds[index % telecallerIds.length];
          updates.push({
              id: leadId,
              assigned_to: telecallerId,
              assigned_by: assignedById,
              assigned_at: new Date().toISOString()
          });
      });

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

      setSelectedLeads([])
      setBulkAssignTo([]) 
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk assigning leads:", error)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedLeads.length === 0) return

    try {
      const updates = selectedLeads.map(leadId => 
        supabase
          .from("leads")
          .update({ 
            status: bulkStatus,
            last_contacted: new Date().toISOString()
          })
          .eq("id", leadId)
      )

      const results = await Promise.all(updates)
      const errors = results.filter(result => result.error)
      if (errors.length > 0) throw new Error(`Failed to update status for ${errors.length} leads`)

      setSelectedLeads([])
      setBulkStatus("")
      window.location.reload()
    } catch (error) {
      console.error("Error bulk updating lead status:", error)
    }
  }

  const handleBulkAddTag = async (tag: string) => {
    if (selectedLeads.length === 0 || !tag.trim()) return

    try {
      const updates = selectedLeads.map(async (leadId) => {
        const lead = enrichedLeads.find(l => l.id === leadId)
        const currentTags = lead?.tags || []
        
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
      if (errors.length > 0) throw new Error(`Failed to add tag to ${errors.length} leads`)

      setSelectedLeads([])
      setBulkTagInput("")
      window.location.reload()
    } catch (error) {
      console.error("Error adding tag:", error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} leads? This action cannot be undone.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .in('id', selectedLeads)

        if (error) throw error

        setSelectedLeads([])
        setSuccessMessage(`Successfully deleted ${selectedLeads.length} leads.`)
        window.location.reload()
    } catch (error) {
        console.error("Error deleting leads:", error)
        setErrorMessage("Failed to delete leads")
    }
  }

  const handleAutoAssignLeads = async () => {
    if (!autoAssignRules.enabled || telecallers.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const assignedById = user?.id
      let updates: any[] = []
      const now = new Date()

      const activeTelecallers = telecallers.filter(tc => {
        return telecallerStatus[tc.id] === true
      })

      if (activeTelecallers.length === 0) {
        alert('No ACTIVE telecallers found online. Please ensure agents are logged in.')
        return
      }

      const unassignedLeads = enrichedLeads.filter(l => !l.assigned_to)

      let leadsToReassign: Lead[] = []
      
      if (autoAssignRules.reassignNR) {
        const staleNR = enrichedLeads.filter(l => {
          if (l.status !== 'nr' || !l.assigned_to) return false 
          const lastContact = lastCallTimestamps[l.id] || l.last_contacted
          if (!lastContact) return false 
          const diffHours = (now.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60)
          return diffHours > 48
        })
        leadsToReassign = [...leadsToReassign, ...staleNR]
      }

      if (autoAssignRules.reassignInterested) {
        const staleInterested = enrichedLeads.filter(l => {
          if (l.status !== 'Interested' || !l.assigned_to) return false
          const lastContact = lastCallTimestamps[l.id] || l.last_contacted
          if (!lastContact) return false
          const diffHours = (now.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60)
          return diffHours > 72
        })
        leadsToReassign = [...leadsToReassign, ...staleInterested]
      }

      const allLeadsToProcess = [...unassignedLeads, ...leadsToReassign]
      const processedLeadIds = new Set<string>();
      const uniqueLeadsToProcess = allLeadsToProcess.filter(lead => {
          if (processedLeadIds.has(lead.id)) return false;
          processedLeadIds.add(lead.id);
          return true;
      });

      if (uniqueLeadsToProcess.length === 0) {
        alert('No leads found matching criteria (Unassigned or Stale) for processing.')
        return
      }
      
      const shuffledTelecallers = shuffleArray(activeTelecallers);

      const leadCounts = activeTelecallers.map(tc => ({
          id: tc.id,
          count: enrichedLeads.filter(l => l.assigned_to === tc.id).length
      }));
      
      let roundRobinIndex = 0; 

      uniqueLeadsToProcess.forEach((lead) => {
        let newTelecallerId: string | null = null;
        const isReassign = !!lead.assigned_to; 
        
        if (autoAssignRules.method === 'round-robin') {
            let candidate = shuffledTelecallers[roundRobinIndex % shuffledTelecallers.length];
            if (isReassign && candidate.id === lead.assigned_to && shuffledTelecallers.length > 1) {
                roundRobinIndex++;
                candidate = shuffledTelecallers[roundRobinIndex % shuffledTelecallers.length];
            }
            newTelecallerId = candidate.id;
            roundRobinIndex++; 
        } else if (autoAssignRules.method === 'workload') {
            const minTelecaller = leadCounts.reduce((min, tc) => 
                tc.count < min.count ? tc : min
            );
            newTelecallerId = minTelecaller.id;
            minTelecaller.count++; 
        }

        if (newTelecallerId) {
            const updatePayload: any = {
                assigned_to: newTelecallerId,
                assigned_by: assignedById,
                assigned_at: new Date().toISOString()
            };

            if (isReassign) {
                updatePayload.status = 'new';
                updatePayload.last_contacted = new Date().toISOString(); 
            }

            updates.push(
                supabase
                .from("leads")
                .update(updatePayload)
                .eq("id", lead.id)
            );
        }
      });

      const results = await Promise.all(updates)
      const errors = results.filter(result => result.error)
      if (errors.length > 0) throw new Error(`Failed to process ${errors.length} lead updates`)

      const msg = `Processed: ${unassignedLeads.length} initial assignments, ${leadsToReassign.length} re-assignments.`
      alert(`Success! ${msg}`)
      window.location.reload()
    } catch (error) {
      console.error("Error auto-assigning leads:", error)
      alert("Error occurred during assignment. Check console.")
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

  const [isCallInitiated, setIsCallInitiated] = useState(false)

  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  const handleCallLogged = (callLogId: string) => {
    // This is an incomplete function in the original file, 
    // keeping the placeholder to preserve original structure.
  }

  const handleUpdateStatus = async (newStatus: string, note: string, callbackDate: string) => {
    try {
      if (!selectedLead?.id) return
      const updateData: any = {
        status: newStatus,
        last_contacted: new Date().toISOString()
      }

      if (newStatus === "not_eligible" && note) {
        const { error: noteError } = await supabase
          .from("notes")
          .insert({ lead_id: selectedLead.id, note: note, note_type: "status_change" })
        if (noteError) throw noteError
      }

      if (newStatus === "follow_up" && callbackDate) {
        const { error: followUpError } = await supabase
          .from("follow_ups")
          .insert({ lead_id: selectedLead.id, scheduled_date: callbackDate, status: "scheduled" })
        if (followUpError) throw followUpError
        updateData.follow_up_date = callbackDate
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", selectedLead.id)
      if (error) throw error
      window.location.reload()

    } catch (error) {
      console.error("Error updating lead status:", error)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, last_contacted: new Date().toISOString() })
        .eq("id", leadId)
      if (error) throw error
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
      window.location.reload()
    } catch (error) {
      console.error("Error assigning lead:", error)
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId')
    handleStatusChange(leadId, newStatus)
  }

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

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high": return "destructive"
      case "medium": return "default"
      default: return "secondary"
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {/* ... (Stats Cards remain unchanged) ... */}
        <Card className="col-span-1 border-l-4 border-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.total}</div>
            <p className="text-xs text-muted-foreground">in database</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-green-600">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">{dashboardStats.converted} Disbursed</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.avgScore}</div>
            <p className="text-xs text-muted-foreground">Overall Lead Quality</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Today</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.newToday}</div>
            <p className="text-xs text-muted-foreground">leads added</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue F/U</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.overdue}</div>
            <p className="text-xs text-muted-foreground">follow-ups missed</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <X className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.unassigned}</div>
            <p className="text-xs text-muted-foreground">waiting for assignment</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-pink-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.highValue}</div>
            <p className="text-xs text-muted-foreground">leads ( &gt; 20 Lakh)</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-l-4 border-gray-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Reached</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.statusDist['nr'] || 0}</div>
            <p className="text-xs text-muted-foreground">attempts exhausted</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter and View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full lg:w-auto">
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
                {KANBAN_COLUMNS.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                ))}
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
                  <SelectItem key={tc.id} value={tc.id}>{tc.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {/* View Switcher */}
          <div className="flex bg-muted rounded-md p-1 mr-2 items-center">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 px-3" 
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4 mr-1" /> List
            </Button>
            <Button 
              variant={viewMode === 'board' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 px-3" 
              onClick={() => setViewMode('board')}
            >
              <Layout className="h-4 w-4 mr-1" /> Board
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={triggerButtonClass}>
              <Filter className="h-4 w-4 mr-2" />
              Filter Options
              <ChevronDown className="h-4 w-4 ml-2" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Date Filters</DropdownMenuLabel>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="date-from" className="text-xs font-semibold">Created From</Label>
                <Input type="date" id="date-from" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="date-to" className="text-xs font-semibold">Created To</Label>
                <Input type="date" id="date-to" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Last Contact Filters</DropdownMenuLabel>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="last-call-from" className="text-xs font-semibold">Last Called From</Label>
                <Input type="date" id="last-call-from" value={lastCallFrom} onChange={(e) => setLastCallFrom(e.target.value)} className="h-8 text-xs" />
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="last-call-to" className="text-xs font-semibold">Last Called To</Label>
                <Input type="date" id="last-call-to" value={lastCallTo} onChange={(e) => setLastCallTo(e.target.value)} className="h-8 text-xs" />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Other Filters</DropdownMenuLabel>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="score-filter" className="text-xs font-semibold">Lead Score</Label>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Lead Score" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="hot">Hot (80+)</SelectItem>
                    <SelectItem value="warm">Warm (50-79)</SelectItem>
                    <SelectItem value="cold">Cold (Below 50)</SelectItem>
                  </SelectContent>
                </Select>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="source-filter" className="text-xs font-semibold">Source</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start space-y-2 p-2">
                <Label htmlFor="tag-filter" className="text-xs font-semibold">Tags</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {uniqueTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveFilterDialog(true)}>
                <Save className="h-4 w-4 mr-2" /> Save Current Filter
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
          
          {/* Fixed Dropdown Trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger className={triggerButtonClass}>
              <Layout className="h-4 w-4 mr-2" /> Columns <ChevronDown className="h-4 w-4 ml-2" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(visibleColumns).map(([key, visible]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visible}
                  onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: checked }))
                  }
                >
                  {/* Improved label formatting (e.g. "loanAmount" -> "Loan Amount") */}
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>

          <Button variant="outline" size="sm" onClick={detectDuplicates}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Duplicates
          </Button>

          {/* Fixed Dropdown Trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger className={triggerButtonClass}>
              <Zap className="h-4 w-4 mr-2" /> Actions <ChevronDown className="h-4 w-4 ml-2" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowAutoAssignDialog(true)}>
                <Users className="h-4 w-4 mr-2" /> Auto-Assign Rules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmailDialog(true)} disabled={selectedLeads.length === 0}>
                <Mail className="h-4 w-4 mr-2" /> Bulk Email ({selectedLeads.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSMSDialog(true)} disabled={selectedLeads.length === 0}>
                <MessageSquare className="h-4 w-4 mr-2" /> Bulk SMS ({selectedLeads.length})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Bulk Add Tags</DropdownMenuLabel>
              {availableTags.slice(0, 5).map(tag => (
                <DropdownMenuItem key={tag} onClick={() => handleBulkAddTag(tag)}>
                  <Tag className="h-4 w-4 mr-2" /> {tag}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex p-2 items-center gap-2">
                <Input 
                  value={bulkTagInput} 
                  onChange={(e) => setBulkTagInput(e.target.value)} 
                  placeholder="Custom Tag..."
                  className="h-8 text-xs"
                />
                <Button 
                  size="sm" 
                  onClick={() => handleBulkAddTag(bulkTagInput)}
                  disabled={!bulkTagInput || selectedLeads.length === 0}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleBulkDelete}
                className="text-red-600 hover:!bg-red-50 hover:!text-red-700"
                disabled={selectedLeads.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Bulk Delete ({selectedLeads.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Manual Bulk Assignment with Status Dots */}
          <DropdownMenu>
            <DropdownMenuTrigger className={`${triggerButtonClass} w-[200px] justify-between border-dashed`}>
              {bulkAssignTo.length === 0 ? (
                <span className="text-muted-foreground">Select Assignees</span>
              ) : bulkAssignTo.length === 1 ? (
                <span className="truncate">
                  {telecallers.find(t => t.id === bulkAssignTo[0])?.full_name}
                </span>
              ) : (
                <span>{bulkAssignTo.length} Assignees Selected</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="start">
              <DropdownMenuLabel>Select Telecallers</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {telecallers.map((tc) => {
                const isSelected = bulkAssignTo.includes(tc.id)
                const isOnline = telecallerStatus[tc.id] === true
                return (
                  <DropdownMenuCheckboxItem
                    key={tc.id}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setBulkAssignTo(prev => {
                        if (checked) return [...prev, tc.id]
                        return prev.filter(id => id !== tc.id)
                      })
                    }}
                  >
                    {/* Green/Red Status Dot */}
                    <div className="flex items-center gap-2 w-full">
                      <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'} />
                      <span>{tc.full_name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                )
              })}
              {bulkAssignTo.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="justify-center text-center text-xs cursor-pointer" 
                    onClick={() => setBulkAssignTo([])}
                  >
                    Clear Selection
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            size="sm" 
            onClick={handleBulkAssign} 
            disabled={bulkAssignTo.length === 0 || selectedLeads.length === 0}
          >
            Assign {selectedLeads.length > 0 && bulkAssignTo.length > 0 ? `(${Math.ceil(selectedLeads.length / bulkAssignTo.length)} each)` : ''}
          </Button>

          {/* Bulk Status Update */}
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className={`w-[140px] ${selectedLeads.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              <SelectValue placeholder="Bulk Status" />
            </SelectTrigger>
            <SelectContent>
              <DropdownMenuLabel>Change Status To</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {KANBAN_COLUMNS.map(col => (
                <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            size="sm" 
            onClick={handleBulkStatusUpdate} 
            disabled={!bulkStatus || selectedLeads.length === 0}
          >
            Update ({selectedLeads.length})
          </Button>
        </div>
      </div>

      {/* Leads Table View */}
      {viewMode === 'table' ? (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0} 
                      onChange={selectAllLeads}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      Lead
                      {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </TableHead>
                  {visibleColumns.contact && <TableHead>Contact Info</TableHead>}
                  {visibleColumns.company && <TableHead>Company</TableHead>}
                  {visibleColumns.status && <TableHead>Status</TableHead>}
                  {visibleColumns.priority && <TableHead>Priority</TableHead>}
                  {visibleColumns.score && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('lead_score')}>
                      <div className="flex items-center gap-1">
                        Score
                        {sortField === 'lead_score' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.created && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">
                        Created
                        {sortField === 'created_at' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.lastContacted && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('last_contacted')}>
                      <div className="flex items-center gap-1">
                        Last Call
                        {sortField === 'last_contacted' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.loanAmount && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('loan_amount')}>
                      <div className="flex items-center gap-1">
                        Loan Amount
                        {sortField === 'loan_amount' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.notes && <TableHead>Notes</TableHead>} {/* NOTES HEADER */}
                  {visibleColumns.loanType && <TableHead>Loan Type</TableHead>}
                  {visibleColumns.source && <TableHead>Source</TableHead>}
                  {visibleColumns.assignedTo && <TableHead>Assigned To</TableHead>}
                  {visibleColumns.tags && <TableHead>Tags</TableHead>}
                  {visibleColumns.actions && <TableHead className="w-20">Actions</TableHead>}
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

                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:text-primary transition-colors">
                          {lead.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{getSafeValue(lead.city, 'City N/A')}</p>
                      </TableCell>

                      {visibleColumns.contact && (
                        <TableCell>
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <InlineEditableCell 
                              value={lead.phone} 
                              type="tel"
                              onSave={(val) => handleInlineUpdate(lead.id, 'phone', val)} 
                              className="text-sm"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Mail className="h-3 w-3" />
                            <InlineEditableCell 
                              value={lead.email} 
                              type="email"
                              onSave={(val) => handleInlineUpdate(lead.id, 'email', val)} 
                              className="text-xs"
                            />
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.company && (
                        <TableCell>
                          <InlineEditableCell 
                            value={lead.company} 
                            onSave={(val) => handleInlineUpdate(lead.id, 'company', val)} 
                            className="text-sm"
                          />
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
                              {KANBAN_COLUMNS.map(col => (
                                <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}

                      {visibleColumns.priority && (
                        <TableCell>
                          <Badge variant={getPriorityVariant(lead.priority)} className="capitalize">{lead.priority}</Badge>
                        </TableCell>
                      )}
                      
                      {visibleColumns.score && (
                        <TableCell>
                          <Badge 
                            className={cn("text-[11px] font-medium", getScoreBadge(lead.lead_score || 0).color)}
                          >
                            <getScoreBadge(lead.lead_score || 0).icon className="h-3 w-3 mr-1" />
                            {getScoreBadge(lead.lead_score || 0).label} ({lead.lead_score})
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.created && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{new Date(lead.created_at).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                      )}
                      
                      {visibleColumns.lastContacted && (
                        <TableCell>
                          {(() => {
                            const lastContactTimestamp = lastCallTimestamps[lead.id] || lead.last_contacted;
                            if (lastContactTimestamp) {
                              return (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">
                                    {new Date(lastContactTimestamp).toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                </div>
                              );
                            }
                            return <span className="text-sm text-muted-foreground">Never</span>;
                          })()}
                        </TableCell>
                      )}

                      {visibleColumns.loanAmount && (
                        <TableCell>
                          <InlineEditableCell 
                            value={lead.loan_amount} 
                            type="number"
                            onSave={(val) => handleInlineUpdate(lead.id, 'loan_amount', val)} 
                            className="font-medium"
                            suffix={<span className="text-xs text-muted-foreground ml-1">INR</span>}
                          />
                        </TableCell>
                      )}
                      
                      {/* FIX 3: ADD THE MISSING NOTES CELL */}
                      {visibleColumns.notes && (
                        <TableCell>
                          <div className="max-w-[200px]">
                            <InlineEditableCell 
                              value={lead.notes} 
                              onSave={(val) => handleInlineUpdate(lead.id, 'notes', val)} 
                              className="text-xs text-muted-foreground truncate"
                            />
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.loanType && (
                        <TableCell>
                          <Badge variant="outline">{getSafeValue(lead.loan_type, 'N/A')}</Badge>
                        </TableCell>
                      )}

                      {visibleColumns.source && (
                        <TableCell>
                          <Badge variant="outline">{getSafeValue(lead.source, 'N/A')}</Badge>
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
                                <SelectItem key={tc.id} value={tc.id}>{tc.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}

                      {visibleColumns.tags && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(lead.tags || []).slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                            {(lead.tags || []).length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(lead.tags!.length - 2)} more
                              </Badge>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setSelectedLeadForTags(lead)}
                            >
                              <Tag className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.actions && (
                        <TableCell className="w-20">
                          <QuickActions 
                            lead={lead} 
                            telecallers={telecallers} 
                            handleAssignLead={handleAssignLead}
                            handleCallInitiated={handleCallInitiated}
                            handleStatusChange={handleStatusChange}
                            handleDelete={handleBulkDelete}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page:</span>
              <Input 
                type="number" 
                value={pageSize} 
                onChange={handlePageSizeChange} 
                className="w-16 h-8 text-xs text-center"
              />
              <span>{filteredLeads.length} total results</span>
              {selectedLeads.length > 0 && (
                <span className="ml-4 font-medium text-primary">
                  {selectedLeads.length} selected
                </span>
              )}
            </div>
            
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(page => (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      href="#" 
                      isActive={page === currentPage} 
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <span className="px-2 text-muted-foreground">...</span>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </Card>
      ) : (
        /* --- KANBAN BOARD VIEW --- */
        <div className="h-[calc(100vh-220px)] overflow-x-auto pb-4">
          <div className="flex gap-4 h-full min-w-[1200px]">
            {KANBAN_COLUMNS.map(col => {
              // Note: We use filteredLeads here so the Kanban respects the search/filter inputs!
              const colLeads = filteredLeads.filter(l => l.status === col.id);
              const totalAmount = colLeads.reduce((sum, l) => sum + (l.loan_amount || 0), 0);
              
              return (
                <div 
                  key={col.id} 
                  className="w-80 flex-shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900 rounded-lg border h-full"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column Header */}
                  <div className={`p-3 border-b border-l-4 ${col.color.replace('bg-', 'border-')} flex justify-between items-start`}>
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        {col.title}
                        <Badge variant="secondary" className="text-[10px] h-5">{colLeads.length}</Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {totalAmount > 0 ? formatCurrency(totalAmount) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Draggable Cards Area */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colLeads.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-md border hover:border-blue-400 cursor-grab active:cursor-grabbing transition-shadow"
                      >
                        <Link href={`/leads/${lead.id}`} className="font-medium text-sm hover:text-primary transition-colors block truncate">
                          {lead.name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(lead.loan_amount)}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <Badge 
                            className={cn("text-[10px] font-medium", getScoreBadge(lead.lead_score || 0).color)}
                          >
                            <getScoreBadge(lead.lead_score || 0).icon className="h-3 w-3 mr-1" />
                            {getScoreBadge(lead.lead_score || 0).label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {lead.assigned_user?.full_name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Lead Status Dialog (Used by QuickActions & Call button) */}
      <LeadStatusDialog 
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        lead={selectedLead}
        onUpdateStatus={handleUpdateStatus}
        isCallInitiated={isCallInitiated}
        setIsCallInitiated={setIsCallInitiated}
      />

      {/* Save Filter Dialog */}
      <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filter View</DialogTitle>
            <DialogDescription>Save the current combination of search, status, and date filters for later.</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>Cancel</Button>
            <Button onClick={saveCurrentFilter} disabled={!filterName.trim()}>Save Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Bulk Email</DialogTitle>
            <DialogDescription>Send email to {selectedLeads.length} selected lead{selectedLeads.length !== 1 ? 's' : ''}</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkEmail} disabled={!emailSubject || !emailBody}>Send Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk SMS</DialogTitle>
            <DialogDescription>Send SMS to {selectedLeads.length} selected lead{selectedLeads.length !== 1 ? 's' : ''}</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowSMSDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkSMS} disabled={!smsBody}>Send SMS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Assign Dialog */}
      <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Automated Lead Assignment</DialogTitle>
            <DialogDescription>Configure rules for automatically assigning new and stale leads to active agents.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <Label htmlFor="auto-assign-toggle" className="font-semibold text-base">
                Enable Auto-Assignment
              </Label>
              <Switch 
                id="auto-assign-toggle" 
                checked={autoAssignRules.enabled} 
                onCheckedChange={(checked) => setAutoAssignRules(prev => ({ ...prev, enabled: checked }))} 
              />
            </div>

            {autoAssignRules.enabled && (
              <>
                <div>
                  <Label htmlFor="assignment-method" className="font-semibold">Assignment Method</Label>
                  <Select 
                    value={autoAssignRules.method} 
                    onValueChange={(value) => setAutoAssignRules(prev => ({ ...prev, method: value as 'round-robin' | 'workload' }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">Round Robin (Even Distribution)</SelectItem>
                      <SelectItem value="workload">Least Workload (Assign to agent with fewest leads)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />
                
                <h4 className="font-semibold text-sm">Re-Assignment Rules (Stale Leads)</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reassign-nr" className="flex flex-col gap-1">
                      <span>Reassign "Not Reachable" > 48hrs</span>
                      <span className="text-xs text-muted-foreground font-normal">If lead status is 'nr' and last call was > 48 hours ago.</span>
                    </Label>
                    <Switch 
                      id="reassign-nr" 
                      checked={autoAssignRules.reassignNR} 
                      onCheckedChange={(checked) => setAutoAssignRules(prev => ({ ...prev, reassignNR: checked }))} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reassign-interested" className="flex flex-col gap-1">
                      <span>Reassign "Interested" > 72hrs</span>
                      <span className="text-xs text-muted-foreground font-normal">If lead status is 'Interested' and last call was > 72 hours ago.</span>
                    </Label>
                    <Switch 
                      id="reassign-interested" 
                      checked={autoAssignRules.reassignInterested} 
                      onCheckedChange={(checked) => setAutoAssignRules(prev => ({ ...prev, reassignInterested: checked }))} 
                    />
                  </div>
                </div>

                <Button onClick={handleAutoAssignLeads} className="w-full mt-4">
                  <Users className="h-4 w-4 mr-2" /> Run Auto-Assign / Re-Assign Now
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Tag Management Dialog */}
      <Dialog open={!!selectedLeadForTags} onOpenChange={() => setSelectedLeadForTags(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Tags for {selectedLeadForTags?.name}</DialogTitle>
            <DialogDescription>Add or remove tags to categorize this lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Current Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(selectedLeadForTags?.tags || []).map((tag) => (
                  <Badge key={tag} variant="default" className="text-sm font-normal pr-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(selectedLeadForTags!.id, tag)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Add New Tag</Label>
              <div className="flex gap-2 mt-2">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Enter new tag" />
                <Button 
                  onClick={() => { 
                    if (newTag.trim() && selectedLeadForTags) { 
                      handleAddTag(selectedLeadForTags.id, newTag.trim()); 
                      setNewTag("") 
                    } 
                  }} 
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
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
                    <Tag className="h-3 w-3 mr-1" /> {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLeadForTags(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Leads (CSV)</DialogTitle>
            <DialogDescription>Upload a CSV file to bulk import new leads.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* The rest of the import logic needs to be here if you want to use it. 
                Based on your original file, the import functionality was likely 
                defined separately or is part of a different component. 
                I will leave a placeholder for the component itself.
            */}
            <p className="text-sm text-muted-foreground">
              Note: Full CSV upload and processing logic is not present in this file snippet. 
              You will need to ensure your `handleFileUpload` function is implemented elsewhere.
            </p>
            {/* Example File Input */}
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input id="csv-file" type="file" accept=".csv" disabled={importing} />
            
            {importing && <Progress value={50} />} {/* Placeholder for progress */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={importing}>Cancel</Button>
            <Button disabled={importing}>
              {importing ? 'Importing...' : 'Start Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Potential Duplicates Detected ({duplicates.length})</DialogTitle>
            <DialogDescription>
              Review leads with matching phone numbers or emails. Please merge or close duplicates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {duplicates.map((dup, index) => (
              <Card key={index} className="p-4 border-l-4 border-red-500">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  {dup.type === 'phone' ? `Phone: ${dup.value}` : `Email: ${dup.value}`}
                </CardTitle>
                <CardContent className="mt-4 p-0 space-y-3">
                  {dup.leads.map((lead: Lead) => (
                    <div key={lead.id} className="border p-2 rounded flex justify-between items-center text-sm">
                      <div>
                        <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary transition-colors">
                          {lead.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">Status: {lead.status}, Assigned: {lead.assigned_user?.full_name || 'N/A'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm">Merge</Button>
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(lead.id, 'Not_Interested')}>Close</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicatesDialog(false)}>Close</Button>
            <Button disabled>Bulk Merge (Coming Soon)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
