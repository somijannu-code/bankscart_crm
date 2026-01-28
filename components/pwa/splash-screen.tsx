"use client"

import { useState, useEffect } from "react"
// Using a relevant icon for "Bankscart" instead of just text
import { TrendingUp, ShieldCheck } from "lucide-react" 

interface SplashScreenProps {
  onComplete: () => void
  minDuration?: number
}

export function SplashScreen({ onComplete, minDuration = 2500 }: SplashScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Start exit animation slightly before completion
    const exitTimer = setTimeout(() => setIsExiting(true), minDuration - 500)
    
    const completeTimer = setTimeout(() => {
      setIsLoading(false)
      onComplete()
    }, minDuration)

    return () => {
        clearTimeout(exitTimer)
        clearTimeout(completeTimer)
    }
  }, [onComplete, minDuration])

  if (!isLoading) return null

  return (
    // Base container with deep gradient background
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#0a0e17] transition-opacity duration-700 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
    >
       {/* --- Ambient Background Effects (The "Unique" Part) --- */}
       {/* These create slow-moving glowing orbs in the background */}
       <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow mix-blend-screen pointer-events-none" />
       <div className="absolute bottom-[-20%] right-[-20%] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse-slower mix-blend-screen pointer-events-none" />


      {/* --- Main Content Card (Glassmorphism) --- */}
      <div className="relative z-10 flex flex-col items-center justify-center p-12 rounded-3xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-2xl text-center space-y-8 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-700">
        
        {/* 1. Animated Logo Section */}
        <div className="relative flex items-center justify-center">
            {/* Outer glowing ring animation */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 blur-md opacity-60 animate-spin-slow"></div>
            
            {/* The actual logo container */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 p-1">
               <div className="bg-[#0a0e17] w-full h-full rounded-full flex items-center justify-center">
                    {/* Replacing the "BC" text with a relevant financial icon */}
                    <TrendingUp className="h-10 w-10 text-blue-400" />
               </div>
            </div>
        </div>


        {/* 2. Typography Section with staggered animation */}
        <div className="space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300 fill-mode-both">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 tracking-tight">
            Bankscart CRM
          </h1>
          <p className="text-blue-200/70 text-sm font-medium uppercase tracking-widest">
            Elite Lead Management
          </p>
        </div>


        {/* 3. Custom Loading Indicator */}
        <div className="w-full max-w-[200px] space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-both">
          {/* A sleek progress bar instead of a spinner */}
          <div className="h-1.5 w-full bg-blue-900/50 rounded-full overflow-hidden relative">
             <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-indigo-500 w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
          </div>
          <p className="text-xs text-blue-300/60">Initializing secure workspace...</p>
        </div>

      </div>
      
       {/* Footer Version */}
       <div className="absolute bottom-8 text-blue-500/40 text-xs font-mono z-20">
         v1.0.0 Secure Build
       </div>
    </div>
  )
}
