"use client";

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download, 
  MoreHorizontal, Check, X, AlertCircle, Trash2 
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTelecallerStatus } from "@/hooks/use-telecaller-status"
import { format } from "date-fns"; 

// IMPORTANT: You need to import a multi-select component here.
// For example: import { MultiSelect } from "@/components/ui/multi-select"; 

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
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  
  // 🔑 State declaration (Correctly named visibleColumns)
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
    assignedTo: true,
    actions: true
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  
  const supabase = createClient()

  // FIX FOR INFINITE LOOP: Stabilize the array reference using useMemo
  const allTelecallerIds = useMemo(() => {
    return [
      ...leads.map(lead => lead.assigned_user?.id).filter(Boolean) as string[],
      ...telecallers.map(t => t.id)
    ].filter((id, index, self) => self.indexOf(id) === index) 
  }, [leads, telecallers]) 

  const { telecallerStatus, loading: statusLoading } = useTelecallerStatus(allTelecallerIds)

  const maxPagesToShow = 5 // Defined for pagination helper below

  // Add safe value getters
  const getSafeValue = (value: any, defaultValue: string = 'N/A') => {
    return value ?? defaultValue
  }

  // Filter and sort leads
  const filteredLeads = leads.filter(lead => {
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
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

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

      // Logic for note/follow-up based on status (Supabase interactions removed for brevity)
      if (newStatus === "follow_up" && callbackDate) {
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

      console.log(`Bulk assigned ${selectedLeads.length} leads`)
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

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return

    if (!isBulkDeleteConfirmOpen) {
      setIsBulkDeleteConfirmOpen(true)
      return
    }

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", selectedLeads) 

      if (error) throw error
      
      console.log(`Bulk deleted ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setIsBulkDeleteConfirmOpen(false)
      window.location.reload()
      
    } catch (error) {
      console.error("Error bulk deleting leads:", error)
      setIsBulkDeleteConfirmOpen(false)
    }
  }

  const handleBulkExport = () => {
    if (selectedLeads.length === 0) {
      alert("Please select leads to export.")
      return
    }

    const leadsToExport = leads
      .filter(lead => selectedLeads.includes(lead.id))
      .map(lead => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        priority: lead.priority,
        loan_amount: lead.loan_amount,
        loan_type: lead.loan_type,
        source: lead.source,
        assigned_to: lead.assigned_user?.full_name || 'Unassigned',
        created_at: lead.created_at,
        last_contacted: lead.last_contacted,
        city: lead.city,
        follow_up_date: lead.follow_up_date,
      }))

    const headers = Object.keys(leadsToExport[0]).join(',')
    const rows = leadsToExport.map(lead => Object.values(lead)
      .map(value => {
        const stringValue = value !== null && value !== undefined ? String(value) : ""
        return stringValue.includes(',') || stringValue.includes('\n') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
      })
      .join(',')
    )
    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log(`Exported ${selectedLeads.length} leads.`)
    setSelectedLeads([])
  }

  const getPriorityVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "destructive"
      case "medium": return "default"
      case "low": return "secondary"
      default: return "secondary"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "new": return "bg-blue-100 text-blue-800"
      case "contacted": return "bg-yellow-100 text-yellow-800"
      case "interested": return "bg-green-100 text-green-800"
      case "not_eligible": return "bg-red-100 text-red-800"
      case "dead": return "bg-gray-100 text-gray-800"
      case "follow_up": return "bg-purple-100 text-purple-800"
      default: return "bg-gray-200 text-gray-800"
    }
  }

  // Columns definition (for column visibility and table headers)
  const columns = [
    { key: 'select', name: '' },
    { key: 'name', name: 'Name' },
    { key: 'contact', name: 'Contact' },
    { key: 'company', name: 'Company' },
    { key: 'status', name: 'Status' },
    { key: 'priority', name: 'Priority' },
    { key: 'created', name: 'Created' },
    { key: 'lastContacted', name: 'Last Contacted' },
    { key: 'loanAmount', name: 'Loan Amt.' },
    { key: 'loanType', name: 'Loan Type' },
    { key: 'source', name: 'Source' },
    { key: 'assignedTo', name: 'Assigned To' },
    { key: 'actions', name: 'Actions' },
  ]
  
  // All unique statuses for the filter dropdown
  const uniqueStatuses = Array.from(new Set(leads.map(lead => lead.status).filter(s => s)))
  
  // All unique priorities for the filter dropdown
  const uniquePriorities = Array.from(new Set(leads.map(lead => lead.priority).filter(p => p)))

  // Telecaller options including 'unassigned'
  const assignedToOptions = [
    { id: 'all', full_name: 'All Telecallers' },
    { id: 'unassigned', full_name: 'Unassigned' },
    ...telecallers
  ]

  // Pagination helper to generate the page numbers to display
  const getPaginationPages = () => {
    const pages = []
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="space-y-4">
      
      {/* Search and Bulk Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-4 border rounded-md bg-white shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 p-2">
              <div className="mb-2">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-2">
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {uniquePriorities.map(priority => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-2">
                <label className="text-sm font-medium text-gray-700">Assigned To</label>
                <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="All Telecallers" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedToOptions.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" className="w-full mt-2" onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setAssignedToFilter("all");
              }}>
                Clear Filters
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Bulk Actions and Column Visibility */}
        <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
          
          {/* Bulk Status Update */}
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Bulk Status" />
            </SelectTrigger>
            <SelectContent>
              {uniqueStatuses.map(status => (
                <SelectItem key={`bulk-${status}`} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleBulkStatusUpdate} 
            disabled={selectedLeads.length === 0 || !bulkStatus}
            variant="secondary"
          >
            Update
          </Button>

          {/* Bulk Assign (Using a placeholder for MultiSelect) */}
          <div className="w-32">
            <Select 
              value={bulkAssignTo[0] || ""} 
              onValueChange={(val) => setBulkAssignTo(val ? [val] : [])}
              disabled={selectedLeads.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bulk Assign" />
              </SelectTrigger>
              <SelectContent>
                {telecallers.map(t => (
                  <SelectItem key={`assign-${t.id}`} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleBulkAssign} 
            disabled={selectedLeads.length === 0 || bulkAssignTo.length === 0}
            variant="secondary"
          >
            Assign
          </Button>

          {/* Bulk Export */}
          <Button 
            onClick={handleBulkExport} 
            disabled={selectedLeads.length === 0}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {/* Bulk Delete */}
          <Button 
            onClick={handleBulkDelete}
            disabled={selectedLeads.length === 0}
            variant={isBulkDeleteConfirmOpen ? "destructive" : "outline"}
          >
            {isBulkDeleteConfirmOpen ? (
              <AlertCircle className="h-4 w-4 mr-2 text-white" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {isBulkDeleteConfirmOpen ? `Confirm Delete ${selectedLeads.length}` : 'Delete Bulk'}
          </Button>

          {/* Column Visibility Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {columns.filter(col => col.key !== 'select' && col.key !== 'actions').map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, [column.key]: checked }))
                  }
                >
                  {column.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Table Display */}
      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {/* Checkbox Header */}
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  checked={selectedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                  onChange={selectAllLeads}
                />
              </TableHead>
              
              {/* 🔑 CORRECTED: Using visibleColumns[col.key] */}
              {columns.filter(col => col.key !== 'select' && visibleColumns[col.key]).map((column) => (
                <TableHead 
                  key={column.key} 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.name}
                    {sortField === column.key && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLeads.map((lead) => {
              const assignedUserId = lead.assigned_user?.id
              const isAvailable = assignedUserId ? telecallerStatus[assignedUserId] : false
              
              const isSelected = selectedLeads.includes(lead.id)

              return (
                <TableRow key={lead.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                  {/* Selection Checkbox */}
                  <TableCell>
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={isSelected}
                      onChange={() => toggleLeadSelection(lead.id)}
                    />
                  </TableCell>

                  {/* 🔑 CORRECTED: Using visibleColumns.name */}
                  {visibleColumns.name && (
                    <TableCell className="font-medium text-blue-600 hover:underline">
                      <Link href={`/leads/${lead.id}`}>
                        {getSafeValue(lead.name)}
                      </Link>
                    </TableCell>
                  )}
                  
                  {visibleColumns.contact && (
                    <TableCell>
                      <div className="text-sm">
                        <Phone className="h-3 w-3 inline mr-1 text-gray-500" /> {getSafeValue(lead.phone)}
                      </div>
                      <div className="text-xs text-gray-500">
                        <Mail className="h-3 w-3 inline mr-1" /> {getSafeValue(lead.email)}
                      </div>
                    </TableCell>
                  )}
                  
                  {visibleColumns.company && <TableCell>{getSafeValue(lead.company)}</TableCell>}
                  
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge className={getStatusColor(lead.status)}>{getSafeValue(lead.status)}</Badge>
                    </TableCell>
                  )}
                  
                  {visibleColumns.priority && (
                    <TableCell>
                      <Badge variant={getPriorityVariant(lead.priority)}>{getSafeValue(lead.priority)}</Badge>
                    </TableCell>
                  )}

                  {visibleColumns.created && (
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(lead.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                  )}

                  {visibleColumns.lastContacted && (
                    <TableCell className="text-sm text-gray-500">
                      {lead.last_contacted ? format(new Date(lead.last_contacted), 'MMM dd, yyyy') : 'Never'}
                    </TableCell>
                  )}

                  {visibleColumns.loanAmount && (
                    <TableCell className="font-medium">
                      {lead.loan_amount ? `₹${lead.loan_amount.toLocaleString()}` : 'N/A'}
                    </TableCell>
                  )}

                  {visibleColumns.loanType && <TableCell>{getSafeValue(lead.loan_type)}</TableCell>}
                  {visibleColumns.source && <TableCell>{getSafeValue(lead.source)}</TableCell>}
                  
                  {visibleColumns.assignedTo && (
                    <TableCell>
                      {lead.assigned_user ? (
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                          {lead.assigned_user.full_name}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Unassigned</span>
                      )}
                    </TableCell>
                  )}
                  
                  {visibleColumns.actions && (
                    <TableCell className="w-20">
                      <QuickActions 
                        lead={lead}
                        onCallInitiate={() => handleCallInitiated(lead)}
                        onAssign={handleAssignLead}
                        onStatusChange={handleStatusChange}
                        telecallers={telecallers}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredLeads.length > 0 && (
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads (Total: {leads.length})
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
            
            <div className="flex space-x-1">
              {getPaginationPages().map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ))}
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
      
      {/* Lead Status Dialog / Quick Update */}
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) setIsCallInitiated(false) 
          }}
          onStatusUpdate={handleStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={handleCallLogged}
        />
      )}
    </div>
  )
}
