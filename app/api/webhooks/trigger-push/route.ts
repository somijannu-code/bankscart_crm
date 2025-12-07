import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // 1. Receive the Webhook payload from Supabase
    const payload = await request.json()
    const record = payload.record // The new notification row

    if (!record || !record.user_id) return NextResponse.json({ message: 'No record' })

    // 2. Get the User's Push Subscription
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)

    if (!subs || subs.length === 0) return NextResponse.json({ message: 'No subscriptions' })

    // 3. Send Push to all user's devices
    const notifications = subs.map(sub => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          auth: atob(sub.auth_key), // Decode back to original format
          p256dh: atob(sub.p256dh_key)
        }
      }

      const message = JSON.stringify({
        title: record.title,
        body: record.message,
        url: '/admin/leads' // Or dynamic URL
      })

      return webpush.sendNotification(pushConfig, message).catch(err => {
        if (err.statusCode === 410) {
           // Subscription is dead, delete it
           supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      })
    })

    await Promise.all(notifications)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Push Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
