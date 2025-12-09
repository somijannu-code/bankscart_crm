import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
// Import the ticker
import { TelecallerTicker } from "@/components/telecaller-ticker"

export default function TelecallerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="telecaller">
      <PushSubscriber />
      <CallTrackingProvider>
        <div className="flex h-screen bg-gray-50">
          <TelecallerSidebar />
          <div className="flex-1 flex flex-col overflow-hidden"> {/* Added overflow-hidden to fix scroll issues */}
            
            {/* ADD TICKER HERE: Sticky at the top */}
            <div className="flex-none z-10 shadow-md">
               <TelecallerTicker />
            </div>

            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
