"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trophy, Sparkles } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence } from "framer-motion" // Assuming you use framer-motion, or we can use standard CSS

// Helper for currency formatting
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

export function DailyWelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [topPerformer, setTopPerformer] = useState<{ name: string; amount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [prediction, setPrediction] = useState("")
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const checkAndInit = async () => {
      // 1. Check LocalStorage
      const today = new Date().toISOString().split('T')[0]
      const seenKey = `seen_welcome_${today}`
      const hasSeen = localStorage.getItem(seenKey)

      if (hasSeen) {
        setLoading(false)
        return
      }

      // 2. Fetch Top Performer using the Secure RPC Function
      // This bypasses RLS so every telecaller can see who the winner is
      const { data, error } = await supabase.rpc('get_top_performer')

      if (data) {
        setTopPerformer(data) // { name: "Name", amount: 10000 }
      } else {
        // Fallback if no sales yet this month
        setTopPerformer({ name: "No one yet", amount: 0 })
      }

      // 3. Open Modal
      setIsOpen(true)
      setLoading(false)
    }

    checkAndInit()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prediction.trim()) return

    // Save to LocalStorage so it doesn't show again today
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(`seen_welcome_${today}`, 'true')

    toast({
      title: "Goal Set! 🚀",
      description: `Let's make ${prediction} the next champion!`,
      duration: 3000,
    })

    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}> 
      {/* onOpenChange empty prevents closing by clicking outside */}
      <DialogContent className="sm:max-w-md text-center bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-100 shadow-2xl">
        
        {/* Floating Flowers Animation Background (CSS-based) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
           {Array.from({ length: 15 }).map((_, i) => (
             <span key={i} className="absolute animate-fall" style={{
               left: `${Math.random() * 100}%`,
               animationDuration: `${Math.random() * 3 + 4}s`,
               animationDelay: `${Math.random() * 2}s`,
               fontSize: `${Math.random() * 10 + 20}px`
             }}>
               {['🌸', '🌺', '🌻', '🌹', '🌷'][Math.floor(Math.random() * 5)]}
             </span>
           ))}
        </div>

        <div className="relative z-10 py-6">
          <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
             <Trophy className="h-10 w-10 text-yellow-600 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold text-indigo-900 mb-1">Top Performer of the Month</h2>
          <p className="text-sm text-indigo-600 mb-6 font-medium">Leading the charts with excellence!</p>

          {topPerformer ? (
             <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-50 mb-6 mx-4">
                <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                  {topPerformer.name}
                </h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                   <Sparkles className="h-4 w-4 text-yellow-500" />
                   <span className="text-xl font-bold text-gray-700">{formatCurrency(topPerformer.amount)}</span>
                   <Sparkles className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-xs text-gray-400 mt-2">Disbursed Amount</p>
             </div>
          ) : (
             <div className="mb-6 py-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Calculating the champion...</p>
             </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 px-4">
             <div className="text-left">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                   Who will be the next Top Performer?
                </label>
                <Input 
                   placeholder="Enter your name (or a colleague)" 
                   className="text-center text-lg font-medium border-indigo-200 focus-visible:ring-indigo-500"
                   value={prediction}
                   onChange={(e) => setPrediction(e.target.value)}
                   autoFocus
                   required
                />
             </div>
             <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                Let's Go! 🚀
             </Button>
          </form>
        </div>
        
        {/* CSS for falling animation */}
        <style jsx global>{`
          @keyframes fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(400px) rotate(360deg); opacity: 0; }
          }
          .animate-fall {
            animation-name: fall;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            position: absolute;
            top: -20px;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
