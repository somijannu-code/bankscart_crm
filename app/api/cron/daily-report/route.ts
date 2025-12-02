import { createClient } from '@supabase/supabase-js' // Use direct client for Cron
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Initialize specialized clients
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must use Service Role to see all data
)

export async function GET(request: Request) {
  // 1. Security Check (Prevent unauthorized access)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    // 2. Get Date Range (Yesterday)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // 3. Get all Team Leaders
    const { data: teamLeaders } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'team_leader')

    if (!teamLeaders) return NextResponse.json({ message: "No team leaders found" })

    // 4. Loop through each TL and generate their report
    for (const tl of teamLeaders) {
      
      // Get their team members
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('manager_id', tl.id)
      
      if (!teamMembers || teamMembers.length === 0) continue

      const teamIds = teamMembers.map(t => t.id)

      // Get Call Stats for this team for Yesterday
      const { data: calls } = await supabase
        .from('call_logs')
        .select('user_id, duration, call_status')
        .in('user_id', teamIds)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)

      // Aggregate Stats
      let totalCalls = 0
      let totalDuration = 0
      const breakdown: any = {}

      calls?.forEach(call => {
        totalCalls++
        totalDuration += (call.duration || 0)
        
        // Count per user
        if (!breakdown[call.user_id]) breakdown[call.user_id] = 0
        breakdown[call.user_id]++
      })

      // 5. Send Email via Resend
      await resend.emails.send({
        from: 'Bankscart CRM <system@your-domain.com>',
        to: tl.email,
        subject: `Daily Team Report - ${dateStr}`,
        html: `
          <h1>Daily Call Report for ${tl.full_name}</h1>
          <p><strong>Date:</strong> ${dateStr}</p>
          <hr />
          <h2>Team Summary</h2>
          <ul>
            <li><strong>Total Calls:</strong> ${totalCalls}</li>
            <li><strong>Total Duration:</strong> ${(totalDuration / 60).toFixed(1)} mins</li>
          </ul>
          <h3>Breakdown by Telecaller:</h3>
          <ul>
            ${teamMembers.map(tm => `
              <li>
                <strong>${tm.full_name}:</strong> ${breakdown[tm.id] || 0} calls
              </li>
            `).join('')}
          </ul>
        `
      })
    }

    return NextResponse.json({ success: true, processed: teamLeaders.length })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
