"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { 
  Phone, Mail, Calendar, Clock, MoreHorizontal, Check, X, 
  AlertCircle, Tag, TrendingUp, AlertTriangle, ArrowRight,
  MessageSquare, User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

// ... (Keep existing interfaces)

export function LeadsTable({ leads = [], telecallers = [], totalCount, currentPage, pageSize }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedLead, setSelectedLead] = useState<any | null>(null) // For slide-over
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // --- HELPER: Detect "Stale" Leads ---
  const getLeadStatusColor = (lead: any) => {
    // If touched recently (last 3 days), green dot
    // If untouched for 7+ days, red dot
    const lastInteraction = lead.last_contacted || lead.created_at
    const diffDays = (new Date().getTime() - new Date(lastInteraction).getTime()) / (1000 * 3600 * 24)
    
    if (diffDays < 3) return "bg-green-500"
    if (diffDays > 7) return "bg-red-500 animate-pulse" // Visual urgency
    return "bg-yellow-500"
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await supabase.from("leads").update({ 
      status: newStatus,
      last_contacted: new Date().toISOString()
    }).eq("id", leadId)
    router.refresh() // Refresh server data
  }

  const handleAssign = async (leadId: string, userId: string) => {
    await supabase.from("leads").update({ 
      assigned_to: userId === 'unassigned' ? null : userId,
      assigned_at: new Date().toISOString()
    }).eq("id", leadId)
    router.refresh()
  }

  return (
    <>
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="w-[250px]">Lead Details</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead: any) => (
            <TableRow key={lead.id} className="group hover:bg-slate-50/80 transition-colors">
              
              {/* 1. Enhanced Name Column with "Rot" Indicator */}
              <TableCell>
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${getLeadStatusColor(lead)}`} 
                       title="Activity Status (Red = Stale)" />
                  <div>
                    <button 
                      onClick={() => { setSelectedLead(lead); setIsPreviewOpen(true) }}
                      className="font-semibold text-gray-900 hover:text-blue-600 text-left"
                    >
                      {lead.name}
                    </button>
                    <div className="flex flex-col text-xs text-muted-foreground mt-0.5 space-y-0.5">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3"/> {lead.phone}</span>
                      {lead.company && <span className="font-medium text-gray-600">{lead.company}</span>}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* 2. Quick Status Dropdown */}
              <TableCell>
                <Select value={lead.status} onValueChange={(v) => handleStatusChange(lead.id, v)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="Interested">Interested</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="nr">Not Reachable</SelectItem>
                    <SelectItem value="Disbursed">Disbursed</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>

              {/* 3. Lead Score Badge */}
              <TableCell>
                 {(lead.lead_score || 0) > 70 ? (
                   <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                     <TrendingUp className="h-3 w-3 mr-1" /> {lead.lead_score} Hot
                   </Badge>
                 ) : (
                   <span className="text-sm font-medium text-gray-600">{lead.lead_score || 0}</span>
                 )}
              </TableCell>

              {/* 4. Assignee Selector */}
              <TableCell>
                <Select value={lead.assigned_to || "unassigned"} onValueChange={(v) => handleAssign(lead.id, v)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs border-dashed text-muted-foreground data-[state=checked]:text-black">
                     <div className="flex items-center gap-2 truncate">
                       <User className="h-3 w-3" />
                       <span className="truncate">{lead.assigned_user?.full_name || "Unassigned"}</span>
                     </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {telecallers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>

              {/* 5. Relative Time (Human Readable) */}
              <TableCell>
                <div className="text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lead.last_contacted 
                      ? formatDistanceToNow(new Date(lead.last_contacted), { addSuffix: true }) 
                      : 'Never'}
                  </div>
                  <div className="text-[10px] mt-1 text-gray-400">
                    Created: {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>
              </TableCell>

              {/* 6. Action Buttons */}
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50">
                     <Phone className="h-4 w-4" />
                   </Button>
                   <Link href={`/admin/leads/${lead.id}`}>
                     <Button size="icon" variant="outline" className="h-8 w-8">
                       <ArrowRight className="h-4 w-4" />
                     </Button>
                   </Link>
                </div>
              </TableCell>

            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* 7. Super CRM: Slide-over Preview Sheet */}
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl">{selectedLead?.name}</SheetTitle>
            <SheetDescription>
               {selectedLead?.company} • {selectedLead?.email}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                   <p className="text-xs text-gray-500">Loan Amount</p>
                   <p className="font-semibold text-lg">₹{selectedLead?.loan_amount?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                   <p className="text-xs text-gray-500">Source</p>
                   <Badge variant="outline">{selectedLead?.source || 'Unknown'}</Badge>
                </div>
             </div>

             {/* Mini Timeline */}
             <div>
               <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                 <MessageSquare className="h-4 w-4" /> Recent Notes
               </h4>
               <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                 {/* This would ideally map over notes fetched for this lead */}
                 {selectedLead?.notes ? (
                    <div className="pl-4 relative">
                      <div className="absolute -left-[21px] top-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white" />
                      <p className="text-sm text-gray-700">{selectedLead.notes}</p>
                      <p className="text-xs text-gray-400 mt-1">Primary Note</p>
                    </div>
                 ) : (
                    <p className="text-sm text-gray-400 italic pl-4">No notes available</p>
                 )}
               </div>
             </div>
             
             <div className="flex gap-3 pt-4">
               <Link href={`/admin/leads/${selectedLead?.id}`} className="w-full">
                 <Button className="w-full">Open Full Profile</Button>
               </Link>
             </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Pagination Controls (Pass params to URL to trigger Server Refresh) */}
      <div className="flex items-center justify-between px-4 py-4 border-t bg-white">
        <span className="text-sm text-gray-500">
          Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
        </span>
        <div className="flex gap-2">
           <Button 
             variant="outline" 
             size="sm" 
             disabled={currentPage <= 1}
             onClick={() => router.push(`?page=${currentPage - 1}`)}
           >
             Previous
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             disabled={currentPage * pageSize >= totalCount}
             onClick={() => router.push(`?page=${currentPage + 1}`)}
           >
             Next
           </Button>
        </div>
      </div>
    </>
  )
}
