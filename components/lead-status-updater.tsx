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
import { Phone, Clock, MessageSquare, IndianRupee } from "lucide-react" 
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
  { value: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-800" },
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

  const supabase = createClient()
  const { activeCall, startCall, endCall, updateCallDuration, formatDuration } = useCallTracking()

  // CONSTANT FOR WHATSAPP MESSAGE
  const WHATSAPP_MESSAGE_BASE = "hi sir this side {telecaller_name} from ICICI bank kindly share following documents";

  // New constant for a robustly cleaned phone number
  const cleanedPhoneNumber = String(leadPhoneNumber || "").replace(/[^0-9]/g, '');

  // MODIFIED FUNCTION: Simplified logic, now only returns the link or "#"
  const getWhatsappLink = () => {
      // Return a safe link if the number is empty after cleaning
      if (!cleanedPhoneNumber) {
          return "#"; 
      }
      
      // Replace placeholder and URL encode the message
      const message = WHATSAPP_MESSAGE_BASE.replace("{telecaller_name}", telecallerName)
      const encodedMessage = encodeURIComponent(message)
      
      return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`
  }


  useEffect(() => {
    setLoanAmount(initialLoanAmount)
  }, [initialLoanAmount])
  
  // NEW useEffect: Set call duration to 0 automatically when 'nr' is selected and a call was initiated
  useEffect(() => {
    if (isCallInitiated && status === 'nr') {
      setCallDuration(0);
      setCallMins(0); // Also update minutes/seconds UI state
      setCallSecs(0);
    } else if (status !== 'nr' && callDuration === 0) {
      // Clear call duration if switching from 'nr' to another status
      setCallDuration(null);
      setCallMins(null); // Clear minutes/seconds UI state
      setCallSecs(null);
    }
  }, [status, isCallInitiated]);

  // NEW HELPER FUNCTION: Calculates total seconds from minutes and seconds
  const calculateTotalSeconds = (minutes: number | null, seconds: number | null): number | null => {
    const min = minutes ?? 0;
    const sec = seconds ?? 0;
    // Only return a number if at least one is explicitly set and non-negative
    if (min < 0 || sec < 0) return null;
    if (min === 0 && sec === 0 && (minutes === null && seconds === null)) return null;
    return (min * 60) + sec;
  }

  // NEW HANDLER: Updates minutes and recalculates total seconds
  const handleMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minutes = value === "" ? null : Number(value);
    
    setCallMins(minutes);

    // Recalculate and set the total duration in seconds
    const totalSeconds = calculateTotalSeconds(minutes, callSecs);
    setCallDuration(totalSeconds);
  }

  // NEW HANDLER: Updates seconds and recalculates total seconds
  const handleSecsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let seconds = value === "" ? null : Number(value);

    // Limit seconds to 59
    if (seconds !== null && seconds > 59) {
      seconds = 59;
    }
    
    setCallSecs(seconds);

    // Recalculate and set the total duration in seconds
    const totalSeconds = calculateTotalSeconds(callMins, seconds);
    setCallDuration(totalSeconds);
  }


  // NEW FUNCTION: Updates only the status to 'follow_up' after modal success
  const updateLeadStatusToFollowUp = async () => {
    try {
      const updateData: any = { 
        status: "follow_up",
        last_contacted: new Date().toISOString()
      }

      // Add loan_amount if provided and valid
      if (loanAmount !== null && !isNaN(loanAmount) && loanAmount >= 0) {
        updateData.loan_amount = loanAmount
      }

      // Add general remarks/notes if provided
      if (remarks.trim()) {
        // We append the new remarks to the existing notes, if applicable
        updateData.notes = remarks
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId)
        
      if (error) throw error
      
      // Update local state and notify parent
      setStatus("follow_up")
      onStatusUpdate?.("follow_up", note) 
      
      // OPTIONAL: Reset remarks/notes after successful update
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

    // CHECK 1 (Mandatory Status): Check if status is selected at all
    if (!status) {
       toast.error("Validation Failed", {
        description: "Please select a status before submitting."
      })
      return
    }

    // CHECK 2 (Not Eligible Reason):
    if (isNotEligible && isNoteEmpty) {
      toast.error("Validation Failed", {
        description: "Please specify the 'Reason for Not Eligible' before updating the status."
      })
      return 
    }
    
    // CHECK 3 (Follow Up):
    if (status === "follow_up") {
      // Re-open the modal if the user tries to click the button without going through the modal
      if (!isModalOpen) {
        setIsModalOpen(true);
      }
      toast.error("Action required", {
        description: "Please use the 'Schedule Follow-up' modal to set the callback date and time."
      })
      return
    }

    // NEW CHECK 4 (Call Duration): Mandatory call duration > 0 for all statuses except 'nr' when call is initiated
    if (isCallInitiated && !isNRStatus) {
      if (callDuration === null || callDuration <= 0) {
        toast.error("Validation Failed", {
          description: "Call Duration is mandatory and must be greater than 0 for this status."
        })
        return
      }
    }
    
    // Auto-set call duration to 0 for 'nr' if it's not set
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
      
      // Add loan_amount to update data if it's a valid number
      if (loanAmount !== null && !isNaN(loanAmount) && loanAmount >= 0) {
        updateData.loan_amount = loanAmount
      }

      // Add general remarks/notes if provided
      if (remarks.trim()) {
        updateData.notes = remarks
      }
      
      // Add specific note if provided for Not Eligible status
      if (isNotEligible && note.trim()) {
        updateData.notes = updateData.notes ? `${updateData.notes}\n\nReason for Not Eligible: ${note}` : `Reason for Not Eligible: ${note}`
      }

      // Only update if status is NOT the current status OR if a call was initiated
      // We skip the update if status is 'nr' but we only want to log the call.
      if (status !== currentStatus || isCallInitiated) {
          const { error } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", leadId)

          if (error) throw error
          
          onStatusUpdate?.(status, note) 
      }


      // If this is for a call, also log the call
      // The callDuration will be a valid number here due to the checks above.
      if (isCallInitiated) {
        // We use the state value, which is guaranteed to be a number (0 or > 0)
        await logCall(callDuration as number)
      }

      
      // Reset form
      setNote("")
      setRemarks("")
      // MODIFIED: Reset callDuration to null AND new minute/second state
      setCallDuration(null)
      setCallMins(null)
      setCallSecs(null)

      // Set status back to empty string after success for subsequent mandatory selection.
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

  // MODIFIED: logCall now accepts callDuration as a parameter, making it explicit
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
        // If an active call is still running, update the final duration from the tracking context
        // This handles cases where the user has entered a duration but the active timer is higher
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
          // MODIFIED: Use remarks as notes, falling back to a default message
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

  const showNoteField = status === "not_eligible"
  
  // Logic for call duration validation (must be > 0 for non-'nr' statuses)
  // Use callDuration for the validation check
  const isInvalidCallDuration = isCallInitiated && status !== 'nr' && (callDuration === null || callDuration <= 0)
  
  // Logic to determine if the update button should be disabled
  const isFormInvalid = 
    (status === "not_eligible" && !note.trim()) || // Not Eligible reason missing
    (status === "follow_up" && !isCallInitiated) || // Follow up logic via modal
    isInvalidCallDuration // NEW: Invalid call duration for non-'nr' call

  const isButtonDisabled = 
    isUpdating || 
    status === "" || // MANDATORY SELECTION: Disabled if no status is selected
    (status === currentStatus && !isCallInitiated && status !== "follow_up") || // Still disable if status hasn't changed AND no call was initiated (standard update logic)
    isFormInvalid || 
    status === "follow_up" // Disabled if 'follow_up' is selected (update happens via modal success)

  // Check if a valid WhatsApp link can be generated
  const whatsappLink = getWhatsappLink();
  const isWhatsappEnabled = whatsappLink !== "#";

  return (
    <Card>
      {/* MODIFIED: Added flex and justify-between for the WhatsApp icon */}
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {isCallInitiated ? "Log Call & Update Status" : "Lead Status"}
        </CardTitle>

        {/* NEW: WHATSAPP ICON - Conditionally rendered and disabled */}
        {isWhatsappEnabled ? (
            <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={`Send WhatsApp Message to ${cleanedPhoneNumber}`}
                className="flex items-center justify-center p-1 rounded-full bg-green-500 hover:bg-green-600 transition-colors shadow-md"
            >
                {/* Using MessageSquare icon and styling it white on a green background */}
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
          {/* Use currentStatusOption for the BADGE display */}
          <Badge className={currentStatusOption?.color}>{currentStatusOption?.label}</Badge>
        </div>

        {/* REMOVED: The informational text box that was here */}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Update Status:</label>
            <Select 
              value={status} 
              onValueChange={(newStatus) => {
                setTempStatus(newStatus) // Store the status temporarily
                if (newStatus === "follow_up") {
                  setIsModalOpen(true) // Open the modal
                } else {
                  setStatus(newStatus) // Update status immediately for others
                }
              }}
            >
              <SelectTrigger>
                {/* Placeholder is shown when value is "" */}
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
          
          {/* Display a reminder/button if 'follow_up' is selected */}
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


          {/* New field for Loan Amount */}
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

          {/* MODIFIED: Call Duration input for Minutes and Seconds */}
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
              
              {/* Display total duration in seconds */}
              {callDuration !== null && callDuration > 0 && status !== 'nr' && (
                  <div className="text-sm text-gray-600 mt-1">
                      Total Duration: {callDuration} seconds
                  </div>
              )}
              
              {/* Validation/Timer display */}
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
          {/* END MODIFIED CALL DURATION INPUT */}


          {/* General remarks/notes field - always visible */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Remarks/Notes:</label>
            <Textarea
              placeholder="Add any remarks or notes about this status update..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>

          {/* Note field for Not Eligible status */}
          {showNoteField && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for Not Eligible: <span className="text-red-500">* (Required)</span>
              </label>
              <Textarea
                placeholder="Please specify the reason why this lead is not eligible..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                // Apply a subtle error border if validation fails
                className={cn(isFormInvalid && "border-red-500")} 
              />
               {isFormInvalid && (
                  <p className="text-sm text-red-500">This field is mandatory for 'Not Eligible' status.</p>
                )}
            </div>
          )}

          <Button 
            onClick={handleStatusUpdate} 
            disabled={isButtonDisabled} // Used comprehensive disabled check
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
      {/* NEW: ScheduleFollowUpModal Integration */}
      <ScheduleFollowUpModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          // If modal is closed, status reverts to "" (unselected)
          if (!open) {
            setStatus("") 
          }
        }}
        onScheduleSuccess={() => {
          // If scheduling is successful, update the lead status in the leads table
          updateLeadStatusToFollowUp() 
        }}
        defaultLeadId={leadId}
      />
    </Card>
  )
}
