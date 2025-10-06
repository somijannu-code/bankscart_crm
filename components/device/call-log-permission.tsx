"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Shield, CheckCircle } from "lucide-react"
import { CallTrackingProvider, useCallTracking } from "@/components/ui/call-tracking"

// Main component that uses the hook
function CallLogPermissionContent({ onPermissionGranted, onPermissionDenied }: { 
  onPermissionGranted?: () => void 
  onPermissionDenied?: () => void 
}) {
  const [permissionState, setPermissionState] = useState<"granted" | "denied" | "prompt">("prompt")
  const [isLoading, setIsLoading] = useState(false)
  const { isSupported } = useCallTracking()

  const requestPermission = async () => {
    setIsLoading(true)
    try {
      // Simulate permission request
      await new Promise(resolve => setTimeout(resolve, 1000))
      setPermissionState("granted")
      onPermissionGranted?.()
    } catch (error) {
      setPermissionState("denied")
      onPermissionDenied?.()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Log Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Automatic call logging not supported.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Log Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Status</span>
          </div>
          <Badge variant={permissionState === "granted" ? "default" : "secondary"}>
            {permissionState === "granted" ? "Granted" : "Not Granted"}
          </Badge>
        </div>

        {permissionState !== "granted" && (
          <Button 
            onClick={requestPermission} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Checking..." : "Enable Access"}
          </Button>
        )}

        {permissionState === "granted" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Access granted</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Export the wrapped component
export function CallLogPermission(props: { 
  onPermissionGranted?: () => void 
  onPermissionDenied?: () => void 
}) {
  return (
    <CallTrackingProvider>
      <CallLogPermissionContent {...props} />
    </CallTrackingProvider>
  )
}
