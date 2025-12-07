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
      if ('serviceWorker' in navigator && 'PushManager' in window && PUBLIC_KEY) {
        try {
          // 1. Register SW
          const registration = await navigator.serviceWorker.register('/sw.js')
          
          // 2. Ask for Permission
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return

          // 3. Subscribe to Push Service
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
          })

          // 4. Save Subscription to Database
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
             await supabase.from('push_subscriptions').upsert({
               user_id: user.id,
               // Serialize the subscription object safely
               endpoint: subscription.endpoint,
               p256dh_key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!))),
               auth_key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!)))
             }, { onConflict: 'endpoint' })
          }

        } catch (error) {
          console.error('Push registration failed:', error)
        }
      }
    }

    registerServiceWorker()
  }, [])

  return null // This component is invisible
}
