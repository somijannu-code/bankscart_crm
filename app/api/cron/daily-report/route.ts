import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// 1. CONFIGURATION
// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'
// Increase timeout to 60 seconds (max for Hobby plan) to handle multiple emails
export const maxDuration = 60; 

// Init Clients (Use Service Role to bypass RLS)
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // 2. SECURITY CHECK
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')
    const secret = process.env.CRON_SECRET

    // Debug Logs (Check Vercel Logs if this fails)
    console.log("🔒 Auth Check initiated...")
    if (!secret) {
        console.error("❌ CRON_SECRET is missing in Environment Variables!")
        return NextResponse.json({ error: 'Server Config Error: Missing Secret' }, { status: 500 })
    }

    // Check Vercel Cron Header (Bearer Token)
    const isVercelAuth = authHeader === `Bearer ${secret}`
    
    // Check Manual Browser Param (?key=...)
    const isManualAuth = queryKey === secret

    if (!isVercelAuth && !isManualAuth) {
      console.warn(`❌ Unauthorized Access Attempt.`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("✅ Auth Successful. Starting Daily Report Job...")

    // 3. Define Time Range (Yesterday 00:00 to 23:59)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Format dates to ISO strings for Supabase comparison
    const dateStr = yesterday.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    console.log(`📅 Generating reports for date: ${dateStr}`)

    let emailsSent = 0

    // ====================================================
    // PART A: SEND REPORTS TO TEAM LEADERS (Direct Reports Only)
    // ====================================================
    const { data: teamLeaders } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('role', 'team_leader')
      .eq('is_active', true)

    if (teamLeaders) {
      for (const tl of teamLeaders) {
        const { data: teamMembers } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('manager_id', tl.id)

        if (!teamMembers || teamMembers.length === 0) continue

        await generateAndSendReport(tl, teamMembers, startOfDay, endOfDay, dateStr, 'Team Performance Report')
        emailsSent++
      }
    }

    // ====================================================
    // PART B: SEND REPORTS TO TENANT ADMINS (Whole Company)
    // ====================================================
    const { data: tenantAdmins } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('role', 'tenant_admin')
      .eq('is_active', true)

    if (tenantAdmins) {
      for (const admin of tenantAdmins) {
        const { data: allStaff } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('tenant_id', admin.tenant_id)
          .in('role', ['telecaller', 'team_leader']) 

        if (!allStaff || allStaff.length === 0) continue

        await generateAndSendReport(admin, allStaff, startOfDay, endOfDay, dateStr, 'Full Company Daily Report')
        emailsSent++
      }
    }

    // ====================================================
    // PART C: SEND REPORTS TO SUPER ADMINS (Global / All Tenants)
    // ====================================================
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'owner'])
      .eq('is_active', true)

    if (superAdmins && superAdmins.length > 0) {
      const { data: globalStaff } = await supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['telecaller', 'team_leader'])
        .eq('is_active', true)

      if (globalStaff && globalStaff.length > 0) {
        for (const superAdmin of superAdmins) {
          await generateAndSendReport(
            superAdmin, 
            globalStaff, 
            startOfDay, 
            endOfDay, 
            dateStr, 
            'Global System Daily Report'
          )
          emailsSent++
        }
      }
    }

    console.log(`✅ Job Complete. Emails Sent: ${emailsSent}`)
    return NextResponse.json({ success: true, emails_sent: emailsSent })

  } catch (error: any) {
    console.error("❌ Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ====================================================
// HELPER: EMAIL LOGIC
// ====================================================
async function generateAndSendReport(
  recipient: any, 
  subjects: any[], 
  startTime: string, 
  endTime: string, 
  dateDisplay: string,
  emailSubject: string
) {
  const subjectIds = subjects.map(s => s.id)

  const { data: calls } = await supabase
    .from('call_logs')
    .select('user_id, duration_seconds, call_status') 
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  const callList = calls || []

  // Aggregate Stats
  let totalCalls = 0
  let totalDuration = 0
  let connectedCalls = 0
  
  const userStats: Record<string, { name: string, total: number, connected: number, duration: number }> = {}
  
  subjects.forEach(s => {
    userStats[s.id] = { name: s.full_name, total: 0, connected: 0, duration: 0 }
  })

  callList.forEach(call => {
    if (!userStats[call.user_id]) return 
    
    const stats = userStats[call.user_id]
    const duration = call.duration_seconds || 0 
    
    stats.total++
    stats.duration += duration
    totalCalls++
    totalDuration += duration

    if (duration > 0) {
      stats.connected++
      connectedCalls++
    }
  })

  const formatMins = (seconds: number) => Math.round(seconds / 60)

  const tableRows = Object.values(userStats)
    .sort((a, b) => b.total - a.total)
    .map(stat => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${stat.name}</td>
        <td style="padding: 10px; text-align: center;">${stat.total}</td>
        <td style="padding: 10px; text-align: center;">${stat.connected}</td>
        <td style="padding: 10px; text-align: right;">${formatMins(stat.duration)} mins</td>
      </tr>
    `).join('')

  try {
    // Attempt to send email
    await resend.emails.send({
        from: 'Bankscart CRM <onboarding@resend.dev>', // Update this after domain verification
        to: recipient.email,
        subject: `📊 ${emailSubject} - ${dateDisplay}`,
        html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${emailSubject}</h2>
            <p>Summary for <strong>${dateDisplay}</strong>.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 5px;">📞 Total Calls: <strong>${totalCalls}</strong></li>
                <li style="margin-bottom: 5px;">✅ Connected: <strong>${connectedCalls}</strong></li>
                <li style="margin-bottom: 5px;">⏱ Talk Time: <strong>${formatMins(totalDuration)} mins</strong></li>
            </ul>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 10px;">User</th>
                <th style="padding: 10px; text-align: center;">Calls</th>
                <th style="padding: 10px; text-align: center;">Conn.</th>
                <th style="padding: 10px; text-align: right;">Mins</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            </table>
        </div>
        `
    })
  } catch (err) {
    console.error(`Failed to send email to ${recipient.email}:`, err)
  }
}
