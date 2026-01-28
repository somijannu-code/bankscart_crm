"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MessageCircle, Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface QuickActionsProps {
  phone: string
  email?: string | null
  leadId: string
  onCallInitiated: (leadId: string) => void
  className?: string
}

export function QuickActions({ phone, email, leadId, onCallInitiated, className }: QuickActionsProps) {
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)

  // --- HANDLERS ---

  const handleCallClick = () => {
    // 1. Open the "Log Call" modal immediately
    onCallInitiated(leadId)
    
    // 2. Trigger native dialer after UI updates
    setTimeout(() => {
      window.location.href = `tel:${phone}`
    }, 100)
  }

  const handleWhatsAppClick = () => {
    // Strip non-numeric chars for the API (e.g. +91-999 -> 91999)
    const cleanPhone = phone.replace(/\D/g, '')
    const url = `https://wa.me/${cleanPhone}`
    window.open(url, '_blank')
  }

  const handleEmailClick = () => {
    if (!email) return
    window.location.href = `mailto:${email}`
  }

  const copyToClipboard = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
    
    if (type === 'phone') {
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    } else {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    }
  }

  // --- RENDER ---

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      
      {/* 1. PHONE ROW */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-start border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors"
          onClick={handleCallClick}
        >
          <Phone className="h-4 w-4 mr-2" />
          <span className="truncate">Call</span>
        </Button>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="border-slate-200 text-slate-500 hover:text-slate-700"
                onClick={() => copyToClipboard(phone, 'phone')}
              >
                {copiedPhone ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Number</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 2. WHATSAPP ROW */}
      <Button
        variant="outline"
        className="w-full justify-start border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 transition-colors"
        onClick={handleWhatsAppClick}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        WhatsApp
      </Button>

      {/* 3. EMAIL ROW */}
      {email && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-start border-slate-200 hover:bg-slate-50 text-slate-700"
            onClick={handleEmailClick}
          >
            <Mail className="h-4 w-4 mr-2" />
            <span className="truncate">Email</span>
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-200 text-slate-500 hover:text-slate-700"
                  onClick={() => copyToClipboard(email, 'email')}
                >
                  {copiedEmail ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy Email</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}
