import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// CONSTANTS (Targets)
const TARGET_DAILY_CALLS = 350
const TARGET_DAILY_LOGINS = 3

export async function GET(request: Request) {
  try {
    // 1. SECURITY CHECK
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')
    const secret = process.env.CRON_SECRET

    if ((authHeader !== `Bearer ${secret}`) && (queryKey !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("⏳ Starting Advanced Daily Report Job...")

    // 2. TIME CALCULATIONS
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const dateStr = yesterday.toISOString().split('T')[0]
    const startOfYesterday = `${dateStr}T00:00:00.000Z`
    const endOfYesterday = `${dateStr}T23:59:59.999Z`

    // For Streak Calculation (Last 3 Days)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const startOfStreakCheck = threeDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000Z'

    // Monthly Calculations
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString()
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, totalDaysInMonth - today.getDate())

    let emailsSent = 0

    // ====================================================
    // PART A: FETCH & PROCESS DATA
    // ====================================================

    // 1. Get ALL Active Telecallers
    const { data: telecallers } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, monthly_target')
      .eq('role', 'telecaller')
      .eq('is_active', true)

    if (!telecallers || telecallers.length === 0) {
      return NextResponse.json({ message: "No telecallers found" })
    }

    // Group by Tenant
    const telecallersByTenant: Record<string, any[]> = {}
    telecallers.forEach(t => {
      if (!telecallersByTenant[t.tenant_id]) telecallersByTenant[t.tenant_id] = []
      telecallersByTenant[t.tenant_id].push(t)
    })

    // Process Each Tenant
    for (const tenantId of Object.keys(telecallersByTenant)) {
      const staff = telecallersByTenant[tenantId]
      const staffIds = staff.map(s => s.id)

      // 2. Fetch Call Stats (Last 3 Days for Streak Analysis)
      const { data: recentCalls } = await supabase
        .from('call_logs')
        .select('user_id, duration_seconds, call_status, created_at')
        .in('user_id', staffIds)
        .gte('created_at', startOfStreakCheck)
        .lte('created_at', endOfYesterday)

      // 3. Fetch Monthly Leads (For Revenue Target)
      const { data: leads } = await supabase
        .from('leads')
        .select('assigned_to, status, disbursed_amount, loan_amount, updated_at')
        .in('assigned_to', staffIds)
        .gte('updated_at', startOfMonth)
        .lte('updated_at', endOfMonth)

      // 4. Build Leaderboard & Stats
      const leaderboard = staff.map(user => {
        // Filter calls for this user
        const userCalls = recentCalls?.filter(c => c.user_id === user.id) || []
        
        // A. Daily Stats (Yesterday)
        const yesterdayCalls = userCalls.filter(c => c.created_at >= startOfYesterday && c.created_at <= endOfYesterday)
        const dailyCount = yesterdayCalls.length
        
        // B. Logins (Yesterday)
        // Check "Login" status in leads updated yesterday
        // Note: We need to fetch yesterday's lead updates separately or filter from the monthly batch
        const yesterdayLeads = leads?.filter(l => 
          l.assigned_to === user.id && 
          l.updated_at >= startOfYesterday && 
          l.updated_at <= endOfYesterday &&
          l.status === 'Login'
        ) || []
        const dailyLogins = yesterdayLeads.length

        // C. Streak Logic (Check counts for Day -1, Day -2, Day -3)
        let streakCount = 0
        for (let i = 1; i <= 3; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dStr = d.toISOString().split('T')[0]
          const callsOnDay = userCalls.filter(c => c.created_at.startsWith(dStr)).length
          if (callsOnDay >= TARGET_DAILY_CALLS) streakCount++
          else break // Streak broken
        }

        // D. Golden Hour Analysis
        const hourMap: Record<number, number> = {}
        yesterdayCalls.forEach(c => {
          if (c.call_status === 'connected' || c.duration_seconds > 0) {
            const hour = new Date(c.created_at).getUTCHours() // Adjust for timezone if needed
            // Ideally convert UTC to IST (UTC+5.5) roughly
            const istHour = (hour + 5) % 24 // Simplified IST conversion
            hourMap[istHour] = (hourMap[istHour] || 0) + 1
          }
        })
        const goldenHour = Object.keys(hourMap).reduce((a, b) => hourMap[Number(a)] > hourMap[Number(b)] ? a : b, "N/A")

        // E. Revenue Progress
        const userWins = leads?.filter(l => l.assigned_to === user.id && l.status === 'Disbursed') || []
        const achievedAmount = userWins.reduce((sum, l) => sum + (l.disbursed_amount || l.loan_amount || 0), 0)

        return {
          ...user,
          dailyCount,
          dailyLogins,
          achievedAmount,
          streakCount,
          goldenHour: goldenHour !== "N/A" ? `${goldenHour}:00 - ${Number(goldenHour)+1}:00` : "No Data",
          gap: Math.max(0, (user.monthly_target || 0) - achievedAmount)
        }
      })

      // Sort Leaderboard
      leaderboard.sort((a, b) => b.achievedAmount - a.achievedAmount)
      const topPerformer = leaderboard[0]

      // 5. Send Emails
      for (const user of leaderboard) {
        const rank = leaderboard.findIndex(u => u.id === user.id) + 1
        
        await sendCoachingEmail({
          recipient: user,
          stats: user,
          rank,
          totalStaff: leaderboard.length,
          daysRemaining,
          topPerformer,
          dateStr,
          targets: { calls: TARGET_DAILY_CALLS, logins: TARGET_DAILY_LOGINS }
        })
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
// HELPER: COACHING EMAIL GENERATOR
// ====================================================
async function sendCoachingEmail({ 
  recipient, stats, rank, totalStaff, daysRemaining, topPerformer, dateStr, targets 
}: any) {
  
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

  // 1. RANK & STREAK BADGES
  let rankColor = '#ef4444' // Red
  let rankMsg = "Let's push harder!"
  if (rank === 1) { rankColor = '#22c55e'; rankMsg = "You are the CHAMPION! 🏆"; }
  else if (rank <= totalStaff / 3) { rankColor = '#22c55e'; rankMsg = "Top Tier Performance!"; }
  else if (rank <= (totalStaff * 2) / 3) { rankColor = '#f97316'; rankMsg = "You're doing okay, keep pushing."; }

  const streakBadge = stats.streakCount >= 3 
    ? `<div style="background: #fef08a; color: #854d0e; padding: 5px 10px; border-radius: 15px; font-size: 12px; display: inline-block; font-weight: bold; margin-bottom: 10px;">🔥 ${stats.streakCount} Day Streak!</div>` 
    : ''

  // 2. COACHING ANALYSIS (The "AI" Coach)
  let coachingAdvice = ''
  
  // A. CALL VOLUME CHECK
  if (stats.dailyCount < targets.calls) {
    coachingAdvice += `
      <div style="border-left: 4px solid #ef4444; background: #fef2f2; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #991b1b;">⚠️ Volume Alert:</strong> 
        You made <strong>${stats.dailyCount}</strong> calls yesterday. The target is <strong>${targets.calls}</strong>. 
        High volume is the first step to success.
      </div>`
  } 
  // B. CONVERSION CHECK (High Volume / Low Login)
  else if (stats.dailyCount >= targets.calls && stats.dailyLogins < targets.logins) {
    coachingAdvice += `
      <div style="border-left: 4px solid #f97316; background: #fff7ed; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #9a3412;">⚠️ Quality Check:</strong> 
        Great hustle on calls (${stats.dailyCount}), but you only got <strong>${stats.dailyLogins}</strong> logins (Target: ${targets.logins}). 
        Focus on your pitch script today.
      </div>`
  }
  // C. GOOD JOB
  else {
    coachingAdvice += `
      <div style="border-left: 4px solid #22c55e; background: #f0fdf4; padding: 10px; margin-bottom: 10px;">
        <strong style="color: #166534;">✅ Excellent Work:</strong> 
        You hit both Call and Login targets! Keep this momentum going.
      </div>`
  }

  // D. GOLDEN HOUR
  if (stats.goldenHour !== "No Data") {
    coachingAdvice += `
      <div style="background: #f0f9ff; padding: 10px; border-radius: 5px; font-size: 13px; color: #0369a1; margin-top: 5px;">
        💡 <strong>Golden Hour:</strong> Your calls connected best between <strong>${stats.goldenHour}</strong> yesterday. Try to maximize dialing during this time today!
      </div>`
  }

  // 3. TARGET RUN RATE
  const dailyRequired = stats.gap / daysRemaining

  await resend.emails.send({
    from: 'Bankscart CRM <reports@crm.bankscart.com>',
    to: recipient.email,
    subject: `🎯 Performance Coach - ${dateStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 8px;">
        
        <div style="text-align: center; background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Daily Performance Coach</h2>
          <p style="margin: 5px 0 0; opacity: 0.8;">${dateStr}</p>
        </div>

        <div style="padding: 20px;">
          
          <div style="text-align: center; margin-bottom: 20px;">
            ${streakBadge}
            <h1 style="margin: 0; font-size: 42px; color: ${rankColor};">#${rank}</h1>
            <p style="margin: 0; font-weight: bold; color: ${rankColor};">${rankMsg}</p>
            <p style="font-size: 12px; color: #999;">Center Rank (Revenue)</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 11px; color: #666; margin: 0;">Calls (Target: ${targets.calls})</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${stats.dailyCount >= targets.calls ? '#22c55e' : '#ef4444'}">
                ${stats.dailyCount}
              </p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <p style="font-size: 11px; color: #666; margin: 0;">Logins (Target: ${targets.logins})</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${stats.dailyLogins >= targets.logins ? '#22c55e' : '#ef4444'}">
                ${stats.dailyLogins}
              </p>
            </div>
          </div>

          <h3 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 10px;">🛡️ Coach's Analysis</h3>
          ${coachingAdvice}

          <div style="margin-top: 30px;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 10px;">💰 Revenue Target</h3>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
              <span>Achieved: ${formatCurrency(stats.achievedAmount)}</span>
              <span>Target: ${formatCurrency(stats.monthly_target)}</span>
            </div>
            <div style="width: 100%; background: #e2e8f0; height: 12px; border-radius: 6px; overflow: hidden;">
              <div style="width: ${Math.min(100, (stats.achievedAmount / stats.monthly_target) * 100)}%; background: #2563eb; height: 100%;"></div>
            </div>
            
            <div style="background: #eff6ff; padding: 10px; margin-top: 10px; border-radius: 5px; font-size: 13px; color: #1e40af;">
               To hit your target, you need <strong>${formatCurrency(dailyRequired)}</strong> in disbursement <strong>every day</strong> for the remaining ${daysRemaining} days.
            </div>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
            <p>Top Performer Today: <strong>${topPerformer.full_name}</strong> (${formatCurrency(topPerformer.achievedAmount)})</p>
            Keep pushing! 🚀
          </div>

        </div>
      </div>
    `
  })
}
