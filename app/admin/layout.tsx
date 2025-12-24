import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AdminSidebar } from "@/components/admin-sidebar"
import { TopHeader } from "@/components/top-header"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { Watermark } from "@/components/watermark" // <--- 1. IMPORT THIS

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="admin">
      <PushSubscriber />
      <Watermark /> {/* <--- 2. ADD COMPONENT HERE */}
      <CallTrackingProvider>
        <div className="flex h-screen bg-gray-50">
          <AdminSidebar />
          <div className="flex-1 flex flex-col">
            <TopHeader title="Admin Dashboard" />
            {/* The watermark is fixed, so it will float above everything here */}
            <main className="flex-1 overflow-y-auto relative">{children}</main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
