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
// REMOVED: Calendar, Popover, PopoverContent, PopoverTrigger
// REMOVED: CalendarIcon, X 
import { Phone, Clock, MessageSquare, IndianRupee } from "lucide-react" 
// REMOVED: format, cn
import { useCallTracking } from "@/context/call-tracking-context"
import { toast } from "sonner"
// NEW IMPORT for the modal
import { ScheduleFollowUpModal } from "./schedule-follow-up-modal" 
// Re-import format and cn (kept in case they are used elsewhere, e.g., useCallTracking)
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
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [note, setNote] = useState("") // This holds the 'Reason for Not Eligible'
  const [remarks, setRemarks] = useState("")
  // REMOVED: const [callbackDate, setCallbackDate] = useState<Date>()
  const [callNotes, setCallNotes] = useState("")
  const [callDuration, setCallDuration] = useState(0)
  const [loanAmount, setLoanAmount] = useState<number | null>(initialLoanAmount)
  // NEW STATE for modal control
  const [isModalOpen, setIsModalOpen] = useState(false) 
  const [tempStatus, setTempStatus] = useState(currentStatus) // State to hold status before modal confirmation

  const supabase = createClient()
  const { activeCall, startCall, endCall, updateCallDuration, formatDuration } = useCallTracking()

  useEffect(() => {
    if (isCallInitiated) {
      setStatus("contacted")
    }
  }, [isCallInitiated])

  useEffect(() => {
    setLoanAmount(initialLoanAmount)
  }, [initialLoanAmount])

  // NEW FUNCTION: Updates only the status to 'follow_up' after modal success
  const updateLeadStatusToFollowUp = async () => {
    try {
      const updateData: any = { 
        status: "follow_up", // <-- Sets the database status to "follow_up"
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
      setStatus("follow_up") // <-- Correctly sets the local state to "follow_up"
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
    
    // --- START VALIDATION CHECK (Mandatory Reason for Not Eligible) ---
    const isNotEligible = status === "not_eligible"
    const isNoteEmpty = !note.trim()

    if (isNotEligible && isNoteEmpty) {
      toast.error("Validation Failed", {
        description: "Please specify the 'Reason for Not Eligible' before updating the status."
      })
      return 
    }
    // If 'follow_up' is selected, the update is handled by the modal's success callback,
    // so we should only continue here if it's NOT 'follow_up'.
    if (status === "follow_up") {
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

      // REMOVED: Logic for follow_up/callbackDate was here

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId)

      if (error) throw error

      // If this is for a call, also log the call
      if (isCallInitiated) {
        await logCall()
      }

      // We no longer pass callbackDate here
      onStatusUpdate?.(status, note) 
      
      // Reset form
      setNote("")
      setRemarks("")
      // REMOVED: setCallbackDate(undefined)
      setCallNotes("")
      setCallDuration(0)
      
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
        description: "Please try again"
      })
    }
  }


  const currentStatusOption = statusOptions.find((option) => option.value === status)

  const showNoteField = status === "not_eligible"
  // REMOVED: const showCallbackField = status === "follow_up"
  
  // Logic to determine if the update button should be disabled
  // Also disable if 'follow_up' is selected, as the status is updated by the modal success.
  const isFormInvalid = (status === "not_eligible" && !note.trim()) || (status === "follow_up" && !isCallInitiated)


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
          <Badge className={currentStatusOption?.color}>{currentStatusOption?.label}</Badge>
        </div>

        {isCallInitiated && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">a</span>
            </div>
            <p className="text-sm text-blue-700">
              T.
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
                <SelectValue />
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

          {/* REMOVED: Callback date field for Call Back status */}
          

          <Button 
            onClick={handleStatusUpdate} 
            disabled={isUpdating || (status === currentStatus && !isCallInitiated && status !== "follow_up") || isFormInvalid || status === "follow_up"}
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
          // If modal is closed (e.g., via Cancel or Esc) AND the original intention was follow_up,
          // revert the status back if it hasn't been successfully set to 'follow_up'.
          if (!open && tempStatus === "follow_up" && status !== "follow_up") {
            setStatus(currentStatus) 
          }
        }}
        onScheduleSuccess={() => {
          // If scheduling is successful, update the lead status in the leads table
          updateLeadStatusToFollowUp() // <-- This sets the status to "follow_up"
        }}
        defaultLeadId={leadId}
      />
    </Card>
  )
}
