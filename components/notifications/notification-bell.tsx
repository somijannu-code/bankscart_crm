"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, X } from "lucide-react" // Added X icon
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { RealtimeChannel } from "@supabase/supabase-js"

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false) // Track open state manually
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const setupNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch Initial Notifications
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.length)
      }

      if (channelRef.current) return

      // Realtime Listener
      const channel = supabase
        .channel(`realtime:notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as any
            setNotifications((prev) => [newNotif, ...prev])
            setUnreadCount((prev) => prev + 1)
            toast.info(newNotif.title, { description: newNotif.message })
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupNotifications()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent menu from closing immediately
    
    // Optimistic Update
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((prev) => Math.max(0, prev - 1))

    // DB Update
    await supabase.from("notifications").update({ read: true }).eq("id", id)
  }

  const clearAll = async () => {
    setNotifications([])
    setUnreadCount(0)
    const { data: { user } } = await supabase.auth.getUser()
    if(user) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      {/* FIX 1: Removed 'asChild'. We wrap the button directly.
         FIX 2: Added 'pointer-events-none' to Badge so clicks pass through to the button.
      */}
      <DropdownMenuTrigger className="outline-none">
        <div className="relative inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200">
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 bg-red-500 text-white text-[10px] pointer-events-none shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </div>
      </DropdownMenuTrigger>

      {/* FIX 3: Added z-index [100], background white, and shadow to ensure visibility 
      */}
      <DropdownMenuContent 
        align="end" 
        className="w-80 md:w-96 z-[100] bg-white shadow-xl border border-gray-200"
      >
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
              onClick={clearAll}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <Bell className="h-8 w-8 text-gray-300" />
            <p>No new notifications</p>
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className="flex flex-col items-start gap-1 p-3 cursor-pointer border-b last:border-0 hover:bg-blue-50 transition-colors group relative"
                onSelect={(e) => e.preventDefault()} // Prevent auto-closing on click
              >
                <div className="flex justify-between w-full">
                   <span className="font-semibold text-sm text-gray-900">{notif.title}</span>
                   <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                     {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                </div>
                <span className="text-xs text-gray-600 line-clamp-2 pr-6">{notif.message}</span>
                
                {/* Close Button (Appears on Hover) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-8 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => markAsRead(notif.id, e)}
                >
                  <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                </Button>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
