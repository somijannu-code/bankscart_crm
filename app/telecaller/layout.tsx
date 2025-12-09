import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
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
          
          {/* Added 'relative' here to act as the anchor for the absolute ticker */}
          <div className="flex-1 flex flex-col overflow-hidden relative"> 
            
            {/* TICKER CONTAINER UPDATES:
              1. absolute top-2: Floats it at the top.
              2. w-full flex justify-center: Centers it horizontally (Middle).
              3. bg-transparent: Removes background color.
              4. z-50: Ensures it sits on top of everything.
              5. pointer-events-none: Ensures the empty transparent areas don't block clicking on the page below.
            */}
            <div className="absolute top-10 w-full flex justify-center z-50 bg-transparent pointer-events-none">
               {/* Inner wrapper sets the width and re-enables clicks. 
                 You can adjust max-w-4xl to make it wider or narrower.
               */}
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
