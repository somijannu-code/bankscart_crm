"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Clock, MessageSquare, IndianRupee, AlertCircle, Info } from "lucide-react" 
import { useCallTracking } from "@/context/call-tracking-context"
import { toast } from "sonner"
import { ScheduleFollowUpModal } from "./schedule-follow-up-modal" 
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface LeadStatusUpdaterProps {
  leadId: string
  currentStatus: string
  onStatusUpdate?: (newStatus: string, note?: string, callbackDate?: string) => void
  isCallInitiated?: boolean 
  onCallLogged?: (callLogId: string) => void 
  initialLoanAmount?: number | null 
  leadPhoneNumber: string | null | undefined
  telecallerName: string | null | undefined
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-800" },
  { value: "Interested", label: "Interested", color: "bg-green-100 text-green-800" },
  { value: "Documents_Sent", label: "Documents Sent", color: "bg-purple-100 text-purple-800" },
  { value: "Login", label: "Login", color: "bg-orange-100 text-orange-800" },
  { value: "Disbursed", label: "Disbursed", color: "bg-green-100 text-green-800" },
  { value: "Not_Interested", label: "Not Interested", color: "bg-red-100 text-red-800" },
  { value: "follow_up", label: "Call Back", color: "bg-indigo-100 text-indigo-800" },
  { value: "not_eligible", label: "Not Eligible", color: "bg-red-100 text-red-800" },
  { value: "nr", label: "NR", color: "bg-gray-100 text-gray-800" },
  { value: "self_employed", label: "Self Employed", color: "bg-amber-100 text-amber-800" },
]

const QUICK_NOTES = ["No Answer", "Busy", "Switch Off", "Asked to Call Later", "Wrong Number"];

