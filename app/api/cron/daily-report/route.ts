import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// 1. Init Clients
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // 2. SECURITY CHECK
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const queryKey = searchParams.get('key')
    const secret = process.env.CRON_SECRET

    const isValidHeader = authHeader === `Bearer ${secret}`
    const isValidQuery = queryKey === secret

    if (!isValidHeader && !isValidQuery) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("⏳ Starting Daily Report Job...")

    // 3. DETERMINE DATE RANGE
    // Defaults to YESTERDAY, unless ?date=YYYY-MM-DD is passed
    const manualDate = searchParams.get('date')
    const targetDate = manualDate ? new Date(manualDate) : new Date()
    
    if (!manualDate) {
      // If no date provided, go back 1 day (standard cron behavior)
      targetDate.setDate(targetDate.getDate() - 1)
    }
    
    const dateStr = targetDate.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    console.log(`📅 Generating reports for: ${dateStr} (Range: ${startOfDay} to ${endOfDay})`)

    let emailsSent = 0

    // ====================================================
    // PART A: TEAM LEADERS
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
    // PART B: TENANT ADMINS
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
    // PART C: SUPER ADMINS
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
          await generateAndSendReport(superAdmin, globalStaff, startOfDay, endOfDay, dateStr, 'Global System Daily Report')
          emailsSent++
        }
      }
    }

    return NextResponse.json({ success: true, date_used: dateStr, emails_sent: emailsSent })

  } catch (error: any) {
    console.error("❌ Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ====================================================
// HELPER: DATA AGGREGATION
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

  // 1. Fetch Call Logs (Selecting BOTH duration columns to be safe)
  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('user_id, duration, duration_seconds, call_status') 
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  if (error) {
    console.error("Error fetching calls:", error)
    return 
  }

  const callList = calls || []
  
  // Debug Log (Check Vercel logs to see if calls are actually found)
  console.log(`🔍 Found ${callList.length} calls for ${recipient.email} between ${startTime} and ${endTime}`)

  // 2. Aggregate Stats
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
    
    // SMART DURATION CHECK: Use whichever column has data
    const validDuration = (call.duration_seconds && call.duration_seconds > 0) 
      ? call.duration_seconds 
      : (call.duration || 0)
    
    stats.total++
    stats.duration += validDuration
    totalCalls++
    totalDuration += validDuration

    if (validDuration > 0 || call.call_status === 'connected' || call.call_status === 'completed') {
      stats.connected++
      connectedCalls++
    }
  })

  const formatMins = (seconds: number) => Math.round(seconds / 60)

  // 3. Generate HTML Table
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

  // 4. Send Email
  await resend.emails.send({
    from: 'Bankscart CRM <reports@crm.bankscart.com>', 
    to: recipient.email,
    subject: `📊 ${emailSubject} - ${dateDisplay}`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${emailSubject}</h2>
        <p>Activity for <strong>${dateDisplay}</strong></p>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 5px;">📞 <strong>Calls:</strong> ${totalCalls}</li>
            <li style="margin-bottom: 5px;">✅ <strong>Connected:</strong> ${connectedCalls}</li>
            <li style="margin-bottom: 5px;">⏱ <strong>Duration:</strong> ${formatMins(totalDuration)} mins</li>
          </ul>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px;">User</th>
              <th style="padding: 10px; text-align: center;">Calls</th>
              <th style="padding: 10px; text-align: center;">Conn.</th>
              <th style="padding: 10px; text-align: right;">Time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `
  })
}
