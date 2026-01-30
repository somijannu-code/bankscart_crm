"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LeadStatusUpdater } from "@/components/lead-status-updater"

interface LeadStatusDialogProps {
  leadId: string
  currentStatus: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: (newStatus: string, note?: string, callbackDate?: string) => void
  isCallInitiated?: boolean
  onCallLogged?: (callLogId: string) => void
  // Props for Automation
  leadPhoneNumber?: string | null
  telecallerName?: string | null
  onNextLead?: () => void
}

export function LeadStatusDialog({
  leadId,
  currentStatus,
  open,
  onOpenChange,
  onStatusUpdate,
  isCallInitiated = false,
  onCallLogged,
  leadPhoneNumber,
  telecallerName,
  onNextLead
}: LeadStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="sr-only">
          <DialogTitle>Update Lead Status</DialogTitle>
        </DialogHeader>
        
        <LeadStatusUpdater 
            leadId={leadId}
            currentStatus={currentStatus}
            onStatusUpdate={onStatusUpdate}
            isCallInitiated={isCallInitiated}
            onCallLogged={onCallLogged}
            leadPhoneNumber={leadPhoneNumber}
            telecallerName={telecallerName}
            onNextLead={onNextLead}
        />
      </DialogContent>
    </Dialog>
  )
}