export function LeadStatusUpdater({ 
  leadId, 
  currentStatus, 
  onStatusUpdate,
  isCallInitiated = false,
  onCallLogged,
  initialLoanAmount = null,
  leadPhoneNumber = "",
  telecallerName = "Telecaller",
}: LeadStatusUpdaterProps) {
  const supabase = createClient()
  const { activeCall, endCall, updateCallDuration, formatDuration } = useCallTracking()

  // --- STATE ---
  const [status, setStatus] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [note, setNote] = useState("") // Specifically for Not Eligible reason
  const [remarks, setRemarks] = useState("") // General Remarks
  const [loanAmount, setLoanAmount] = useState<number | null>(initialLoanAmount)
  const [isModalOpen, setIsModalOpen] = useState(false) 
  
  // Call Timer State
  const [callDuration, setCallDuration] = useState<number | null>(null)
  const [callMins, setCallMins] = useState<number | null>(null);
  const [callSecs, setCallSecs] = useState<number | null>(null);
  
  const [notEligibleReason, setNotEligibleReason] = useState<string>("")

  // --- DERIVED STATE ---
  const currentStatusOption = useMemo(() => STATUS_OPTIONS.find((o) => o.value === currentStatus), [currentStatus]);
  
  const whatsappLink = useMemo(() => {
      const cleaned = String(leadPhoneNumber || "").replace(/[^0-9]/g, '');
      if (!cleaned) return "#"; 
      const message = `hi sir this side ${telecallerName} from ICICI bank kindly share following documents`;
      return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  }, [leadPhoneNumber, telecallerName]);

  const isWhatsappEnabled = whatsappLink !== "#";

  // --- EFFECTS ---
  useEffect(() => { setLoanAmount(initialLoanAmount) }, [initialLoanAmount]);
  
  useEffect(() => {
    // Reset specific fields when status changes
    if (status !== 'not_eligible') {
      setNotEligibleReason("")
      if (status && !isUpdating) setNote("")
    }
    // Auto-set duration to 0 for NR
    if (isCallInitiated && status === 'nr') {
      setCallDuration(0); setCallMins(0); setCallSecs(0);
    } else if (status !== 'nr' && callDuration === 0) {
      setCallDuration(null); setCallMins(null); setCallSecs(null);
    }
  }, [status, isCallInitiated]);

  // --- HANDLERS ---
  const calculateTotalSeconds = (min: number | null, sec: number | null) => {
    const m = min ?? 0; const s = sec ?? 0;
    return (m * 60) + s;
  }

  const handleDurationChange = (type: 'min' | 'sec', val: string) => {
    const num = val === "" ? null : Number(val);
    if (type === 'min') {
        setCallMins(num);
        setCallDuration(calculateTotalSeconds(num, callSecs));
    } else {
        const safeSec = num !== null && num > 59 ? 59 : num;
        setCallSecs(safeSec);
        setCallDuration(calculateTotalSeconds(callMins, safeSec));
    }
  }

  const handleNotEligibleReasonChange = (reason: string) => {
    setNotEligibleReason(reason)
    setNote(reason === "Other" ? "" : reason) 
  }

  const handleQuickNote = (text: string) => {
      setRemarks(prev => prev ? `${prev}, ${text}` : text);
  }

  // --- CORE ACTIONS ---
  const updateLeadStatusToFollowUp = async () => {
    try {
      const updateData: any = { status: "follow_up", last_contacted: new Date().toISOString() }
      if (loanAmount !== null && !isNaN(loanAmount)) updateData.loan_amount = loanAmount
      if (remarks.trim()) updateData.notes = remarks

      const { error } = await supabase.from("leads").update(updateData).eq("id", leadId)
      if (error) throw error
      
      setStatus("follow_up")
      onStatusUpdate?.("follow_up", note) 
      setRemarks(""); setNote("");
      toast.success("Lead status set to Call Back.");
    } catch (error) { console.error(error); toast.error("Failed to update status.") }
  }

  const handleStatusUpdate = async () => {
    // Validation
    if (!status) { toast.error("Status Required", { description: "Please select a status." }); return }
    if (status === "not_eligible" && !note.trim()) { toast.error("Reason Required", { description: "Specify why not eligible." }); return }
    if (status === "follow_up") { setIsModalOpen(true); return }
    
    // Call Duration Validation
    if (isCallInitiated && status !== 'nr') {
        if (callDuration === null || callDuration <= 0) {
            toast.error("Invalid Duration", { description: "Call duration must be > 0 seconds." }); return
        }
    }

    setIsUpdating(true)
    try {
      let finalStatus = status; 
      const updateData: any = { last_contacted: new Date().toISOString() }
      
      if (loanAmount !== null && !isNaN(loanAmount)) updateData.loan_amount = loanAmount
      if (remarks.trim()) updateData.notes = remarks
      if (status === "not_eligible" && note.trim()) {
        updateData.notes = updateData.notes ? `${updateData.notes}\n\nNot Eligible: ${note}` : `Not Eligible: ${note}`
      }

      // --- AUTOMATION: TWO-STRIKE RULE ---
      if (status === "Not_Interested") {
        const { data: leadData } = await supabase.from("leads").select("tags").eq("id", leadId).single()
        let currentTags: string[] = [];
        try { currentTags = Array.isArray(leadData?.tags) ? leadData.tags : JSON.parse(leadData?.tags || '[]'); } catch(e){}
        
        if (currentTags.includes("NI_STRIKE_1")) {
            finalStatus = "dead_bucket" // Strike 2
        } else {
            finalStatus = "recycle_pool" // Strike 1
            updateData.tags = [...currentTags, "NI_STRIKE_1"]
        }
      }
      
      updateData.status = finalStatus;

      // Update DB
      const { error } = await supabase.from("leads").update(updateData).eq("id", leadId)
      if (error) throw error;
      
      onStatusUpdate?.(finalStatus, note) 
      
      // Log System Note
      if (finalStatus !== status) {
          const logContent = finalStatus === "recycle_pool" 
            ? "System: Lead marked 'Not Interested' (Strike 1). Recycled." 
            : "System: Lead marked 'Not Interested' twice. Moved to Dead Bucket.";
            
          const { data: { user } } = await supabase.auth.getUser()
          if(user) await supabase.from("notes").insert({ lead_id: leadId, user_id: user.id, content: logContent, note_type: "status_change" })
      }

      // Log Call if needed
      if (isCallInitiated) {
        await logCall(callDuration || 0)
      }
      
      // Reset UI
      setNote(""); setRemarks(""); setCallDuration(null); setCallMins(null); setCallSecs(null); setNotEligibleReason(""); setStatus("");
      toast.success("Updated successfully!")

    } catch (error: any) {
      console.error(error); toast.error(`Update failed: ${error.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  const logCall = async (duration: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // Use context duration if active call matches
        let finalDuration = duration
        if (activeCall && activeCall.leadId === leadId) finalDuration = await updateCallDuration(leadId, "")
        
        const { data } = await supabase.from("call_logs").insert({
            lead_id: leadId, user_id: user.id, call_type: "outbound", call_status: "connected",
            duration_seconds: finalDuration, notes: remarks || "Call initiated from lead details",
        }).select().single()
        
        if (activeCall && activeCall.leadId === leadId) endCall(leadId)
        if (data && onCallLogged) onCallLogged(data.id)
    } catch (error) { console.error("Call Log Error:", error) }
  }

  // --- RENDER HELPERS ---
  const isButtonDisabled = isUpdating || !status || (status === "not_eligible" && !note.trim());

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between py-3 bg-slate-50/50">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {isCallInitiated ? <Phone className="h-4 w-4 text-blue-600 animate-pulse"/> : <Activity className="h-4 w-4 text-slate-500"/>}
          {isCallInitiated ? "Active Call Session" : "Update Status"}
        </CardTitle>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <a 
                      href={whatsappLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={cn("p-2 rounded-full transition-all shadow-sm", isWhatsappEnabled ? "bg-green-500 hover:bg-green-600 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed")}
                      onClick={(e) => !isWhatsappEnabled && e.preventDefault()}
                    >
                        <MessageSquare className="h-4 w-4" /> 
                    </a>
                </TooltipTrigger>
                <TooltipContent><p>{isWhatsappEnabled ? "Chat on WhatsApp" : "No Phone Number"}</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </CardHeader>
      
      <CardContent className="space-y-5 pt-4">
        {/* Current Status Badge */}
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
          <span className="text-xs font-medium text-slate-500">CURRENT STATUS</span>
          <Badge className={cn("px-3 py-1", currentStatusOption?.color)}>{currentStatusOption?.label || currentStatus}</Badge>
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase">New Status</label>
            <Select value={status} onValueChange={(val) => {
                if (val === "follow_up") setIsModalOpen(true)
                else setStatus(val)
            }}>
              <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Select outcome..." /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
        </div>

        {/* Loan Amount Input */}
        <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1"><IndianRupee className="h-3 w-3"/> Loan Amount</label>
            <Input type="number" placeholder="0.00" value={loanAmount ?? ""} onChange={e => setLoanAmount(e.target.value ? Number(e.target.value) : null)} min="0" />
        </div>

        {/* Call Timer (Conditional) */}
        {isCallInitiated && (
            <div className="space-y-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
              <label className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><Clock className="h-3 w-3"/> Call Duration {status !== 'nr' && <span className="text-red-500">*</span>}</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Input type="number" placeholder="00" value={callMins ?? ""} onChange={e => handleDurationChange('min', e.target.value)} min="0" disabled={status === 'nr'} className="pr-8 bg-white" />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">m</span>
                </div>
                <span className="text-xl font-light text-slate-300">:</span>
                <div className="flex-1 relative">
                  <Input type="number" placeholder="00" value={callSecs ?? ""} onChange={e => handleDurationChange('sec', e.target.value)} min="0" max="59" disabled={status === 'nr'} className="pr-8 bg-white" />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">s</span>
                </div>
              </div>
              {status === 'nr' && <p className="text-[10px] text-blue-600 italic">Duration auto-set to 0 for NR.</p>}
            </div>
        )}

        {/* Not Eligible Reason (Conditional) */}
        {status === "not_eligible" && (
            <div className="space-y-2 p-3 bg-red-50 border border-red-100 rounded-md animate-in fade-in zoom-in-95 duration-200">
              <label className="text-xs font-bold text-red-800 uppercase flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Ineligibility Reason <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-1 gap-1">
                {["Salary in CASH", "Low CIBIL Score", "Other"].map((r) => (
                    <label key={r} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white/50 rounded">
                        <input type="radio" name="reason" value={r} checked={notEligibleReason === r} onChange={() => handleNotEligibleReasonChange(r)} className="accent-red-600" />
                        <span className="text-sm text-slate-700">{r}</span>
                    </label>
                ))}
              </div>
              {notEligibleReason === "Other" && (
                <Textarea placeholder="Specific reason..." value={note} onChange={e => setNote(e.target.value)} className="bg-white mt-2" />
              )}
            </div>
        )}

        {/* General Remarks */}
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 uppercase">Remarks</label>
                {/* Quick Note Chips */}
                <div className="flex gap-1">
                    {QUICK_NOTES.slice(0,3).map(q => (
                        <button key={q} onClick={() => handleQuickNote(q)} className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border transition-colors">{q}</button>
                    ))}
                </div>
            </div>
            <Textarea placeholder="Add notes..." value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} className="resize-none" />
        </div>

        {/* Submit Button */}
        <Button onClick={handleStatusUpdate} disabled={isButtonDisabled} className="w-full h-10 text-sm font-semibold shadow-sm">
            {isUpdating ? "Saving..." : isCallInitiated ? "End Call & Update" : "Update Status"}
        </Button>
      </CardContent>

      <ScheduleFollowUpModal 
        open={isModalOpen} 
        onOpenChange={(open) => { setIsModalOpen(open); if(!open) setStatus("") }} 
        onScheduleSuccess={updateLeadStatusToFollowUp} 
        defaultLeadId={leadId} 
      />
    </Card>
  )
}
