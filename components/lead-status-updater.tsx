// components/lead-status-updater.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Clock, MessageSquare, IndianRupee, AlertCircle } from "lucide-react" 
import { useCallTracking } from "@/context/call-tracking-context"
import { toast } from "sonner"
import { ScheduleFollowUpModal } from "./schedule-follow-up-modal" 
import { format } from "date-fns"
import { cn } from "@/lib/utils"


interface LeadStatusUpdaterProps {
  leadId: string
  currentStatus: string
  onStatusUpdate?: (newStatus: string, note?: string, callbackDate?: string) => void
  isCallInitiated?: boolean // New prop to indicate if this is for a call
  onCallLogged?: (callLogId: string) => void // New prop to notify when call is logged
  initialLoanAmount?: number | null // New prop for initial loan amount
  // Ensure we can receive null/undefined safely
  leadPhoneNumber: string | null | undefined
  telecallerName: string | null | undefined
}

const statusOptions = [
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

export function LeadStatusUpdater({ 
  leadId, 
  currentStatus, 
  onStatusUpdate,
  isCallInitiated = false,
  onCallLogged,
  initialLoanAmount = null,
  // Use non-null defaults to prevent runtime errors in the component body
  leadPhoneNumber = "",
  telecallerName = "Telecaller",
}: LeadStatusUpdaterProps) {
  // Status always starts as "" to force selection, even when isCallInitiated.
  const [status, setStatus] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [note, setNote] = useState("") 
  const [remarks, setRemarks] = useState("")
  // MODIFIED: callDuration initialized to null instead of 0
  const [callDuration, setCallDuration] = useState<number | null>(null)
  const [loanAmount, setLoanAmount] = useState<number | null>(initialLoanAmount)
  const [isModalOpen, setIsModalOpen] = useState(false) 
  // Keep tempStatus initialized to currentStatus for the modal logic when it opens
  const [tempStatus, setTempStatus] = useState(currentStatus) 

  // NEW STATE: For minutes and seconds input fields
  const [callMins, setCallMins] = useState<number | null>(null);
  const [callSecs, setCallSecs] = useState<number | null>(null);

  // NEW STATE: To track which Not Eligible reason is selected
  const [notEligibleReason, setNotEligibleReason] = useState<string>("")

  const supabase = createClient()
  const { activeCall, startCall, endCall, updateCallDuration, formatDuration } = useCallTracking()

  // CONSTANT FOR WHATSAPP MESSAGE
  const WHATSAPP_MESSAGE_BASE = "hi sir this side {telecaller_name} from ICICI bank kindly share following documents";

  // New constant for a robustly cleaned phone number
  const cleanedPhoneNumber = String(leadPhoneNumber || "").replace(/[^0-9]/g, '');

  const getWhatsappLink = () => {
      if (!cleanedPhoneNumber) return "#"; 
      const message = WHATSAPP_MESSAGE_BASE.replace("{telecaller_name}", telecallerName)
      const encodedMessage = encodeURIComponent(message)
      return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`
  }

  useEffect(() => {
    setLoanAmount(initialLoanAmount)
  }, [initialLoanAmount])
  
  // Reset Not Eligible specific states when status changes away from not_eligible
  useEffect(() => {
    if (status !== 'not_eligible') {
      setNotEligibleReason("")
      // If we switch away from not_eligible, we might want to clear the note
      // unless the user typed something they want to keep. 
      // For now, let's clear it to avoid sending "Low CIBIL Score" as a note for "Interested" status accidentally.
      if (status !== "" && !isUpdating) {
         setNote("")
      }
    }
  }, [status, isUpdating]);

  // NEW useEffect: Set call duration to 0 automatically when 'nr' is selected and a call was initiated
  useEffect(() => {
    if (isCallInitiated && status === 'nr') {
      setCallDuration(0);
      setCallMins(0); 
      setCallSecs(0);
    } else if (status !== 'nr' && callDuration === 0) {
      setCallDuration(null);
      setCallMins(null); 
      setCallSecs(null);
    }
  }, [status, isCallInitiated]);

  const calculateTotalSeconds = (minutes: number | null, seconds: number | null): number | null => {
    const min = minutes ?? 0;
    const sec = seconds ?? 0;
    if (min < 0 || sec < 0) return null;
    if (min === 0 && sec === 0 && (minutes === null && seconds === null)) return null;
    return (min * 60) + sec;
  }

  const handleMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minutes = value === "" ? null : Number(value);
    setCallMins(minutes);
    const totalSeconds = calculateTotalSeconds(minutes, callSecs);
    setCallDuration(totalSeconds);
  }

  const handleSecsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let seconds = value === "" ? null : Number(value);
    if (seconds !== null && seconds > 59) seconds = 59;
    setCallSecs(seconds);
    const totalSeconds = calculateTotalSeconds(callMins, seconds);
    setCallDuration(totalSeconds);
  }

  // NEW HANDLER: Handle Not Eligible Radio Changes
  const handleNotEligibleReasonChange = (reason: string) => {
    setNotEligibleReason(reason)
    if (reason === "Other") {
      setNote("") // Clear note so user can type manually
    } else {
      setNote(reason) // Auto-fill note with the predefined reason
    }
  }

  const updateLeadStatusToFollowUp = async () => {
    try {
      const updateData: any = { 
        status: "follow_up",
        last_contacted: new Date().toISOString()
      }

      if (loanAmount !== null && !isNaN(loanAmount) && loanAmount >= 0) {
        updateData.loan_amount = loanAmount
      }

      if (remarks.trim()) {
        updateData.notes = remarks
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId)
        
      if (error) throw error
      
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { error: noteError } = await supabase
          .from("notes")
          .insert({
            lead_id: leadId,
            user_id: user.id,
            content: "Status changed to: Call Back (Follow-up scheduled)",
            note_type: "status_change", 
          })
        
        if (noteError) console.error("Error logging follow_up status change note:", noteError)
      }

      setStatus("follow_up")
      onStatusUpdate?.("follow_up", note) 
      
      setRemarks("")
      setNote("")

      toast.success("Lead status set to Call Back (Follow-up scheduled separately).");

    } catch (error) {
      console.error("Error updating lead status to follow_up:", error)
      toast.error("Error setting lead status to Call Back", {
        description: "Please update status manually."
      })
    }
  }


  const handleStatusUpdate = async () => {
    
    // --- START VALIDATION CHECK ---
    const isNotEligible = status === "not_eligible"
    const isNoteEmpty = !note.trim()
    const isNRStatus = status === 'nr'

    if (!status) {
       toast.error("Validation Failed", {
        description: "Please select a status before submitting."
      })
      return
    }

    if (isNotEligible && isNoteEmpty) {
      toast.error("Validation Failed", {
        description: "Please specify the 'Reason for Not Eligible' before updating the status."
      })
      return 
    }
    
    if (status === "follow_up") {
      if (!isModalOpen) {
        setIsModalOpen(true);
      }
      toast.error("Action required", {
        description: "Please use the 'Schedule Follow-up' modal to set the callback date and time."
      })
      return
    }

    if (isCallInitiated && !isNRStatus) {
      if (callDuration === null || callDuration <= 0) {
        toast.error("Validation Failed", {
          description: "Call Duration is mandatory and must be greater than 0 for this status."
        })
        return
      }
    }
    
    if (isCallInitiated && isNRStatus && callDuration === null) {
      setCallDuration(0) 
    }
    // --- END VALIDATION CHECK ---

    setIsUpdating(true)
    try {
      const updateData: any = { 
        status: status,
        last_contacted: new Date().toISOString()
      }
      
      if (loanAmount !== null && !isNaN(loanAmount) && loanAmount >= 0) {
        updateData.loan_amount = loanAmount
      }

      if (remarks.trim()) {
        updateData.notes = remarks
      }
      
      if (isNotEligible && note.trim()) {
        updateData.notes = updateData.notes ? `${updateData.notes}\n\nReason for Not Eligible: ${note}` : `Reason for Not Eligible: ${note}`
      }

      if (status !== currentStatus || isCallInitiated) {
          const { error } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", leadId)

          if (error) throw error
          
          onStatusUpdate?.(status, note) 
          
          const { data: { user } } = await supabase.auth.getUser()

          if (user && status !== currentStatus) {
            const newStatusLabel = statusOptions.find(o => o.value === status)?.label || status.replace(/_/g, ' ')
            
            const { error: noteError } = await supabase
              .from("notes")
              .insert({
                lead_id: leadId,
                user_id: user.id,
                content: `Status changed to: ${newStatusLabel}`,
                note_type: "status_change", 
              })
            
            if (noteError) console.error("Error logging status change note:", noteError)
          }
      }

      if (isCallInitiated) {
        await logCall(callDuration as number)
      }
      
      setNote("")
      setRemarks("")
      setCallDuration(null)
      setCallMins(null)
      setCallSecs(null)
      setNotEligibleReason("") // Reset radio selection
      setStatus("")
      
      toast.success("Lead status updated successfully!")

    } catch (error) {
      console.error("Error updating lead status:", error)
      toast.error("Error updating lead status", {
        description: "Please try again"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const logCall = async (finalCallDuration: number) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("You must be logged in to log calls")
        return
      }

      let duration = finalCallDuration
      if (activeCall && activeCall.leadId === leadId) {
        duration = await updateCallDuration(leadId, "")
      }

      const { data, error } = await supabase
        .from("call_logs")
        .insert({
          lead_id: leadId,
          user_id: user.id,
          call_type: "outbound",
          call_status: "connected",
          duration_seconds: duration,
          notes: remarks || "Call initiated from lead details",
        })
        .select()
        .single()

      if (error) throw error

      toast.success("Call logged successfully", {
        description: `Duration: ${formatDuration(duration)}`
      })

      if (data && onCallLogged) {
        onCallLogged(data.id)
      }

      if (activeCall && activeCall.leadId === leadId) {
        endCall(leadId)
      }
    } catch (error) {
      console.error("Error logging call:", error)
      toast.error("Error logging call", {
        description: "Error logging call"
      })
    }
  }


  const currentStatusOption = statusOptions.find((option) => option.value === currentStatus)

  // NOTE: We don't use 'showNoteField' boolean anymore, we render conditionally inline based on status
  
  const isInvalidCallDuration = isCallInitiated && status !== 'nr' && (callDuration === null || callDuration <= 0)
  
  const isFormInvalid = 
    (status === "not_eligible" && !note.trim()) || 
    (status === "follow_up" && !isCallInitiated) || 
    isInvalidCallDuration 

  const isButtonDisabled = 
    isUpdating || 
    status === "" || 
    (status === currentStatus && !isCallInitiated && status !== "follow_up") || 
    isFormInvalid || 
    status === "follow_up" 

  const whatsappLink = getWhatsappLink();
  const isWhatsappEnabled = whatsappLink !== "#";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {isCallInitiated ? "Log Call & Update Status" : "Lead Status"}
        </CardTitle>

        {isWhatsappEnabled ? (
            <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={`Send WhatsApp Message to ${cleanedPhoneNumber}`}
                className="flex items-center justify-center p-1 rounded-full bg-green-500 hover:bg-green-600 transition-colors shadow-md"
            >
                <MessageSquare className="h-4 w-4 text-white" /> 
            </a>
        ) : (
             <div 
                title="WhatsApp disabled: Phone number missing or invalid"
                onClick={() => toast.error("Error", { description: "Lead phone number is missing or invalid to send WhatsApp message." })}
                className="flex items-center justify-center p-1 rounded-full bg-gray-400 cursor-not-allowed shadow-md"
            >
                <MessageSquare className="h-4 w-4 text-white" /> 
            </div>
        )}

      </CardHeader>
      <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Current Status:</span>
          <Badge className={currentStatusOption?.color}>{currentStatusOption?.label}</Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Update Status:</label>
            <Select 
              value={status} 
              onValueChange={(newStatus) => {
                setTempStatus(newStatus)
                if (newStatus === "follow_up") {
                  setIsModalOpen(true)
                } else {
                  setStatus(newStatus)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a New Status..." /> 
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {status === "follow_up" && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-800">
                  Follow-up selected. Please schedule the time.
                </span>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => setIsModalOpen(true)}
                >
                  Schedule Now
                </Button>
              </div>
            </div>
          )}


          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Loan Amount:
            </label>
            <Input
              type="number"
              placeholder="Enter desired loan amount (loan_amount)"
              value={loanAmount !== null ? String(loanAmount) : ""}
              onChange={(e) => {
                const value = e.target.value
                setLoanAmount(value === "" ? null : Number(value))
              }}
              min="0"
            />
          </div>

          {isCallInitiated && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Call Duration: 
                {status !== 'nr' && <span className="text-red-500">* (Required &gt; 0 total seconds)</span>}
              </label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Mins"
                    value={callMins !== null ? String(callMins) : ""}
                    onChange={handleMinsChange}
                    min="0"
                    disabled={status === 'nr'}
                    className={cn(isInvalidCallDuration && "border-red-500")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minutes</p>
                </div>
                <span className="text-2xl font-bold">:</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Secs"
                    value={callSecs !== null ? String(callSecs) : ""}
                    onChange={handleSecsChange}
                    min="0"
                    max="59"
                    disabled={status === 'nr'}
                    className={cn(isInvalidCallDuration && "border-red-500")}
                  />
                  <p className="text-xs text-gray-500 mt-1">Seconds (max 59)</p>
                </div>
              </div>
              
              {callDuration !== null && callDuration > 0 && status !== 'nr' && (
                  <div className="text-sm text-gray-600 mt-1">
                      Total Duration: {callDuration} seconds
                  </div>
              )}
              
              {isInvalidCallDuration && (
                 <p className="text-sm text-red-500">Call Duration must be greater than 0 for the selected status.</p>
              )}
              {status === 'nr' && (
                 <p className="text-sm text-gray-500">Duration is auto-set to 0 for NR.</p>
              )}
              {activeCall && activeCall.leadId === leadId && (
                <div className="text-sm text-green-600">
                  Current call timer: {formatDuration(activeCall.timer)}
                </div>
              )}
            </div>
          )}


          <div className="space-y-2">
            <label className="text-sm font-medium">Remarks/Notes:</label>
            <Textarea
              placeholder="Add any remarks or notes about this status update..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>

          {/* NEW: Updated UI for 'Not Eligible' selection */}
          {status === "not_eligible" && (
            <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-md">
              <label className="text-sm font-medium text-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Reason for Ineligibility: <span className="text-red-600">*</span>
              </label>
              
              <div className="flex flex-col gap-2 mt-2">
                {/* Option 1: Salary in CASH */}
                <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-red-100/50 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="notEligibleReason" 
                    value="Salary in CASH"
                    checked={notEligibleReason === "Salary in CASH"}
                    onChange={() => handleNotEligibleReasonChange("Salary in CASH")}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Salary in CASH</span>
                </label>

                {/* Option 2: Low CIBIL Score */}
                <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-red-100/50 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="notEligibleReason" 
                    value="Low CIBIL Score"
                    checked={notEligibleReason === "Low CIBIL Score"}
                    onChange={() => handleNotEligibleReasonChange("Low CIBIL Score")}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Low CIBIL Score</span>
                </label>

                {/* Option 3: Other */}
                <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-red-100/50 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="notEligibleReason" 
                    value="Other"
                    checked={notEligibleReason === "Other"}
                    onChange={() => handleNotEligibleReasonChange("Other")}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Other</span>
                </label>
              </div>

              {/* Conditional Input for 'Other' */}
              {notEligibleReason === "Other" && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                   <Textarea
                    placeholder="Please specify the reason..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className={cn("bg-white", isFormInvalid && "border-red-500")} 
                  />
                </div>
              )}

               {isFormInvalid && (
                  <p className="text-xs text-red-500 mt-1 font-medium">Please select a reason or specify details.</p>
                )}
            </div>
          )}

          <Button 
            onClick={handleStatusUpdate} 
            disabled={isButtonDisabled} 
            className="w-full"
          >
            {isUpdating ? "Updating..." : isCallInitiated ? "Log Call & Update Status" : "Update Status"}
          </Button>
          {(status === "follow_up" && !isCallInitiated) && (
             <p className="text-sm text-gray-500 text-center">
                The "Call Back" status is updated after scheduling a follow-up.
            </p>
          )}
        </div>
      </CardContent>
      <ScheduleFollowUpModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) {
            setStatus("") 
          }
        }}
        onScheduleSuccess={() => {
          updateLeadStatusToFollowUp() 
        }}
        defaultLeadId={leadId}
      />
    </Card>
  )
}
