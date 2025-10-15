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
}: LeadStatusUpdaterProps) {
  // MODIFIED: Status always starts as "" to force selection, even when isCallInitiated.
  const [status, setStatus] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [note, setNote] = useState("") 
  const [remarks, setRemarks] = useState("")
  const [callNotes, setCallNotes] = useState("")
  const [callDuration, setCallDuration] = useState(0)
  const [loanAmount, setLoanAmount] = useState<number | null>(initialLoanAmount)
  const [isModalOpen, setIsModalOpen] = useState(false) 
  // Keep tempStatus initialized to currentStatus for the modal logic when it opens
  const [tempStatus, setTempStatus] = useState(currentStatus) 

  const supabase = createClient()
  const { activeCall, startCall, endCall, updateCallDuration, formatDuration } = useCallTracking()

  // REMOVED: The useEffect hook that automatically set status to 'contacted' on call initiation.
  // The state is now initialized to "".

  useEffect(() => {
    setLoanAmount(initialLoanAmount)
  }, [initialLoanAmount])

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
    
    // --- START VALIDATION CHECK (Mandatory Reason for Not Eligible & Mandatory Status Selection) ---
    const isNotEligible = status === "not_eligible"
    const isNoteEmpty = !note.trim()

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
      if (status !== currentStatus || isCallInitiated) {
          const { error } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", leadId)

          if (error) throw error
          
          onStatusUpdate?.(status, note) 
      }


      // If this is for a call, also log the call
      if (isCallInitiated) {
        await logCall()
      }

      
      // Reset form
      setNote("")
      setRemarks("")
      setCallNotes("")
      setCallDuration(0)

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

  const logCall = async () => {
    // ... (logCall remains unchanged)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("You must be logged in to log calls")
        return
      }

      let duration = callDuration
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
          notes: callNotes || remarks || "Call initiated from lead details",
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
  
  // Logic to determine if the update button should be disabled
  // isFormInvalid now ONLY checks for Not Eligible reason and Follow Up rule
  const isFormInvalid = (status === "not_eligible" && !note.trim()) || (status === "follow_up" && !isCallInitiated)

  const isButtonDisabled = 
    isUpdating || 
    status === "" || // MANDATORY SELECTION: Disabled if no status is selected
    (status === currentStatus && !isCallInitiated && status !== "follow_up") || // Still disable if status hasn't changed AND no call was initiated (standard update logic)
    isFormInvalid || 
    status === "follow_up" // Disabled if 'follow_up' is selected (update happens via modal success)


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isCallInitiated ? "Log Call & Update Status" : "Lead Status"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Current Status:</span>
          {/* Use currentStatusOption for the BADGE display */}
          <Badge className={currentStatusOption?.color}>{currentStatusOption?.label}</Badge>
        </div>

        {isCallInitiated && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">Active Call Logging</span>
            </div>
            {/* MODIFIED: Updated message to reflect mandatory selection */}
            <p className="text-sm text-blue-700">
              **Mandatory**: Please select a status below. Call details will be logged upon submission.
            </p>
          </div>
        )}

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

          {isCallInitiated && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Call Notes:
              </label>
              <Textarea
                placeholder="Add notes about this call..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {isCallInitiated && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Call Duration (seconds):
              </label>
              <Input
                type="number"
                placeholder="Enter call duration in seconds"
                value={callDuration}
                onChange={(e) => setCallDuration(Number(e.target.value))}
                min="0"
              />
              {activeCall && activeCall.leadId === leadId && (
                <div className="text-sm text-green-600">
                  Current call timer: {formatDuration(activeCall.timer)}
                </div>
              )}
            </div>
          )}

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
