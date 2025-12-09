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
    // 1. SECURITY CHECK
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')
    const secret = process.env.CRON_SECRET

    if ((authHeader !== `Bearer ${secret}`) && (queryKey !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("⏳ Starting Daily Report Job...")

    // 2. TIME CALCULATIONS
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Yesterday (For Daily Stats)
    const dateStr = yesterday.toISOString().split('T')[0]
    const startOfYesterday = `${dateStr}T00:00:00.000Z`
    const endOfYesterday = `${dateStr}T23:59:59.999Z`

    // Current Month (For Monthly Targets)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString()
    
    // Days Calculation
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const currentDay = today.getDate()
    const daysRemaining = Math.max(1, totalDaysInMonth - currentDay) // Avoid divide by zero

    let emailsSent = 0

    // ====================================================
    // PART A: FETCH DATA GROUPED BY TENANT
    // (Optimization: Fetch all data per tenant, then process)
    // ====================================================

    // Get all Tenant IDs
    const { data: tenants } = await supabase.from('tenants').select('id')
    // If you don't have a tenants table, query distinct tenant_ids from users
    // For now, let's just query users directly and group in memory.

    // 1. Get ALL Active Telecallers
    const { data: telecallers } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, monthly_target')
      .eq('role', 'telecaller')
      .eq('is_active', true)

    if (!telecallers || telecallers.length === 0) {
      return NextResponse.json({ message: "No telecallers found" })
    }

    // 2. Group Telecallers by Tenant (To create isolated leaderboards)
    const telecallersByTenant: Record<string, any[]> = {}
    telecallers.forEach(t => {
      if (!telecallersByTenant[t.tenant_id]) telecallersByTenant[t.tenant_id] = []
      telecallersByTenant[t.tenant_id].push(t)
    })

    // ====================================================
    // PART B: PROCESS EACH TENANT
    // ====================================================
    
    for (const tenantId of Object.keys(telecallersByTenant)) {
      const staff = telecallersByTenant[tenantId]
      const staffIds = staff.map(s => s.id)

      // 3. Fetch Yesterday's Call Stats (Activity)
      const { data: calls } = await supabase
        .from('call_logs')
        .select('user_id, duration_seconds')
        .in('user_id', staffIds)
        .gte('created_at', startOfYesterday)
        .lte('created_at', endOfYesterday)

      // 4. Fetch Month-to-Date Disbursed Leads (Target Progress)
      // Note: Assuming 'Disbursed' is the status and 'disbursed_amount' is the value
      const { data: leads } = await supabase
        .from('leads')
        .select('assigned_to, status, disbursed_amount, loan_amount')
        .in('assigned_to', staffIds)
        .gte('updated_at', startOfMonth) // Progress for whole month
        .lte('updated_at', endOfMonth)
        .eq('status', 'Disbursed') // Only count wins

      // 5. Aggregate Data
      const leaderboard = staff.map(user => {
        // Daily Activity
        const userCalls = calls?.filter(c => c.user_id === user.id) || []
        const dailyCount = userCalls.length
        
        // Monthly Progress
        const userWins = leads?.filter(l => l.assigned_to === user.id) || []
        const achievedAmount = userWins.reduce((sum, l) => sum + (l.disbursed_amount || l.loan_amount || 0), 0)
        
        return {
          ...user,
          dailyCount,
          achievedAmount,
          gap: Math.max(0, (user.monthly_target || 0) - achievedAmount)
        }
      })

      // 6. Sort Leaderboard (By Revenue Achieved)
      leaderboard.sort((a, b) => b.achievedAmount - a.achievedAmount)

      // Get Top Performer Stats
      const topPerformer = leaderboard[0]

      // ====================================================
      // PART C: SEND PERSONALIZED EMAILS
      // ====================================================
      
      for (const user of leaderboard) {
        // Calculate Rank
        const rank = leaderboard.findIndex(u => u.id === user.id) + 1
        
        // Calculate Coaching Metrics
        const dailyRequired = user.gap / daysRemaining
        const topPerformerDiff = Math.max(0, topPerformer.achievedAmount - user.achievedAmount)
        const dailyToBeatTop = topPerformerDiff / daysRemaining

        await sendCoachingEmail({
          recipient: user,
          stats: user,
          rank,
          totalStaff: leaderboard.length,
          daysRemaining,
          dailyRequired,
          topPerformer,
          dateStr
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
// HELPER: EMAIL GENERATOR
// ====================================================
async function sendCoachingEmail({ 
  recipient, stats, rank, totalStaff, daysRemaining, dailyRequired, topPerformer, dateStr 
}: any) {
  
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

  // Determine Color based on Rank
  let rankColor = '#ef4444' // Red
  let rankMsg = "Let's push harder!"
  if (rank === 1) { rankColor = '#22c55e'; rankMsg = "You are the CHAMPION! 🏆"; }
  else if (rank <= totalStaff / 3) { rankColor = '#22c55e'; rankMsg = "Great work, you're in the top tier!"; }
  else if (rank <= (totalStaff * 2) / 3) { rankColor = '#f97316'; rankMsg = "Keep going, you can climb higher."; }

  // Actionable Advice
  let adviceHTML = ''
  if (stats.gap <= 0) {
    adviceHTML = `
      <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #22c55e;">
        <h3 style="margin: 0; color: #166534;">🎉 TARGET ACHIEVED!</h3>
        <p style="margin: 5px 0 0;">You have crossed your monthly target. Everything now is a bonus!</p>
      </div>`
  } else {
    adviceHTML = `
      <div style="background: #fff7ed; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #f97316;">
        <h3 style="margin: 0; color: #9a3412;">🚀 How to hit your target:</h3>
        <p style="margin: 5px 0;">You need <strong>${formatCurrency(dailyRequired)}</strong> disbursement <strong>every day</strong> for the next ${daysRemaining} days.</p>
      </div>`
  }

  // Comparison HTML
  let comparisonHTML = ''
  if (rank > 1) {
     comparisonHTML = `
       <p style="margin-top: 15px; font-size: 13px; color: #666;">
         💡 <strong>Tip:</strong> The top performer (${topPerformer.full_name}) is at ${formatCurrency(topPerformer.achievedAmount)}. 
         You need ${formatCurrency(dailyRequired + (topPerformer.achievedAmount - stats.achievedAmount)/daysRemaining)} daily to catch them!
       </p>
     `
  }

  await resend.emails.send({
    from: 'Bankscart CRM <onboarding@resend.dev>',
    to: recipient.email,
    subject: `🎯 Your Performance Report - ${dateStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff;">
        
        <div style="text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin-bottom: 5px;">Daily Performance Coach</h2>
          <p style="color: #666; font-size: 14px; margin: 0;">${dateStr}</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
          <div style="text-align: center; width: 48%; background: #f8fafc; padding: 15px; border-radius: 8px;">
            <p style="font-size: 12px; color: #666; margin: 0;">Yesterday's Calls</p>
            <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #1e3a8a;">${stats.dailyCount}</p>
          </div>
          <div style="text-align: center; width: 48%; background: #f8fafc; padding: 15px; border-radius: 8px;">
            <p style="font-size: 12px; color: #666; margin: 0;">Month Achievement</p>
            <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #1e3a8a;">${formatCurrency(stats.achievedAmount)}</p>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center; padding: 20px; background: ${rankColor}15; border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: #666;">Your Center Ranking</p>
          <h1 style="margin: 5px 0; font-size: 36px; color: ${rankColor};">#${rank} <span style="font-size: 16px; color: #666;">/ ${totalStaff}</span></h1>
          <p style="margin: 0; font-weight: bold; color: ${rankColor};">${rankMsg}</p>
        </div>

        ${adviceHTML}
        ${comparisonHTML}

        <div style="margin-top: 25px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
            <span>₹0</span>
            <span>Target: ${formatCurrency(stats.monthly_target)}</span>
          </div>
          <div style="width: 100%; background: #e2e8f0; height: 10px; border-radius: 5px; overflow: hidden;">
            <div style="width: ${Math.min(100, (stats.achievedAmount / stats.monthly_target) * 100)}%; background: #2563eb; height: 100%;"></div>
          </div>
          <p style="text-align: right; font-size: 11px; color: #666; margin-top: 5px;">
            ${((stats.achievedAmount / stats.monthly_target) * 100).toFixed(1)}% Completed
          </p>
        </div>

        <p style="margin-top: 30px; font-size: 11px; text-align: center; color: #999;">
          Targets are based on the monthly goal set by your admin. <br/>
          Keep pushing! 🚀
        </p>
      </div>
    `
  })
}
