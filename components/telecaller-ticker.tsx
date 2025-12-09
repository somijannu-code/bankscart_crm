"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { TrendingUp, Award } from "lucide-react"

export function TelecallerTicker() {
  const [message, setMessage] = useState("Loading targets...")
  const [isTargetAchieved, setIsTargetAchieved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Get User Details (Name & Monthly Target)
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, monthly_target')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const target = userData.monthly_target || 2000000 // Default 20L if not set
      const name = userData.full_name?.split(' ')[0] || "Telecaller" // First name

      // 2. Calculate Achievement for THIS Month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const { data: leads } = await supabase
        .from('leads')
        .select('disbursed_amount, loan_amount')
        .eq('assigned_to', user.id)
        .eq('status', 'DISBURSED') // Ensure status matches your DB text exactly
        .gte('updated_at', startOfMonth)
        .lte('updated_at', endOfMonth)

      const achieved = leads?.reduce((sum, lead) => sum + (lead.disbursed_amount || lead.loan_amount || 0), 0) || 0
      const pending = target - achieved

      // 3. Set Message
      if (pending <= 0) {
        setIsTargetAchieved(true)
        setMessage(`Hey ${name}, Congratulations! 🎉 You have smashed your monthly target! Keep soaring high! 🚀`)
      } else {
        setIsTargetAchieved(false)
        const formattedPending = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(pending)
        
        setMessage(`Hey ${name}, Greetings from Bankscart! 🎯 You have a Pending Disbursement of ${formattedPending} to hit your target. Push harder, you can do it!`)
      }
    }

    fetchData()
  }, [])

  return (
    <div className={`w-full overflow-hidden whitespace-nowrap py-2 ${isTargetAchieved ? 'bg-green-600' : 'bg-blue-600'}`}>
      <div className="inline-block animate-marquee">
        <div className="flex items-center gap-4 text-white font-semibold text-sm md:text-base">
          {/* We repeat the message twice to create a smooth infinite loop effect if needed, 
              but for a simple marquee, one block with animation is sufficient */}
          <span className="flex items-center gap-2">
            {isTargetAchieved ? <Award className="h-4 w-4 text-yellow-300" /> : <TrendingUp className="h-4 w-4 text-yellow-300" />}
            {message}
          </span>
          {/* Duplicate for spacing in the loop */}
          <span className="mx-8 text-blue-300">|</span> 
          <span className="flex items-center gap-2 opacity-90">
             {message}
          </span>
          <span className="mx-8 text-blue-300">|</span> 
          <span className="flex items-center gap-2 opacity-80">
             {message}
          </span>
        </div>
      </div>
      
      {/* CSS Animation embedded directly for simplicity */}
      <style jsx>{`
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(100%); } /* Starts from right */
          100% { transform: translateX(-100%); } /* Exits to left */
        }
      `}</style>
    </div>
  )
}
