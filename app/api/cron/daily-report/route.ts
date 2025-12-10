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

// Targets for Coaching
const TARGET_DAILY_CALLS = 350
const TARGET_DAILY_LOGINS = 3

// Helper: Rate Limit Delay (Prevent email spam blocks)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

    console.log("⏳ Starting Master Daily Report Job...")

    // 2. TIME CALCULATIONS
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const dateStr = yesterday.toISOString().split('T')[0]
    const startOfYesterday = `${dateStr}T00:00:00.000Z`
    const endOfYesterday = `${dateStr}T23:59:59.999Z`

    // Monthly Range (For Targets)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString()
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, totalDaysInMonth - today.getDate())

    let emailsSent = 0

    // ====================================================
    // PART 1: SEND COACHING REPORTS TO TELECALLERS
    // ====================================================
    console.log("👉 Processing Telecaller Coaching Reports...")
    
    const { data: telecallers } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, monthly_target')
      .eq('role', 'telecaller')
      .eq('is_active', true)

    if (telecallers && telecallers.length > 0) {
      // Group by Tenant for Leaderboard Logic
      const staffByTenant: Record<string, any[]> = {}
      telecallers.forEach(t => {
        if (!staffByTenant[t.tenant_id]) staffByTenant[t.tenant_id] = []
        staffByTenant[t.tenant_id].push(t)
      })

      for (const tenantId of Object.keys(staffByTenant)) {
        const staff = staffByTenant[tenantId]
        const staffIds = staff.map(s => s.id)

        // Fetch Stats
        const { data: calls } = await supabase.from('call_logs')
          .select('user_id, duration_seconds').in('user_id', staffIds)
          .gte('created_at', startOfYesterday).lte('created_at', endOfYesterday)
        
        const { data: leads } = await supabase.from('leads')
          .select('assigned_to, status, disbursed_amount, loan_amount')
          .in('assigned_to', staffIds).gte('updated_at', startOfMonth).lte('updated_at', endOfMonth)

        // Build Leaderboard
        const leaderboard = staff.map(user => {
            const userCalls = calls?.filter(c => c.user_id === user.id) || []
            const userWins = leads?.filter(l => l.assigned_to === user.id && l.status === 'Disbursed') || []
            const achievedAmount = userWins.reduce((sum, l) => sum + (l.disbursed_amount || l.loan_amount || 0), 0)
            
            return {
                ...user,
                dailyCount: userCalls.length,
                achievedAmount,
                gap: Math.max(0, (user.monthly_target || 2000000) - achievedAmount)
            }
        }).sort((a, b) => b.achievedAmount - a.achievedAmount) // Sort by Revenue

        const topPerformer = leaderboard[0]

        // Send Email to Each Telecaller
        for (const user of leaderboard) {
            const rank = leaderboard.findIndex(u => u.id === user.id) + 1
            await sendCoachingEmail({ 
                recipient: user, stats: user, rank, totalStaff: leaderboard.length, 
                daysRemaining, topPerformer, dateStr, targets: { calls: TARGET_DAILY_CALLS } 
            })
            emailsSent++
            await delay(200) // Rate limit
        }
      }
    }

    // ====================================================
    // PART 2: SEND AGGREGATED REPORTS TO MANAGERS
    // ====================================================
    console.log("👉 Processing Manager Reports...")

    // A. Team Leaders
    const { data: teamLeaders } = await supabase.from('users').select('*').eq('role', 'team_leader').eq('is_active', true)
    
    if (teamLeaders) {
        for (const tl of teamLeaders) {
            const { data: team } = await supabase.from('users').select('id, full_name').eq('manager_id', tl.id)
            if (team && team.length > 0) {
                await generateAndSendPivotReport(tl, team, startOfYesterday, endOfYesterday, dateStr, 'Team Daily Report')
                emailsSent++
                await delay(200)
            }
        }
    }

    // B. Tenant Admins
    const { data: tenantAdmins } = await supabase.from('users').select('*').eq('role', 'tenant_admin').eq('is_active', true)

    if (tenantAdmins) {
        for (const admin of tenantAdmins) {
            const { data: allStaff } = await supabase.from('users').select('id, full_name')
                .eq('tenant_id', admin.tenant_id).in('role', ['telecaller', 'team_leader'])
            
            if (allStaff && allStaff.length > 0) {
                await generateAndSendPivotReport(admin, allStaff, startOfYesterday, endOfYesterday, dateStr, 'Company Daily Report')
                emailsSent++
                await delay(200)
            }
        }
    }

    // C. Super Admins
    const { data: superAdmins } = await supabase.from('users').select('*').in('role', ['super_admin', 'owner']).eq('is_active', true)

    if (superAdmins && superAdmins.length > 0) {
        const { data: globalStaff } = await supabase.from('users').select('id, full_name').in('role', ['telecaller', 'team_leader']).eq('is_active', true)
        
        if (globalStaff && globalStaff.length > 0) {
            for (const sa of superAdmins) {
                await generateAndSendPivotReport(sa, globalStaff, startOfYesterday, endOfYesterday, dateStr, 'Global Daily Report')
                emailsSent++
                await delay(200)
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
// HELPER 1: MANAGER REPORT (PIVOT TABLE)
// ====================================================
async function generateAndSendPivotReport(recipient: any, subjects: any[], startTime: string, endTime: string, dateDisplay: string, emailSubject: string) {
    const subjectIds = subjects.map(s => s.id)

    // Fetch Call Stats
    const { data: calls } = await supabase.from('call_logs')
        .select('user_id, duration_seconds').in('user_id', subjectIds)
        .gte('created_at', startTime).lte('created_at', endTime)

    // Fetch Lead Updates
    const { data: leads } = await supabase.from('leads')
        .select('assigned_to, status').in('assigned_to', subjectIds)
        .gte('updated_at', startTime).lte('updated_at', endTime)

    // Init Stats
    const statsMap: any = {}
    subjects.forEach(s => {
        statsMap[s.id] = { name: s.full_name, count: 0, duration: 0, nr: 0, interested: 0, login: 0, disbursed: 0 }
    })

    // Fill Data
    calls?.forEach(c => {
        if(statsMap[c.user_id]) {
            statsMap[c.user_id].count++
            statsMap[c.user_id].duration += (c.duration_seconds || 0)
        }
    })

    leads?.forEach(l => {
        if(!statsMap[l.assigned_to]) return
        const s = l.status
        const u = statsMap[l.assigned_to]
        
        if(['Interested','Documents_Sent'].includes(s)) u.interested++
        else if(['Login'].includes(s)) u.login++
        else if(['Disbursed'].includes(s)) u.disbursed++
        else if(['nr','Busy','RNR'].includes(s)) u.nr++
    })

    // Sort High to Low
    const sorted = Object.values(statsMap).sort((a: any, b: any) => b.count - a.count)

    // HTML Generation
    const rows = sorted.map((stat: any) => `
        <tr style="border-bottom:1px solid #eee; text-align:center;">
            <td style="padding:8px; text-align:left;">${stat.name}</td>
            <td style="padding:8px; font-weight:bold;">${stat.count}</td>
            <td style="padding:8px;">${stat.nr}</td>
            <td style="padding:8px; color:#b91c1c;">${stat.interested}</td>
            <td style="padding:8px; color:#1e40af;">${stat.login}</td>
            <td style="padding:8px; color:#15803d; font-weight:bold;">${stat.disbursed}</td>
            <td style="padding:8px;">${(stat.duration/60).toFixed(0)}m</td>
        </tr>
    `).join('')

    await resend.emails.send({
        from: 'Bankscart CRM <onboarding@resend.dev>',
        to: recipient.email,
        subject: `📊 ${emailSubject} - ${dateDisplay}`,
        html: `
        <div style="font-family:sans-serif; color:#333;">
            <h2 style="color:#1e3a8a;">${emailSubject}</h2>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr style="background:#1e3a8a; color:white;">
                    <th style="padding:8px; text-align:left;">User</th>
                    <th>Calls</th> <th>NR</th> <th>Int.</th> <th>Login</th> <th>Disb.</th> <th>Dur.</th>
                </tr>
                ${rows}
            </table>
        </div>`
    })
}

// ====================================================
// HELPER 2: TELECALLER REPORT (COACHING)
// ====================================================
async function sendCoachingEmail({ recipient, stats, rank, daysRemaining, topPerformer, dateStr, targets }: any) {
    const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
    
    // Coaching Logic
    const dailyRequired = stats.gap / daysRemaining
    const isTargetHit = stats.dailyCount >= targets.calls
    const statusColor = isTargetHit ? '#166534' : '#991b1b' // Green or Red
    const statusMsg = isTargetHit ? "✅ Target Hit" : "⚠️ Volume Low"

    await resend.emails.send({
        from: 'Bankscart CRM <reports@crm.bankscart.com>',
        to: recipient.email,
        subject: `🎯 Performance Coach - ${dateStr}`,
        html: `
        <div style="font-family:sans-serif; color:#333; max-width:600px; margin:0 auto; border:1px solid #eee; padding:20px;">
            <div style="text-align:center;">
                <h1 style="color:#1e3a8a; margin:0;">#${rank}</h1>
                <p style="color:#666; font-size:12px;">Center Rank</p>
            </div>
            
            <div style="background:#f8fafc; padding:15px; margin:15px 0; border-radius:8px; text-align:center;">
                <p style="margin:0; font-size:12px; color:#666;">Calls Yesterday (Target: ${targets.calls})</p>
                <h2 style="margin:5px 0; color:${statusColor};">${stats.dailyCount} <span style="font-size:14px; font-weight:normal;">(${statusMsg})</span></h2>
            </div>

            <div style="background:#eff6ff; padding:15px; border-radius:8px; font-size:13px;">
                <p><strong>💰 Revenue Goal:</strong> ${formatCurrency(stats.achievedAmount)} / ${formatCurrency(stats.monthly_target)}</p>
                <p>To hit target, you need <strong>${formatCurrency(dailyRequired)}</strong> disbursement daily for ${daysRemaining} days.</p>
                <p style="margin-top:10px; font-size:11px; color:#666;">Top Performer: ${topPerformer.full_name} (${formatCurrency(topPerformer.achievedAmount)})</p>
            </div>
        </div>`
    })
}
