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
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')
    const secret = process.env.CRON_SECRET

    const isValidHeader = authHeader === `Bearer ${secret}`
    const isValidQuery = queryKey === secret

    if (!isValidHeader && !isValidQuery) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("⏳ Starting Detailed Daily Report Job...")

    // 3. Define Time Range (Yesterday 00:00 to 23:59)
    // NOTE: Change logic to 'new Date()' if you want TODAY'S report at end of day
    const reportDate = new Date()
    // reportDate.setDate(reportDate.getDate() - 1) // Uncomment to send YESTERDAY'S report
    
    const dateStr = reportDate.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    console.log(`📅 Generating reports for: ${dateStr}`)

    let emailsSent = 0

    // ====================================================
    // PART A: SEND REPORTS TO TEAM LEADERS
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
        await generateAndSendPivotReport(tl, teamMembers, startOfDay, endOfDay, dateStr, 'Team Daily Report')
        emailsSent++
      }
    }

    // ====================================================
    // PART B: SEND REPORTS TO TENANT ADMINS
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
        await generateAndSendPivotReport(admin, allStaff, startOfDay, endOfDay, dateStr, 'Company Daily Report')
        emailsSent++
      }
    }

    // ====================================================
    // PART C: SEND REPORTS TO SUPER ADMINS
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
          await generateAndSendPivotReport(superAdmin, globalStaff, startOfDay, endOfDay, dateStr, 'Global Daily Report')
          emailsSent++
        }
      }
    }

    return NextResponse.json({ success: true, emails_sent: emailsSent })

  } catch (error: any) {
    console.error("❌ Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ====================================================
// NEW HELPER: GENERATE PIVOT TABLE REPORT
// ====================================================
async function generateAndSendPivotReport(
  recipient: any, 
  subjects: any[], 
  startTime: string, 
  endTime: string, 
  dateDisplay: string,
  emailSubject: string
) {
  const subjectIds = subjects.map(s => s.id)

  // 1. Fetch Call Stats (For Duration and Count)
  const { data: calls } = await supabase
    .from('call_logs')
    .select('user_id, duration_seconds') 
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  // 2. Fetch Lead Status Updates (For the columns)
  // We fetch leads updated today
  const { data: leadsUpdated } = await supabase
    .from('leads')
    .select('assigned_to, status')
    .in('assigned_to', subjectIds)
    .gte('updated_at', startTime)
    .lte('updated_at', endTime)

  // 3. Initialize Stats Map
  // Structure: { userId: { name, totalCalls, duration, nr, interested, login... } }
  const statsMap: Record<string, any> = {}
  
  // Grand Totals Row
  const grandTotal = {
    count: 0, duration: 0, callback: 0, interested: 0, login: 0, 
    notEligible: 0, notInterested: 0, nr: 0, disbursed: 0, new: 0
  }

  subjects.forEach(s => {
    statsMap[s.id] = {
      name: s.full_name,
      count: 0, // From Call Logs
      duration: 0, // From Call Logs
      // Mapped Columns
      callback: 0,      // Status: follow_up
      interested: 0,    // Status: Interested, Documents_Sent
      login: 0,         // Status: Login
      notEligible: 0,   // Status: not_eligible
      notInterested: 0, // Status: Not_Interested
      nr: 0,            // Status: nr (Includes Busy, Switch Off, RNR)
      disbursed: 0,     // Status: Disbursed
      new: 0            // Status: new, contacted
    }
  })

  // 4. Process Call Logs (Count & Duration)
  calls?.forEach(call => {
    if (statsMap[call.user_id]) {
      statsMap[call.user_id].count++
      statsMap[call.user_id].duration += (call.duration_seconds || 0)
      
      grandTotal.count++
      grandTotal.duration += (call.duration_seconds || 0)
    }
  })

  // 5. Process Lead Statuses (The Columns)
  leadsUpdated?.forEach(lead => {
    if (!statsMap[lead.assigned_to]) return
    const userStat = statsMap[lead.assigned_to]
    const s = lead.status

    if (s === 'follow_up') {
      userStat.callback++
      grandTotal.callback++
    } 
    else if (s === 'Interested' || s === 'Documents_Sent') {
      userStat.interested++
      grandTotal.interested++
    }
    else if (s === 'Login') {
      userStat.login++
      grandTotal.login++
    }
    else if (s === 'not_eligible') {
      userStat.notEligible++
      grandTotal.notEligible++
    }
    else if (s === 'Not_Interested') {
      userStat.notInterested++
      grandTotal.notInterested++
    }
    else if (s === 'nr') {
      // Your DB maps "Busy", "RNR", "Switched Off" ALL to 'nr'
      userStat.nr++
      grandTotal.nr++
    }
    else if (s === 'Disbursed') {
      userStat.disbursed++
      grandTotal.disbursed++
    }
    else {
      // Catch-all for new/contacted
      userStat.new++
      grandTotal.new++
    }
  })

  // Helper to format minutes
  const fmtMins = (sec: number) => (sec / 60).toFixed(1)

  // 6. Generate HTML Rows
  const userRows = Object.values(statsMap).map((stat: any) => `
    <tr style="border-bottom: 1px solid #eee; text-align: center; color: #333;">
      <td style="padding: 8px; text-align: left; font-weight: 500;">${stat.name}</td>
      <td style="padding: 8px;">${stat.count}</td>
      <td style="padding: 8px;">${stat.nr}</td> <td style="padding: 8px;">${stat.callback}</td>
      <td style="padding: 8px;">${stat.interested}</td>
      <td style="padding: 8px;">${stat.login}</td>
      <td style="padding: 8px;">${stat.notEligible}</td>
      <td style="padding: 8px;">${stat.notInterested}</td>
      <td style="padding: 8px;">${stat.disbursed}</td>
      <td style="padding: 8px; font-weight: bold;">${fmtMins(stat.duration)} m</td>
    </tr>
  `).join('')

  // 7. Generate Total Row
  const totalRow = `
    <tr style="background-color: #e0f2fe; font-weight: bold; text-align: center; border-bottom: 2px solid #1e40af;">
      <td style="padding: 10px; text-align: left;">All (Total)</td>
      <td style="padding: 10px;">${grandTotal.count}</td>
      <td style="padding: 10px;">${grandTotal.nr}</td>
      <td style="padding: 10px;">${grandTotal.callback}</td>
      <td style="padding: 10px;">${grandTotal.interested}</td>
      <td style="padding: 10px;">${grandTotal.login}</td>
      <td style="padding: 10px;">${grandTotal.notEligible}</td>
      <td style="padding: 10px;">${grandTotal.notInterested}</td>
      <td style="padding: 10px;">${grandTotal.disbursed}</td>
      <td style="padding: 10px;">${fmtMins(grandTotal.duration)} m</td>
    </tr>
  `

  // 8. Construct Email HTML
  await resend.emails.send({
    from: 'Bankscart CRM <reports@crm.bankscart.com>', // Verify your domain to change this
    to: recipient.email,
    subject: `📊 ${emailSubject} - ${dateDisplay}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 12px; color: #333; overflow-x: auto;">
        <h2 style="color: #1e3a8a;">${emailSubject} (${dateDisplay})</h2>
        <p>Report includes total calls made and lead statuses updated today.</p>
        
        <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white; text-align: center;">
              <th style="padding: 10px; text-align: left;">User</th>
              <th style="padding: 10px;">Count</th>
              <th style="padding: 10px;" title="NR, Busy, RNR, Switched Off">NR / RNR / Busy</th>
              <th style="padding: 10px;">Callback</th>
              <th style="padding: 10px;" title="Interested + Docs Pending">Interested</th>
              <th style="padding: 10px;" title="Login + Sent to Login">Logged</th>
              <th style="padding: 10px;">Not Eligible</th>
              <th style="padding: 10px;">Not Interested</th>
              <th style="padding: 10px;">Disbursed</th>
              <th style="padding: 10px;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${totalRow}
            ${userRows}
          </tbody>
        </table>
        
        <p style="margin-top: 20px; color: #666;">
          <strong>Note:</strong> "NR / RNR / Busy" combines all non-reachable statuses (Switched Off, Wrong Number, etc) as they are grouped in the database.
        </p>
      </div>
    `
  })
}
