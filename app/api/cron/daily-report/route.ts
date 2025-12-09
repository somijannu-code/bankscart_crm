import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // --- AUTHENTICATION ---
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secret = process.env.CRON_SECRET
    
    if (authHeader !== `Bearer ${secret}` && searchParams.get('key') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("⏳ Starting Detailed Daily Report Job...")

    // --- DATE CONFIGURATION (YESTERDAY) ---
    const reportDate = new Date()
    reportDate.setDate(reportDate.getDate() - 1)
    
    const dateStr = reportDate.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    let emailsSent = 0

    // --- PART A: TEAM LEADERS ---
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
        await generateAndSendDetailedReport(tl, teamMembers, startOfDay, endOfDay, dateStr, 'Team Performance Report')
        emailsSent++
      }
    }

    // --- PART B: TENANT ADMINS ---
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
        await generateAndSendDetailedReport(admin, allStaff, startOfDay, endOfDay, dateStr, 'Full Company Daily Report')
        emailsSent++
      }
    }

    // --- PART C: SUPER ADMINS ---
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'owner'])
      .eq('is_active', true)

    if (superAdmins?.length > 0) {
      const { data: globalStaff } = await supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['telecaller', 'team_leader'])
        .eq('is_active', true)

      if (globalStaff?.length > 0) {
        for (const superAdmin of superAdmins) {
          await generateAndSendDetailedReport(superAdmin, globalStaff, startOfDay, endOfDay, dateStr, 'Global Daily Report')
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

// ==================================================================
//  CORE LOGIC: DETAILED MATRIX REPORT GENERATOR
// ==================================================================

// 1. Define the exact columns you requested
const REPORT_COLUMNS = [
  'Call disconnected',
  'Call forwarded',
  'Callback',       // Maps from 'follow_up'
  'Dnd',
  'Docs pending',   // Maps from 'Documents_Sent'
  'Interested',     // Maps from 'Interested'
  'Logged',         // Maps from 'Login'
  'Not eligible',   // Maps from 'not_eligible'
  'Not interested', // Maps from 'Not_Interested'
  'Not reachable',  // Maps from 'nr'
  'Number busy',    
  'Rnr',            // Maps from 'nr' (if distinct) or 'No Answer'
  'Rejected',
  'Sent to login',
  'Switched off',
  'Wrong number'
] as const;

async function generateAndSendDetailedReport(
  recipient: any, 
  subjects: any[], 
  startTime: string, 
  endTime: string, 
  dateDisplay: string,
  emailSubject: string
) {
  const subjectIds = subjects.map(s => s.id)

  // 2. Fetch Calls with 'outcome' or 'call_status'
  // We assume 'outcome' stores the specific result, or we deduce it from call_status/notes
  const { data: calls } = await supabase
    .from('call_logs')
    .select('user_id, outcome, call_status') // Ensure 'outcome' exists in your DB, else use call_status
    .in('user_id', subjectIds)
    .gte('created_at', startTime)
    .lte('created_at', endTime)

  // 3. Initialize Stats Map
  // Structure: { userId: { name: "John", total: 0, breakdowns: { "Interested": 5, "Callback": 2 ... } } }
  const statsMap: Record<string, any> = {}
  
  // Grand Total Row
  const grandTotal: Record<string, number> = {}
  REPORT_COLUMNS.forEach(col => grandTotal[col] = 0)
  let grandTotalCount = 0

  // Init users
  subjects.forEach(s => {
    statsMap[s.id] = { 
      name: s.full_name, 
      total: 0, 
      breakdowns: {} 
    }
    // Set all columns to 0 initially
    REPORT_COLUMNS.forEach(col => statsMap[s.id].breakdowns[col] = 0)
  })

  // 4. Aggregate Data
  const callList = calls || []
  
  callList.forEach(call => {
    if (!statsMap[call.user_id]) return

    const userStat = statsMap[call.user_id]
    const rawStatus = (call.outcome || call.call_status || "").toLowerCase() // Normalize DB value

    // MAPPER: Database Value -> Report Column
    let reportColumn = mapDbStatusToReportColumn(rawStatus)

    // Increment Total
    userStat.total++
    grandTotalCount++

    // Increment Specific Column if it exists in our report list
    if (reportColumn && userStat.breakdowns.hasOwnProperty(reportColumn)) {
      userStat.breakdowns[reportColumn]++
      grandTotal[reportColumn]++
    } else {
        // Handle unmapped cases (Optional: log them or ignore)
        // console.log("Unmapped status:", rawStatus) 
    }
  })

  // 5. Generate HTML
  // CSS for tight "Excel-like" table
  const tableStyle = `
    width: 100%; 
    border-collapse: collapse; 
    font-size: 11px; 
    font-family: Arial, sans-serif;
    border: 1px solid #ccc;
  `
  const thStyle = `
    background-color: #f3f4f6; 
    border: 1px solid #ccc; 
    padding: 6px 4px; 
    text-align: center; 
    font-weight: bold;
    white-space: nowrap;
  `
  const tdStyle = `
    border: 1px solid #ccc; 
    padding: 6px 4px; 
    text-align: center;
    color: #333;
  `
  const nameStyle = `
    border: 1px solid #ccc; 
    padding: 6px 4px; 
    text-align: left; 
    white-space: nowrap;
    font-weight: 500;
  `

  // HEADER ROW
  const headerHtml = `
    <tr>
      <th style="${thStyle}">Project</th>
      <th style="${thStyle}">User</th>
      <th style="${thStyle}">Count</th>
      ${REPORT_COLUMNS.map(col => `<th style="${thStyle}">${col}</th>`).join('')}
    </tr>
  `

  // GRAND TOTAL ROW (The "All" row)
  const totalRowHtml = `
    <tr style="background-color: #e5e7eb; font-weight: bold;">
      <td style="${tdStyle}">All</td>
      <td style="${tdStyle}">-</td>
      <td style="${tdStyle}">${grandTotalCount}</td>
      ${REPORT_COLUMNS.map(col => `<td style="${tdStyle}">${grandTotal[col]}</td>`).join('')}
    </tr>
  `

  // USER ROWS
  // Sort by Total Count descending
  const userRowsHtml = Object.values(statsMap)
    .sort((a: any, b: any) => b.total - a.total)
    .map((stat: any) => `
      <tr>
        <td style="${tdStyle}">Internal PL</td>
        <td style="${nameStyle}">${stat.name}</td>
        <td style="${tdStyle}"><strong>${stat.total}</strong></td>
        ${REPORT_COLUMNS.map(col => `
          <td style="${tdStyle}${stat.breakdowns[col] > 0 ? 'background-color:#f0fdf4;' : ''}">
            ${stat.breakdowns[col]}
          </td>
        `).join('')}
      </tr>
    `).join('')

  // 6. Send Email
  await .emails.send({
    from: 'Bankscart CRM <reports@crm.bankscart.com>', // Update after domain verification
    to: recipient.email,
    subject: `📊 ${emailSubject} - ${dateDisplay}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1e3a8a; margin-bottom: 5px;">${emailSubject}</h2>
        <p style="margin-top: 0; color: #666; font-size: 14px;">Date: <strong>${dateDisplay}</strong></p>
        
        <div style="overflow-x: auto;">
          <table style="${tableStyle}">
            <thead>
              ${headerHtml}
            </thead>
            <tbody>
              ${totalRowHtml}
              ${userRowsHtml}
            </tbody>
          </table>
        </div>
        
        <p style="margin-top: 20px; color: #999; font-size: 11px;">
          Generated automatically by Bankscart CRM.
        </p>
      </div>
    `
  })
}

// ==================================================================
//  HELPER: MAPPER FUNCTION
//  Translates your DB statuses to the Report Headers
// ==================================================================
function mapDbStatusToReportColumn(status: string): string | null {
  // Normalize string
  const s = status.trim().toLowerCase().replace(/_/g, ' ')

  // MAPPING LOGIC
  if (s.includes('interested') && !s.includes('not')) return 'Interested'
  if (s.includes('not interested')) return 'Not interested'
  if (s.includes('follow') || s.includes('callback')) return 'Callback'
  if (s.includes('login') || s.includes('logged')) return 'Logged'
  if (s.includes('doc') || s.includes('document')) return 'Docs pending'
  if (s.includes('eligible') && s.includes('not')) return 'Not eligible'
  if (s.includes('nr') || s.includes('not reachable') || s.includes('no answer')) return 'Not reachable' // or 'Rnr'
  if (s.includes('rnr') || s.includes('ringing')) return 'Rnr'
  if (s.includes('busy')) return 'Number busy'
  if (s.includes('switch') || s.includes('off')) return 'Switched off'
  if (s.includes('wrong') || s.includes('invalid')) return 'Wrong number'
  if (s.includes('disconnect') || s.includes('cut')) return 'Call disconnected'
  if (s.includes('forward')) return 'Call forwarded'
  if (s.includes('dnd') || s.includes('disturb')) return 'Dnd'
  if (s.includes('reject')) return 'Rejected'
  if (s.includes('sent to login')) return 'Sent to login'
  
  return null // Return null if it doesn't match a specific column
}
