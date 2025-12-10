import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// --- CONFIGURATION ---
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// TARGETS
const TARGET_DAILY_CALLS = 350
const TARGET_DAILY_LOGINS = 3

// HELPER: Pause execution to prevent email rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// HELPER: Currency Formatter
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

export async function GET(request: Request) {
  try {
    // 1. SECURITY & TEST MODE CHECK
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')
    const testEmail = searchParams.get('test_email') // <--- NEW PARAMETER
    const secret = process.env.CRON_SECRET

    // Allow access if Header is correct OR if Query Key is correct
    if ((authHeader !== `Bearer ${secret}`) && (queryKey !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isTestMode = !!testEmail
    console.log(isTestMode ? `🧪 Starting TEST MODE (Sending to ${testEmail})...` : "⏳ Starting Daily Report Job...")

    // 2. TIME CALCULATIONS
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Dates
    const dateStr = yesterday.toISOString().split('T')[0] // YYYY-MM-DD
    const startOfYesterday = `${dateStr}T00:00:00.000Z`
    const endOfYesterday = `${dateStr}T23:59:59.999Z`

    // Monthly Range (For Revenue Targets)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString()
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, totalDaysInMonth - today.getDate())

    let emailsSent = 0

    // 3. FETCH ALL ACTIVE USERS
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, full_name, role, tenant_id, monthly_target')
      .eq('is_active', true)

    if (!allUsers || allUsers.length === 0) return NextResponse.json({ message: "No users found" })

    // Group by Tenant
    const usersByTenant: Record<string, any[]> = {}
    allUsers.forEach(u => {
      if (!usersByTenant[u.tenant_id]) usersByTenant[u.tenant_id] = []
      usersByTenant[u.tenant_id].push(u)
    })

    // ============================================================
    // PROCESS TENANTS
    // ============================================================
    const tenantIds = Object.keys(usersByTenant)
    
    // IF TEST MODE: Only process the first tenant found
    const tenantsToProcess = isTestMode ? [tenantIds[0]] : tenantIds

    for (const tenantId of tenantsToProcess) {
      if (!tenantId) continue
      const tenantUsers = usersByTenant[tenantId]
      
      const telecallers = tenantUsers.filter(u => u.role === 'telecaller')
      const admins = tenantUsers.filter(u => ['tenant_admin', 'team_leader', 'super_admin', 'owner'].includes(u.role))
      
      const staffIds = telecallers.map(u => u.id)
      if (staffIds.length === 0) continue

      // A. FETCH RAW DATA
      const { data: calls } = await supabase
        .from('call_logs')
        .select('user_id, duration_seconds, call_status')
        .in('user_id', staffIds)
        .gte('created_at', startOfYesterday)
        .lte('created_at', endOfYesterday)

      const { data: leadUpdates } = await supabase
        .from('leads')
        .select('assigned_to, status')
        .in('assigned_to', staffIds)
        .gte('updated_at', startOfYesterday)
        .lte('updated_at', endOfYesterday)

      const { data: revenueLeads } = await supabase
        .from('leads')
        .select('assigned_to, disbursed_amount, loan_amount')
        .in('assigned_to', staffIds)
        .gte('updated_at', startOfMonth)
        .lte('updated_at', endOfMonth)
        .eq('status', 'Disbursed')

      // B. AGGREGATE STATS
      const statsMap: Record<string, any> = {}

      telecallers.forEach(u => {
        statsMap[u.id] = {
          user: u,
          count: 0, duration: 0, nr: 0, callback: 0, interested: 0, 
          login: 0, notEligible: 0, notInterested: 0, disbursedCount: 0,
          revenueAchieved: 0
        }
      })

      calls?.forEach(c => {
        if(statsMap[c.user_id]) {
          statsMap[c.user_id].count++
          statsMap[c.user_id].duration += (c.duration_seconds || 0)
        }
      })

      leadUpdates?.forEach(l => {
        if(!statsMap[l.assigned_to]) return
        const s = statsMap[l.assigned_to]
        const status = l.status
        
        if (status === 'follow_up') s.callback++
        else if (['Interested', 'Documents_Sent'].includes(status)) s.interested++
        else if (['Login', 'Sent to Login'].includes(status)) s.login++
        else if (status === 'not_eligible') s.notEligible++
        else if (status === 'Not_Interested') s.notInterested++
        else if (['nr', 'Busy', 'RNR', 'Switched Off'].includes(status)) s.nr++
        else if (status === 'Disbursed') s.disbursedCount++
      })

      revenueLeads?.forEach(l => {
        if(statsMap[l.assigned_to]) {
          statsMap[l.assigned_to].revenueAchieved += (l.disbursed_amount || l.loan_amount || 0)
        }
      })

      const statsArray = Object.values(statsMap)
      const revenueSorted = [...statsArray].sort((a:any, b:any) => b.revenueAchieved - a.revenueAchieved)
      const volumeSorted = [...statsArray].sort((a:any, b:any) => b.count - a.count)
      const topRevenuePerformer = revenueSorted[0]

      // C. SEND EMAILS
      // --------------

      // 1. Send "Performance Coach" (TELECALLER REPORT)
      // IF TEST MODE: Only send for the 1st Telecaller in list
      const telecallersToSend = isTestMode ? [revenueSorted[0]] : revenueSorted

      for (const stat of telecallersToSend) {
        if (!stat) continue
        const rank = revenueSorted.findIndex((s:any) => s.user.id === stat.user.id) + 1
        
        await sendTelecallerReport({
          recipient: stat.user,
          stats: stat,
          rank,
          totalStaff: revenueSorted.length,
          topPerformer: topRevenuePerformer,
          daysRemaining,
          dateStr,
          testEmail // Pass the override email
        })
        emailsSent++
        if (!isTestMode) await delay(200) 
      }

      // 2. Send "Global Report" (ADMIN REPORT)
      // IF TEST MODE: Only send 1 email to the tester
      const adminsToSend = isTestMode ? [{ email: testEmail }] : admins

      if (adminsToSend.length > 0) {
        const adminHTML = generateAdminHTML(volumeSorted, dateStr)
        
        for (const admin of adminsToSend) {
          await resend.emails.send({
            from: 'Bankscart CRM <reports@crm.bankscart.com>', // UPDATE DOMAIN
            to: isTestMode ? testEmail! : admin.email,
            subject: `📊 Global Daily Report - ${dateStr} ${isTestMode ? '(TEST)' : ''}`,
            html: adminHTML
          })
          emailsSent++
          if (!isTestMode) await delay(200)
          
          // In test mode, only send 1 admin report total
          if (isTestMode) break 
        }
      }
      
      // In test mode, stop after processing one tenant
      if (isTestMode) break
    }

    return NextResponse.json({ success: true, emails_sent: emailsSent, mode: isTestMode ? 'TEST' : 'LIVE' })

  } catch (error: any) {
    console.error("❌ Cron Job Failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


// ==================================================================
// TEMPLATE 1: TELECALLER COACHING REPORT
// ==================================================================
async function sendTelecallerReport({ recipient, stats, rank, totalStaff, topPerformer, daysRemaining, dateStr, testEmail }: any) {
  
  const target = recipient.monthly_target || 2000000
  const gap = Math.max(0, target - stats.revenueAchieved)
  const dailyRequired = gap / daysRemaining
  
  // Rank Colors
  let rankColor = '#f97316' 
  let rankMsg = "You're doing okay, keep pushing."
  if (rank === 1) { rankColor = '#22c55e'; rankMsg = "You are the CHAMPION! 🏆"; }
  else if (rank > (totalStaff * 0.66)) { rankColor = '#ef4444'; rankMsg = "You are in the danger zone."; }

  // Coach Analysis
  let coachBox = ''
  if (stats.count < TARGET_DAILY_CALLS) {
    coachBox = `
      <div style="border-left: 4px solid #ef4444; background: #fef2f2; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #991b1b;">⚠️ Volume Alert:</strong> 
        You made <strong>${stats.count}</strong> calls yesterday. The target is <strong>${TARGET_DAILY_CALLS}</strong>. 
        High volume is the first step to success.
      </div>`
  } else if (stats.login < TARGET_DAILY_LOGINS) {
    coachBox = `
      <div style="border-left: 4px solid #f97316; background: #fff7ed; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #9a3412;">⚠️ Conversion Alert:</strong> 
        Good volume (${stats.count}), but only <strong>${stats.login}</strong> logins. Focus on closing today.
      </div>`
  } else {
    coachBox = `
      <div style="border-left: 4px solid #22c55e; background: #f0fdf4; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #166534;">✅ Excellent Work:</strong> 
        You hit your targets! Keep this momentum going.
      </div>`
  }

  const progressPercent = Math.min(100, (stats.revenueAchieved / target) * 100)

  const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 8px;">
        
        <div style="text-align: center; background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Daily Performance Coach</h2>
          <p style="margin: 5px 0 0; opacity: 0.8;">${dateStr}</p>
        </div>

        <div style="padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 42px; color: ${rankColor};">#${rank}</h1>
            <p style="margin: 0; font-weight: bold; color: ${rankColor};">${rankMsg}</p>
            <p style="font-size: 12px; color: #999;">Center Rank (Revenue)</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 11px; color: #666; margin: 0;">Calls (Target: ${TARGET_DAILY_CALLS})</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${stats.count >= TARGET_DAILY_CALLS ? '#22c55e' : '#ef4444'}">
                ${stats.count}
              </p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 11px; color: #666; margin: 0;">Logins (Target: ${TARGET_DAILY_LOGINS})</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${stats.login >= TARGET_DAILY_LOGINS ? '#22c55e' : '#ef4444'}">
                ${stats.login}
              </p>
            </div>
          </div>

          <h3 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 10px;">🛡️ Coach's Analysis</h3>
          ${coachBox}

          <div style="margin-top: 30px;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 10px;">💰 Revenue Target</h3>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
              <span>Achieved: ${formatCurrency(stats.revenueAchieved)}</span>
              <span>Target: ${formatCurrency(target)}</span>
            </div>
            <div style="width: 100%; background: #e2e8f0; height: 12px; border-radius: 6px; overflow: hidden;">
              <div style="width: ${progressPercent}%; background: #2563eb; height: 100%;"></div>
            </div>
            
            <div style="background: #eff6ff; padding: 10px; margin-top: 10px; border-radius: 5px; font-size: 13px; color: #1e40af;">
               To hit your target, you need <strong>${formatCurrency(dailyRequired)}</strong> in disbursement <strong>every day</strong> for the remaining ${daysRemaining} days.
            </div>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
            <p>Top Performer Today: <strong>${topPerformer.user.full_name}</strong> (${formatCurrency(topPerformer.revenueAchieved)})</p>
            Keep pushing! 🚀
          </div>
        </div>
      </div>
  `

  await resend.emails.send({
    from: 'Bankscart CRM <reports@crm.bankscart.com>', 
    to: testEmail || recipient.email, // USE TEST EMAIL IF AVAILABLE
    subject: `🎯 Performance Coach - ${dateStr} ${testEmail ? '(TEST)' : ''}`,
    html: html
  })
}


// ==================================================================
// TEMPLATE 2: ADMIN GLOBAL REPORT
// ==================================================================
function generateAdminHTML(sortedStats: any[], dateStr: string) {
  
  const total = { count: 0, nr: 0, callback: 0, interested: 0, login: 0, notEligible: 0, notInterested: 0, disbursed: 0, duration: 0 }
  
  sortedStats.forEach(s => {
    total.count += s.count
    total.nr += s.nr
    total.callback += s.callback
    total.interested += s.interested
    total.login += s.login
    total.notEligible += s.notEligible
    total.notInterested += s.notInterested
    total.disbursed += s.disbursedCount
    total.duration += s.duration
  })

  const rowsHTML = sortedStats.map((s, index) => {
    const totalUsers = sortedStats.length
    
    let countStyle = 'padding: 8px; font-weight: bold;'
    if (s.count === 0) countStyle += 'background-color: #fee2e2; color: #991b1b;' 
    else if (index < totalUsers / 3) countStyle += 'background-color: #dcfce7; color: #166534;' 
    else if (index < (totalUsers * 2) / 3) countStyle += 'background-color: #ffedd5; color: #9a3412;' 
    else countStyle += 'background-color: #fee2e2; color: #991b1b;' 

    return `
    <tr style="border-bottom: 1px solid #eee; text-align: center; color: #333;">
      <td style="padding: 8px; text-align: left; font-weight: 500;">${s.user.full_name}</td>
      <td style="${countStyle}">${s.count}</td>
      <td style="padding: 8px;">${s.nr}</td>
      <td style="padding: 8px;">${s.callback}</td>
      <td style="padding: 8px;">${s.interested}</td>
      <td style="padding: 8px;">${s.login}</td>
      <td style="padding: 8px;">${s.notEligible}</td>
      <td style="padding: 8px;">${s.notInterested}</td>
      <td style="padding: 8px;">${s.disbursedCount}</td>
      <td style="padding: 8px;">${(s.duration / 60).toFixed(1)} m</td>
    </tr>`
  }).join('')

  return `
      <div style="font-family: Arial, sans-serif; font-size: 12px; color: #333; overflow-x: auto;">
        <h2 style="color: #1e3a8a;">Global Daily Report (${dateStr})</h2>
        <p>Sorted by call volume (High to Low).</p>
        
        <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
          <thead>
            <tr style="background-color: #1e3a8a; color: white; text-align: center;">
              <th style="padding: 10px; text-align: left;">User</th>
              <th style="padding: 10px;">Count</th>
              <th style="padding: 10px;">NR/RNR</th>
              <th style="padding: 10px;">Callback</th>
              <th style="padding: 10px;">Inter.</th>
              <th style="padding: 10px;">Logged</th>
              <th style="padding: 10px;">Not Elg.</th>
              <th style="padding: 10px;">Not Int.</th>
              <th style="padding: 10px;">Disb.</th>
              <th style="padding: 10px;">Dur.</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #e0f2fe; font-weight: bold; text-align: center; border-bottom: 2px solid #1e40af;">
              <td style="padding: 10px; text-align: left;">All (Total)</td>
              <td style="padding: 10px;">${total.count}</td>
              <td style="padding: 10px;">${total.nr}</td>
              <td style="padding: 10px;">${total.callback}</td>
              <td style="padding: 10px;">${total.interested}</td>
              <td style="padding: 10px;">${total.login}</td>
              <td style="padding: 10px;">${total.notEligible}</td>
              <td style="padding: 10px;">${total.notInterested}</td>
              <td style="padding: 10px;">${total.disbursed}</td>
              <td style="padding: 10px;">${(total.duration / 60).toFixed(1)} m</td>
            </tr>
            ${rowsHTML}
          </tbody>
        </table>
        
        <div style="margin-top: 15px; font-size: 11px;">
           <span style="display:inline-block; width: 10px; height: 10px; background: #dcfce7; border: 1px solid #166534; margin-right: 5px;"></span> High
           <span style="display:inline-block; width: 10px; height: 10px; background: #ffedd5; border: 1px solid #9a3412; margin-right: 5px; margin-left: 10px;"></span> Medium
           <span style="display:inline-block; width: 10px; height: 10px; background: #fee2e2; border: 1px solid #991b1b; margin-right: 5px; margin-left: 10px;"></span> Low
        </div>
      </div>
  `
}
