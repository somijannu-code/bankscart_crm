"use client"

import { useState, useEffect } from "react"
import { Loader2, Zap } from "lucide-react" // Replaced simple text with an Icon

interface SplashScreenProps {
  onComplete: () => void
  minDuration?: number
}

export function SplashScreen({ onComplete, minDuration = 2000 }: SplashScreenProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
      onComplete()
    }, minDuration)

    return () => clearTimeout(timer)
  }, [onComplete, minDuration])

  if (!isLoading) return null

  return (
    // CHANGE BACKGROUND COLOR HERE (bg-slate-900 or from-blue-600)
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
        
        {/* --- APP LOGO SECTION --- */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          {/* Outer Ring Animation */}
          <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-white rounded-full shadow-2xl flex items-center justify-center">
             {/* REPLACE THIS ICON WITH YOUR <img src="/logo.png" /> */}
             <Zap className="h-12 w-12 text-blue-600 fill-blue-600" />
          </div>
        </div>

        {/* --- APP NAME & TAGLINE --- */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Bankscart <span className="text-blue-400">CRM</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
            Empowering Sales
          </p>
        </div>

        {/* --- LOADING SPINNER --- */}
        <div className="flex flex-col items-center justify-center gap-3 pt-8">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="text-slate-500 text-xs">Initializing Secure Environment...</span>
        </div>

      </div>
      
      {/* Footer Version */}
      <div className="absolute bottom-8 text-slate-600 text-xs">v2.0.0 (Pro)</div>
    </div>
  )
}
