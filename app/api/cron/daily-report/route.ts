import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// 1. Init Clients
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Force dynamic to prevent caching
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

    console.log("⏳ Starting Performance Report Job...")

    // 3. Define Time Range (Yesterday 00:00 to 23:59)
    const reportDate = new Date()
    reportDate.setDate(reportDate.getDate() - 1) // Yesterday
    
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
// UPDATED HELPER: SORTED & COLOR CODED REPORT
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

  // 1. Fetch Call Stats
  const { data: calls } = await supabase
    .from('call_logs')
    .select('user_id, duration_seconds') 
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  // 2. Fetch Lead Status Updates
  const { data: leadsUpdated } = await supabase
    .from('leads')
    .select('assigned_to, status')
    .in('assigned_to', subjectIds)
    .gte('updated_at', startTime)
    .lte('updated_at', endTime)

  // 3. Initialize Stats Map
  const statsMap: Record<string, any> = {}
  
  // Grand Totals Row
  const grandTotal = {
    count: 0, duration: 0, callback: 0, interested: 0, login: 0, 
    notEligible: 0, notInterested: 0, nr: 0, disbursed: 0, new: 0
  }

  subjects.forEach(s => {
    statsMap[s.id] = {
      name: s.full_name,
      count: 0,
      duration: 0,
      callback: 0, interested: 0, login: 0, notEligible: 0, 
      notInterested: 0, nr: 0, disbursed: 0, new: 0
    }
  })

  // 4. Process Call Logs
  calls?.forEach(call => {
    if (statsMap[call.user_id]) {
      statsMap[call.user_id].count++
      statsMap[call.user_id].duration += (call.duration_seconds || 0)
      
      grandTotal.count++
      grandTotal.duration += (call.duration_seconds || 0)
    }
  })

  // 5. Process Lead Statuses
  leadsUpdated?.forEach(lead => {
    if (!statsMap[lead.assigned_to]) return
    const userStat = statsMap[lead.assigned_to]
    const s = lead.status

    if (s === 'follow_up') { userStat.callback++; grandTotal.callback++; } 
    else if (s === 'Interested' || s === 'Documents_Sent') { userStat.interested++; grandTotal.interested++; }
    else if (s === 'Login') { userStat.login++; grandTotal.login++; }
    else if (s === 'not_eligible') { userStat.notEligible++; grandTotal.notEligible++; }
    else if (s === 'Not_Interested') { userStat.notInterested++; grandTotal.notInterested++; }
    else if (s === 'nr') { userStat.nr++; grandTotal.nr++; }
    else if (s === 'Disbursed') { userStat.disbursed++; grandTotal.disbursed++; }
    else { userStat.new++; grandTotal.new++; }
  })

  // Helper to format minutes
  const fmtMins = (sec: number) => (sec / 60).toFixed(1)

  // ====================================================
  // NEW LOGIC: SORTING & COLOR CODING
  // ====================================================

  // 1. Sort users by COUNT (Highest First)
  const sortedUsers = Object.values(statsMap).sort((a: any, b: any) => b.count - a.count)
  const totalUsers = sortedUsers.length

  // 2. Generate HTML Rows with Conditional Formatting
  const userRows = sortedUsers.map((stat: any, index: number) => {
    let countStyle = 'padding: 8px;' // Default

    // Logic: Divide list into thirds
    // Top 33% -> Green
    // Middle 33% -> Orange
    // Bottom 33% -> Red
    // (If count is 0, always Red)
    
    if (stat.count === 0) {
      countStyle += 'background-color: #fee2e2; color: #991b1b; font-weight: bold;' // Dark Red
    } else if (index < totalUsers / 3) {
      countStyle += 'background-color: #dcfce7; color: #166534; font-weight: bold;' // Green
    } else if (index < (totalUsers * 2) / 3) {
      countStyle += 'background-color: #ffedd5; color: #9a3412; font-weight: bold;' // Orange
    } else {
      countStyle += 'background-color: #fee2e2; color: #991b1b; font-weight: bold;' // Red
    }

    return `
    <tr style="border-bottom: 1px solid #eee; text-align: center; color: #333;">
      <td style="padding: 8px; text-align: left; font-weight: 500;">${stat.name}</td>
      <td style="${countStyle}">${stat.count}</td>
      <td style="padding: 8px;">${stat.nr}</td> 
      <td style="padding: 8px;">${stat.callback}</td>
      <td style="padding: 8px;">${stat.interested}</td>
      <td style="padding: 8px;">${stat.login}</td>
      <td style="padding: 8px;">${stat.notEligible}</td>
      <td style="padding: 8px;">${stat.notInterested}</td>
      <td style="padding: 8px;">${stat.disbursed}</td>
      <td style="padding: 8px;">${fmtMins(stat.duration)} m</td>
    </tr>
  `}).join('')

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
    from: 'Bankscart CRM <reports@crm.bankscart.com>', 
    to: recipient.email,
    subject: `📊 ${emailSubject} - ${dateDisplay}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 12px; color: #333; overflow-x: auto;">
        <h2 style="color: #1e3a8a;">${emailSubject} (${dateDisplay})</h2>
        <p>Sorted by call volume (High to Low).</p>
        
        <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white; text-align: center;">
              <th style="padding: 10px; text-align: left;">User</th>
              <th style="padding: 10px;">Count</th>
              <th style="padding: 10px;" title="NR, Busy, RNR, Switched Off">NR/RNR</th>
              <th style="padding: 10px;">Callback</th>
              <th style="padding: 10px;" title="Interested + Docs Pending">Inter.</th>
              <th style="padding: 10px;" title="Login + Sent to Login">Logged</th>
              <th style="padding: 10px;">Not Elg.</th>
              <th style="padding: 10px;">Not Int.</th>
              <th style="padding: 10px;">Disb.</th>
              <th style="padding: 10px;">Dur.</th>
            </tr>
          </thead>
          <tbody>
            ${totalRow}
            ${userRows}
          </tbody>
        </table>
        
        <div style="margin-top: 15px; font-size: 11px;">
           <span style="display:inline-block; width: 10px; height: 10px; background: #dcfce7; border: 1px solid #166534; margin-right: 5px;"></span> High Activity
           <span style="display:inline-block; width: 10px; height: 10px; background: #ffedd5; border: 1px solid #9a3412; margin-right: 5px; margin-left: 10px;"></span> Medium
           <span style="display:inline-block; width: 10px; height: 10px; background: #fee2e2; border: 1px solid #991b1b; margin-right: 5px; margin-left: 10px;"></span> Low
        </div>
      </div>
    `
  })
}
