"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  User, Building, Clock, Eye, MessageSquare, 
  ChevronDown, ChevronUp, AlertCircle, Phone, ArrowUpRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeadStatusDialog } from "@/components/lead-status-dialog"
import { QuickActions } from "@/components/quick-actions"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isCallInitiated, setIsCallInitiated] = useState(false)

  // --- 1. HANDLE SORTING VIA URL ---
  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sortBy === field) {
      params.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sort_by', field)
      params.set('sort_order', 'desc') // Default to desc for new field
    }
    router.push(`?${params.toString()}`)
  }

  // --- 2. RENDER SORT ICON ---
  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="ml-1 h-3 w-3 opacity-20" />
    return sortOrder === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3 text-blue-600" /> 
      : <ChevronDown className="ml-1 h-3 w-3 text-blue-600" />
  }

  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }

  // --- 3. WHATSAPP LINK GENERATOR ---
  const getWhatsAppLink = (phone: string, name: string) => {
    if (!phone) return "#"
    const cleanedPhone = phone.replace(/\D/g, '')
    const message = `Hi ${name || "there"}, this is from ICICI Bank. regarding your loan inquiry...`
    return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`
  }

  // --- 4. STALE CHECK ---
  const isStale = (lastContacted: string | null, status: string) => {
    if(!lastContacted) return true;
    if(['Disbursed', 'Not_Interested', 'not_eligible'].includes(status)) return false;
    const diff = new Date().getTime() - new Date(lastContacted).getTime();
    return diff > (48 * 60 * 60 * 1000); // 48 Hours
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  // --- 5. STATUS UPDATER ---
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
        router.refresh() // Refresh Server Component
    } catch (e) {
        console.error(e)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (leads.length === 0) {
    return <div className="p-8 text-center text-gray-500">No leads found matching your filters.</div>
  }

  return (
    <div>
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
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
                  <div className="flex flex-col">
                    <Link href={`/telecaller/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-2">
                        {lead.name}
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                                    <a href={getWhatsAppLink(lead.phone, lead.name)} target="_blank" className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
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
                       "capitalize font-medium border-0", 
                       lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                       lead.status === 'Interested' ? 'bg-green-100 text-green-700' :
                       lead.status === 'Disbursed' ? 'bg-emerald-100 text-emerald-700' :
                       'bg-slate-100 text-slate-700'
                   )}>
                     {lead.status?.replace(/_/g, " ")}
                   </Badge>
                </TableCell>

                <TableCell className="font-mono text-sm">
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
                        {stale && <AlertCircle className="h-3 w-3 text-red-500 animate-pulse" />}
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

      {/* Pagination */}
      <div className="py-4 border-t flex justify-end">
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
                    <div className="px-4 text-sm text-slate-500">
                        Page {currentPage} of {totalPages}
                    </div>
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
          onCallLogged={handleCallLogged}
        />
      )}
    </div>
  )
}
