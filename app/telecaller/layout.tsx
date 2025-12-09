import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { TelecallerTicker } from "@/components/telecaller-ticker"
// IMPORT THE NEW MODAL
import { DailyWelcomeModal } from "@/components/telecaller/daily-welcome-modal"

export default function TelecallerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="telecaller">
      <PushSubscriber />
      <CallTrackingProvider>
        
        {/* ADD THE MODAL HERE - It handles its own visibility state */}
        <DailyWelcomeModal />
        
        <div className="flex h-screen bg-gray-50">
          <TelecallerSidebar />
          
          <div className="flex-1 flex flex-col overflow-hidden relative"> 
            
            <div className="absolute top-20 w-full flex justify-center z-50 bg-transparent pointer-events-none">
               <div className="w-full max-w-4xl pointer-events-auto opacity-90 hover:opacity-100 transition-opacity">
                  <TelecallerTicker />
               </div>
            </div>

            <main className="flex-1 overflow-y-auto pt-4">
              {children}
            </main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
