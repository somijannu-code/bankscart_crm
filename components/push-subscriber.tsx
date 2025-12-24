"use client"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushSubscriber() {
  const supabase = createClient()

  useEffect(() => {
    async function registerServiceWorker() {
      // 1. Check if Env Var exists
      if (!PUBLIC_KEY) {
        console.error("VAPID Public Key is missing in Environment Variables!");
        return;
      }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          // 2. Register SW
          const registration = await navigator.serviceWorker.register('/sw.js')
          
          // 3. Ask Permission
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return

          // 4. Subscribe
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
          })

          // 5. Serialize safely using .toJSON()
          // This avoids the complex binary conversion errors causing the 400 Bad Request
          const subJson = subscription.toJSON()

          if (!subJson.keys?.p256dh || !subJson.keys?.auth) {
            console.error("Failed to generate subscription keys")
            return
          }

          // 6. Save to Database
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
             const { error } = await supabase.from('push_subscriptions').upsert({
               user_id: user.id,
               endpoint: subJson.endpoint,
               p256dh_key: subJson.keys.p256dh,
               auth_key: subJson.keys.auth
             }, { onConflict: 'endpoint' })

             if (error) {
               console.error("Supabase Save Error:", error)
             } else {
               console.log("✅ Device Subscribed Successfully!")
             }
          }

        } catch (error) {
          console.error('Push registration failed:', error)
        }
      }
    }

    registerServiceWorker()
  }, [])

  return null
}
