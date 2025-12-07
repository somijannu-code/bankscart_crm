"use client"

import { useEffect, useState, useRef } from "react"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
// Button import removed as we are styling the trigger directly
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

// Define the styles that mimic Button variant="ghost" size="icon"
const triggerIconBtnClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 relative"

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  
  // Use a Ref to track the channel to prevent duplicate subscriptions
  const channelRef = useRef<RealtimeChannel | null>(null)

  // 1. Request System Notification Permission on Mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission()
      }
    }
  }, [])

  useEffect(() => {
    const setupNotifications = async () => {
      // 2. Get Current User
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 3. Fetch Initial (Missed) Notifications from Database
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

      // 4. Prevent Duplicate Subscriptions
      if (channelRef.current) return

      // 5. Setup Real-time Listener with UNIQUE Channel Name
      const channel = supabase
        .channel(`realtime:notifications:${user.id}`) // Unique channel per user
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`, // Filter ensures we only get OUR alerts
          },
          (payload) => {
            console.log("🔔 New Notification Received:", payload)
            
            const newNotif = payload.new as any
            
            // A. Update UI State instantly
            setNotifications((prev) => [newNotif, ...prev])
            setUnreadCount((prev) => prev + 1)

            // B. Show In-App Toast (Sonner)
            toast.info(newNotif.title, {
              description: newNotif.message,
              duration: 5000,
            })
            
            // C. Trigger System Notification (Device History)
            // This puts the message in the Windows/Android Notification Center
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
               try {
                 const sysNotif = new Notification(newNotif.title, {
                   body: newNotif.message,
                   icon: '/icons/icon-192x192.jpg', // Ensure this path exists in your public folder
                   tag: 'crm-alert', // Prevents stacking if multiple fire at once
                   timestamp: new Date(newNotif.created_at).getTime()
                 });
                 
                 // Focus window when clicked
                 sysNotif.onclick = () => {
                   window.focus();
                   sysNotif.close();
                 };
               } catch (err) {
                 console.error("System notification failed:", err);
               }
            }
          }
        )
        .subscribe((status) => {
           console.log(`🔌 Realtime Connection Status: ${status}`)
        })

      channelRef.current = channel
    }

    setupNotifications()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  const markAsRead = async (id: string) => {
    // Optimistic Update
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((prev) => Math.max(0, prev - 1))

    // DB Update
    await supabase.from("notifications").update({ read: true }).eq("id", id)
  }

  return (
    <DropdownMenu>
      {/* FIX: Removed asChild and Button component. 
         Used native DropdownMenuTrigger with custom classes to mimic the Ghost Icon Button.
      */}
      <DropdownMenuTrigger className={triggerIconBtnClass}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 bg-red-500 text-white text-[10px]">
            {unreadCount}
          </Badge>
        )}
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
