"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
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
import { toast } from "sonner" // Assuming you use Sonner for toasts

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    let channel: any;

    const setupNotifications = async () => {
      // 1. Get Current User
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 2. Fetch Initial (Missed) Notifications
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.length)
      }

      // 3. Setup Real-time Listener
      channel = supabase
        .channel('realtime-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`, // Listen only for MY notifications
          },
          (payload) => {
            console.log("🔔 Realtime Notification Received:", payload)
            
            const newNotif = payload.new
            
            // Update State immediately
            setNotifications((prev) => [newNotif, ...prev])
            setUnreadCount((prev) => prev + 1)

            // Show a Toast Popup (optional but recommended)
            toast.info(newNotif.title, {
              description: newNotif.message,
              duration: 5000,
            })
            
            // Play a sound (optional)
            // new Audio('/notification.mp3').play().catch(() => {}) 
          }
        )
        .subscribe((status) => {
          console.log("🔌 Realtime Status:", status)
        })
    }

    setupNotifications()

    // Cleanup on unmount
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const markAsRead = async (id: string) => {
    // Optimistic Update (Update UI immediately)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((prev) => Math.max(0, prev - 1))

    // Send update to Backend
    await supabase.from("notifications").update({ read: true }).eq("id", id)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 bg-red-500 text-white text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className="flex flex-col items-start gap-1 p-3 cursor-pointer border-b last:border-0 hover:bg-gray-50"
                onClick={() => markAsRead(notif.id)}
              >
                <div className="flex justify-between w-full">
                   <span className="font-semibold text-sm text-blue-600">{notif.title}</span>
                   <span className="text-[10px] text-gray-400">
                     {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                </div>
                <span className="text-xs text-gray-600 line-clamp-2">{notif.message}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
