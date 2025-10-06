import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"

export default function TelecallerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="telecaller">
      <CallTrackingProvider>
        <div className="flex h-screen bg-gray-50">
          <TelecallerSidebar />
          <div className="flex-1 flex flex-col">
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
