import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// 1. Init Clients (Use Service Role to bypass RLS for background jobs)
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // 2. Security Check (Prevent strangers from triggering this url)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    console.log("⏳ Starting Daily Report Job...")

    // 3. Define Time Range (Yesterday 00:00 to 23:59)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    // ====================================================
    // PART A: SEND REPORTS TO TEAM LEADERS (Direct Reports Only)
    // ====================================================
    
    // Fetch all Team Leaders
    const { data: teamLeaders } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('role', 'team_leader')
      .eq('is_active', true)

    let emailsSent = 0

    if (teamLeaders) {
      for (const tl of teamLeaders) {
        // Find their subordinates
        const { data: teamMembers } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('manager_id', tl.id)

        if (!teamMembers || teamMembers.length === 0) continue

        // Generate and Send the Email
        await generateAndSendReport(tl, teamMembers, startOfDay, endOfDay, dateStr, 'Team Performance Report')
        emailsSent++
      }
    }

    // ====================================================
    // PART B: SEND REPORTS TO TENANT ADMINS (Whole Company)
    // ====================================================

    // Fetch all Tenant Admins
    const { data: tenantAdmins } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('role', 'tenant_admin')
      .eq('is_active', true)

    if (tenantAdmins) {
      for (const admin of tenantAdmins) {
        // Find EVERYONE in their tenant (excluding themselves maybe)
        const { data: allStaff } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('tenant_id', admin.tenant_id)
          .in('role', ['telecaller', 'team_leader']) // Report on staff only

        if (!allStaff || allStaff.length === 0) continue

        // Generate and Send the Email
        await generateAndSendReport(admin, allStaff, startOfDay, endOfDay, dateStr, 'Full Company Daily Report')
        emailsSent++
      }
    }

    return NextResponse.json({ success: true, emails_sent: emailsSent })

  } catch (error: any) {
    console.error("❌ Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ====================================================
// HELPER: DATA AGGREGATION & EMAIL SENDING
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

  // 1. Fetch Call Logs for these users for Yesterday
  const { data: calls } = await supabase
    .from('call_logs')
    .select('user_id, duration, call_status, call_type')
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  // If no calls made by anyone, maybe skip email? Or send "Zero Activity" report.
  // We will send it anyway so managers know nothing happened.
  const callList = calls || []

  // 2. Aggregate Stats
  let totalCalls = 0
  let totalDuration = 0
  let connectedCalls = 0
  
  // Per User Breakdown
  const userStats: Record<string, { name: string, total: number, connected: number, duration: number }> = {}
  
  // Initialize with 0 for everyone
  subjects.forEach(s => {
    userStats[s.id] = { name: s.full_name, total: 0, connected: 0, duration: 0 }
  })

  // Fill real data
  callList.forEach(call => {
    if (!userStats[call.user_id]) return // Should not happen
    
    const stats = userStats[call.user_id]
    stats.total++
    stats.duration += (call.duration || 0)
    totalCalls++
    totalDuration += (call.duration || 0)

    if (call.call_status === 'connected' || call.call_status === 'completed') {
      stats.connected++
      connectedCalls++
    }
  })

  // 3. Generate HTML Table
  const tableRows = Object.values(userStats)
    .sort((a, b) => b.total - a.total) // Sort by highest activity
    .map(stat => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${stat.name}</td>
        <td style="padding: 10px; text-align: center;">${stat.total}</td>
        <td style="padding: 10px; text-align: center;">${stat.connected}</td>
        <td style="padding: 10px; text-align: right;">${Math.round(stat.duration / 60)} mins</td>
      </tr>
    `).join('')

  // 4. Send Email
  await resend.emails.send({
    from: 'Bankscart CRM <reports@yourdomain.com>', // MUST verify domain in Resend
    to: recipient.email,
    subject: `📊 ${emailSubject} - ${dateDisplay}`,
    html: `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${emailSubject}</h2>
        <p>Here is the summary of calling activity for <strong>${dateDisplay}</strong>.</p>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0;">Overview</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 5px;">📞 <strong>Total Calls:</strong> ${totalCalls}</li>
            <li style="margin-bottom: 5px;">✅ <strong>Connected:</strong> ${connectedCalls}</li>
            <li style="margin-bottom: 5px;">⏱ <strong>Total Talk Time:</strong> ${Math.round(totalDuration / 60)} mins</li>
          </ul>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px;">Telecaller</th>
              <th style="padding: 10px; text-align: center;">Total Calls</th>
              <th style="padding: 10px; text-align: center;">Connected</th>
              <th style="padding: 10px; text-align: right;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <p style="margin-top: 30px; font-size: 12px; color: #888;">
          This is an automated report from Bankscart CRM.
        </p>
      </div>
    `
  })
}
