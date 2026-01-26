"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Clock, Eye, MessageSquare, 
  ChevronDown, ChevronUp, AlertCircle, Phone, ArrowUpRight, CheckSquare, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeadStatusDialog } from "@/components/lead-status-dialog" // Ensure this component exists
import { QuickActions } from "@/components/quick-actions" // Ensure this exists
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

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
  city: string | null
}

interface TelecallerLeadsTableProps {
  leads: Lead[]
  totalCount: number
  currentPage: number
  pageSize: number
  sortBy: string
  sortOrder: string
}

export function TelecallerLeadsTable({ 
  leads = [], 
  totalCount = 0, 
  currentPage = 1, 
  pageSize = 20,
  sortBy,
  sortOrder
}: TelecallerLeadsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isCallInitiated, setIsCallInitiated] = useState(false)
  
  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // --- 1. HANDLE SORTING ---
  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sortBy === field) {
      params.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sort_by', field)
      params.set('sort_order', 'desc')
    }
    router.push(`?${params.toString()}`)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="ml-1 h-3 w-3 opacity-20" />
    return sortOrder === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3 text-blue-600" /> 
      : <ChevronDown className="ml-1 h-3 w-3 text-blue-600" />
  }

  // --- 2. ACTIONS ---
  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  // **FIXED: Handle Call Logged is now defined**
  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false)
    toast.success("Call logged successfully")
    router.refresh()
  }

  const getWhatsAppLink = (phone: string, name: string) => {
    if (!phone) return "#"
    const cleanedPhone = phone.replace(/\D/g, '')
    const message = `Hi ${name || "there"}, this is from ICICI Bank regarding your loan inquiry.`
    return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`
  }

  const isStale = (lastContacted: string | null, status: string) => {
    if(!lastContacted) return true;
    if(['Disbursed', 'Not_Interested', 'not_eligible'].includes(status)) return false;
    const diff = new Date().getTime() - new Date(lastContacted).getTime();
    return diff > (48 * 60 * 60 * 1000); 
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  // --- 3. STATUS UPDATER ---
  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    if (!selectedLead) return
    try {
        const updateData: any = { 
            status: newStatus,
            last_contacted: new Date().toISOString()
        }
        
        if (newStatus === "follow_up" && callbackDate) {
            await supabase.from("follow_ups").insert({
                lead_id: selectedLead.id,
                scheduled_date: callbackDate,
                status: "scheduled"
            })
            updateData.follow_up_date = callbackDate
        }

        if (note) {
             await supabase.from("notes").insert({
                lead_id: selectedLead.id,
                note: note,
                note_type: "status_change"
             })
        }

        await supabase.from("leads").update(updateData).eq("id", selectedLead.id)
        
        toast.success(`Status updated to ${newStatus}`)
        setIsStatusDialogOpen(false)
        router.refresh()
    } catch (e: any) {
        toast.error("Update failed", { description: e.message })
    }
  }

  // --- 4. BULK ACTIONS ---
  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) setSelectedIds([])
    else setSelectedIds(leads.map(l => l.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return
    try {
      await supabase.from('leads').update({ status, last_contacted: new Date().toISOString() }).in('id', selectedIds)
      toast.success(`Updated ${selectedIds.length} leads to ${status}`)
      setSelectedIds([])
      router.refresh()
    } catch (e) { console.error(e) }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (leads.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed">No leads found matching your filters.</div>
  }

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 p-2 px-4 rounded-md border border-blue-200 animate-in slide-in-from-top-2">
          <span className="text-sm font-medium text-blue-800">{selectedIds.length} Selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => handleBulkStatus('nr')}>Mark NR</Button>
            <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => handleBulkStatus('Not_Interested')}>Mark NI</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedIds([])}><X className="h-4 w-4"/></Button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={selectedIds.length === leads.length} onChange={toggleSelectAll} className="rounded border-gray-300"/>
              </TableHead>
              <TableHead className="w-[250px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name <SortIcon field="name"/></div>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('loan_amount')}>
                  <div className="flex items-center">Amount <SortIcon field="loan_amount"/></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('priority')}>
                  <div className="flex items-center">Priority <SortIcon field="priority"/></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('last_contacted')}>
                  <div className="flex items-center">Last Contact <SortIcon field="last_contacted"/></div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const stale = isStale(lead.last_contacted, lead.status);
              return (
                <TableRow key={lead.id} className="group hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-gray-300"/>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link href={`/telecaller/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-2">
                          {lead.name}
                      </Link>
                      {lead.company && (
                          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building className="h-3 w-3" /> {lead.company}
                          </span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                      <div className="flex items-center gap-2">
                          <QuickActions 
                              phone={lead.phone || ""} 
                              email={lead.email || ""} 
                              leadId={lead.id} 
                              onCallInitiated={() => handleCallInitiated(lead)} 
                          />
                          <TooltipProvider>
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <a href={getWhatsAppLink(lead.phone || '', lead.name)} target="_blank" className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                                          <MessageSquare className="h-4 w-4" />
                                      </a>
                                  </TooltipTrigger>
                                  <TooltipContent>WhatsApp</TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      </div>
                  </TableCell>

                  <TableCell>
                     <Badge variant="outline" className={cn(
                         "capitalize font-medium border-0 px-2 py-0.5", 
                         lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                         lead.status === 'Interested' ? 'bg-green-100 text-green-700' :
                         lead.status === 'Disbursed' ? 'bg-emerald-100 text-emerald-700' :
                         'bg-slate-100 text-slate-700'
                     )}>
                       {lead.status?.replace(/_/g, " ")}
                     </Badge>
                  </TableCell>

                  <TableCell className="font-mono text-sm text-slate-600">
                      {formatCurrency(lead.loan_amount)}
                  </TableCell>

                  <TableCell>
                      {lead.priority === 'high' && <Badge variant="destructive" className="text-[10px]">HIGH</Badge>}
                      {lead.priority === 'medium' && <Badge variant="secondary" className="text-[10px]">MED</Badge>}
                      {lead.priority === 'low' && <Badge variant="outline" className="text-[10px]">LOW</Badge>}
                  </TableCell>

                  <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                          <Clock className={cn("h-3.5 w-3.5", stale ? "text-red-500" : "text-slate-400")} />
                          <span className={cn(stale ? "text-red-600 font-medium" : "text-slate-500")}>
                              {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : 'Never'}
                          </span>
                      </div>
                  </TableCell>

                  <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedLead(lead); setIsStatusDialogOpen(true); }}>
                          Update
                      </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="py-4 border-t flex justify-between items-center">
        <div className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
        </div>
        {totalPages > 1 && (
            <Pagination>
            <PaginationContent>
                <PaginationItem>
                <PaginationPrevious 
                    href={`?page=${Math.max(1, currentPage - 1)}`} 
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
                </PaginationItem>
                <PaginationItem>
                <PaginationNext 
                    href={`?page=${Math.min(totalPages, currentPage + 1)}`} 
                    className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                />
                </PaginationItem>
            </PaginationContent>
            </Pagination>
        )}
      </div>

      {/* Shared Dialog for Status Update */}
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) { setIsCallInitiated(false); setSelectedLead(null); }
          }}
          onStatusUpdate={handleStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={handleCallLogged} // PASSED HERE
        />
      )}
    </div>
  )
}
