"use client";

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { 
  Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download, 
  MoreHorizontal, Check, X, AlertCircle, TrendingUp, 
  TrendingDown, Activity, MessageSquare, PhoneCall, 
  Tag, Plus, Trash2, Users, Layout, Table as TableIcon,
  CheckCircle2, XCircle, Upload, Pencil, Zap
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
  DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

// --- Interfaces ---

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
  assigned_user: { id: string; full_name: string } | null
  city: string | null
  follow_up_date: string | null
  tags?: string[]
  notes?: string
}

interface LeadsTableProps {
  leads: Lead[]
  telecallers: Array<{ id: string; full_name: string }>
  telecallerStatus: Record<string, boolean>
  totalCount: number
  currentPage: number
  pageSize: number
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
      if (isEditing && inputRef.current) inputRef.current.focus();
    }, [isEditing]);

    const handleSave = async () => {
        setIsEditing(false);
        if (currentValue !== (value?.toString() || "")) await onSave(currentValue);
    };

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                type={type}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="h-7 text-xs px-2 min-w-[120px]"
            />
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)} 
            className={cn("cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -ml-1.5 border border-transparent hover:border-border transition-colors group flex items-center gap-2", !value && "text-muted-foreground italic", className)}
        >
            <span className="truncate">{value || "Empty"}</span>
            {suffix}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0" />
        </div>
    );
};

// --- Main Component ---

export function LeadsTable({ leads = [], telecallers = [], telecallerStatus = {}, totalCount, currentPage, pageSize }: LeadsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isCallInitiated, setIsCallInitiated] = useState(false)
  
  // Bulk Action States
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showSMSDialog, setShowSMSDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [smsBody, setSmsBody] = useState("")
  
  // UI States
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true, contact: true, company: false, status: true, notes: true,
    priority: false, created: true, lastContacted: true, loanAmount: true,
    loanType: false, source: false, tags: true, assignedTo: true, actions: true
  })

  // Calculate scores/badges on the fly (lightweight)
  const calculateLeadScore = (lead: Lead) => {
    let score = 0
    if (lead.status === 'Interested') score += 20
    else if (lead.status === 'contacted') score += 10
    if (lead.priority === 'high') score += 15
    return Math.min(score + 10, 100)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`?${params.toString()}`)
  }

  // Handle Updates
  const handleInlineUpdate = async (leadId: string, field: string, value: string | number) => {
    try {
        await supabase.from("leads").update({ [field]: value }).eq("id", leadId);
        router.refresh()
    } catch (error) { console.error(error) }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await supabase.from("leads").update({ 
          status: newStatus,
          last_contacted: new Date().toISOString()
      }).eq("id", leadId)
      router.refresh()
    } catch (error) { console.error(error) }
  }

  const handleAssignLead = async (leadId: string, telecallerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("leads").update({ 
          assigned_to: telecallerId === "unassigned" ? null : telecallerId,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString()
      }).eq("id", leadId)
      router.refresh()
    } catch (error) { console.error(error) }
  }

  // Bulk Actions
  const handleBulkAssign = async () => {
    if (bulkAssignTo.length === 0 || selectedLeads.length === 0) return
    const { data: { user } } = await supabase.auth.getUser()
    const updates = selectedLeads.map((leadId, idx) => ({
       id: leadId,
       assigned_to: bulkAssignTo[idx % bulkAssignTo.length], // Round robin distribution
       assigned_by: user?.id,
       assigned_at: new Date().toISOString()
    }))

    for (const u of updates) {
        await supabase.from("leads").update(u).eq("id", u.id)
    }
    setSelectedLeads([])
    setBulkAssignTo([])
    router.refresh()
  }

  const handleBulkStatusUpdate = async () => {
      if (!bulkStatus) return
      await supabase.from("leads").update({ 
          status: bulkStatus,
          last_contacted: new Date().toISOString()
      }).in("id", selectedLeads)
      setSelectedLeads([])
      router.refresh()
  }

  const handleBulkDelete = async () => {
      if (!confirm(`Delete ${selectedLeads.length} leads?`)) return
      await supabase.from("leads").delete().in("id", selectedLeads)
      setSelectedLeads([])
      router.refresh()
  }

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId])
  }

  const selectAllLeads = () => {
    if (selectedLeads.length === leads.length) setSelectedLeads([])
    else setSelectedLeads(leads.map(l => l.id))
  }

  const getPriorityVariant = (p: string) => p === "high" ? "destructive" : p === "medium" ? "default" : "secondary"

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex justify-between items-center">
        <div className="flex bg-muted rounded-md p-1 items-center">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-3" onClick={() => setViewMode('table')}>
                <TableIcon className="h-4 w-4 mr-1" /> List
            </Button>
            <Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-3" onClick={() => setViewMode('board')}>
                <Layout className="h-4 w-4 mr-1" /> Board
            </Button>
        </div>
        
        {/* Columns Dropdown */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Columns <ChevronDown className="h-4 w-4 ml-2" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {Object.keys(visibleColumns).map(key => (
                    <DropdownMenuCheckboxItem 
                        key={key} 
                        checked={visibleColumns[key]}
                        onCheckedChange={(checked) => setVisibleColumns(prev => ({...prev, [key]: checked}))}
                    >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk Actions Bar (Only visible when selection > 0) */}
      {selectedLeads.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-sm font-medium text-blue-800 ml-2">{selectedLeads.length} selected</span>
              <div className="h-4 border-l border-blue-300 mx-2" />
              
              <Select onValueChange={setBulkStatus}>
                  <SelectTrigger className="h-8 w-32 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="Interested">Interested</SelectItem>
                      <SelectItem value="Not_Interested">Closed</SelectItem>
                  </SelectContent>
              </Select>
              <Button size="sm" variant="secondary" onClick={handleBulkStatusUpdate}>Update</Button>
              
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="bg-white">Assign ({bulkAssignTo.length})</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Select Telecallers</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {telecallers.map(tc => (
                          <DropdownMenuCheckboxItem 
                              key={tc.id}
                              checked={bulkAssignTo.includes(tc.id)}
                              onCheckedChange={(c) => setBulkAssignTo(prev => c ? [...prev, tc.id] : prev.filter(id => id !== tc.id))}
                          >
                             {tc.full_name} {telecallerStatus[tc.id] && "🟢"}
                          </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={handleBulkAssign} disabled={bulkAssignTo.length === 0}>Apply Assign</Button>
              
              <div className="flex-1" />
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}><Trash2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedLeads([])}><X className="h-4 w-4" /></Button>
          </div>
      )}

      {/* Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">
                            <input type="checkbox" checked={leads.length > 0 && selectedLeads.length === leads.length} onChange={selectAllLeads} />
                        </TableHead>
                        {visibleColumns.name && <TableHead>Name</TableHead>}
                        {visibleColumns.contact && <TableHead>Contact</TableHead>}
                        {visibleColumns.status && <TableHead>Status</TableHead>}
                        {visibleColumns.priority && <TableHead>Priority</TableHead>}
                        {visibleColumns.lastContacted && <TableHead>Last Contact</TableHead>}
                        {visibleColumns.loanAmount && <TableHead>Amount</TableHead>}
                        {visibleColumns.assignedTo && <TableHead>Assigned To</TableHead>}
                        {visibleColumns.actions && <TableHead>Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.map(lead => (
                        <TableRow key={lead.id}>
                            <TableCell><input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => toggleLeadSelection(lead.id)} /></TableCell>
                            {visibleColumns.name && (
                                <TableCell>
                                    <InlineEditableCell value={lead.name} onSave={(v) => handleInlineUpdate(lead.id, 'name', v)} className="font-medium" />
                                    <div className="text-xs text-muted-foreground">{lead.company}</div>
                                </TableCell>
                            )}
                            {visibleColumns.contact && (
                                <TableCell>
                                    <div className="flex flex-col gap-1 text-sm">
                                        <InlineEditableCell value={lead.phone} type="tel" onSave={(v) => handleInlineUpdate(lead.id, 'phone', v)} />
                                        <InlineEditableCell value={lead.email} type="email" onSave={(v) => handleInlineUpdate(lead.id, 'email', v)} />
                                    </div>
                                </TableCell>
                            )}
                            {visibleColumns.status && (
                                <TableCell>
                                    <Select value={lead.status} onValueChange={(v) => handleStatusChange(lead.id, v)}>
                                        <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="contacted">Contacted</SelectItem>
                                            <SelectItem value="Interested">Interested</SelectItem>
                                            <SelectItem value="Documents_Sent">Docs Sent</SelectItem>
                                            <SelectItem value="Login">Login</SelectItem>
                                            <SelectItem value="Disbursed">Disbursed</SelectItem>
                                            <SelectItem value="nr">Not Reachable</SelectItem>
                                            <SelectItem value="Not_Interested">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            )}
                            {visibleColumns.priority && (
                                <TableCell>
                                    <Badge variant={getPriorityVariant(lead.priority) as any}>{lead.priority}</Badge>
                                </TableCell>
                            )}
                            {visibleColumns.lastContacted && (
                                <TableCell>
                                    <div className="text-sm">
                                        {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : 'Never'}
                                        <div className="text-xs text-muted-foreground">
                                            {lead.last_contacted && new Date(lead.last_contacted).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </TableCell>
                            )}
                            {visibleColumns.loanAmount && (
                                <TableCell>
                                    <InlineEditableCell 
                                        value={lead.loan_amount} type="number" 
                                        onSave={(v) => handleInlineUpdate(lead.id, 'loan_amount', v)} 
                                        suffix={<span className="text-xs text-muted-foreground">₹</span>}
                                    />
                                </TableCell>
                            )}
                            {visibleColumns.assignedTo && (
                                <TableCell>
                                    <Select value={lead.assigned_to || "unassigned"} onValueChange={(v) => handleAssignLead(lead.id, v)}>
                                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {telecallers.map(tc => (
                                                <SelectItem key={tc.id} value={tc.id}>
                                                    {tc.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            )}
                            {visibleColumns.actions && (
                                <TableCell>
                                    <div className="flex gap-2">
                                        <QuickActions 
                                            lead={lead} 
                                            onCallInitiated={() => { setSelectedLead(lead); setIsCallInitiated(true); setIsStatusDialogOpen(true); }}
                                            onStatusChange={(s) => handleStatusChange(lead.id, s)}
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                                            <Link href={`/admin/leads/${lead.id}`}><Eye className="h-4 w-4" /></Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            Kanban view shows only the current page ({leads.length} leads). Switch to Table view for full management.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="justify-end">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious 
                        href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) handlePageChange(currentPage - 1) }} 
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>
                <div className="flex items-center text-sm font-medium mx-2">
                    Page {currentPage} of {totalPages}
                </div>
                <PaginationItem>
                    <PaginationNext 
                        href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) handlePageChange(currentPage + 1) }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
      )}

      {/* Dialogs */}
      <LeadStatusDialog 
        open={isStatusDialogOpen} 
        onOpenChange={setIsStatusDialogOpen}
        lead={selectedLead} 
        onStatusUpdate={handleStatusChange} 
        onCallLogged={() => setIsCallInitiated(false)}
        isCallInitiated={isCallInitiated}
      />
    </div>
  )
}
