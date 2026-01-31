"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Crown, Sparkles } from "lucide-react"

// --- CONFIGURATION FOR TOP PERFORMER ---
const TOP_PERFORMER = {
  name: "V Kalpana",
  title: "Employee of the Month", // You can change this to "Employee of the Month"
  photoUrl: "/icons/kalpana.jpeg", // Ensure image exists at public/icons/kalpana.png
}

interface SplashScreenProps {
  onComplete: () => void
  minDuration?: number
}

export function SplashScreen({ 
  onComplete, 
  minDuration = 3000 
}: SplashScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
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
    <>
      {/* Inline styles for the specific confetti animation to ensure it works without config changes */}
      <style jsx global>{`
        @keyframes confetti-burst {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(360deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-burst 1.2s ease-out forwards;
        }
      `}</style>

      <div 
        className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#0a0e17] transition-opacity duration-700 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      >
         {/* --- Ambient Background Effects --- */}
         <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse mix-blend-screen pointer-events-none" />
         <div className="absolute bottom-[-20%] right-[-20%] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse mix-blend-screen pointer-events-none" />

         {/* --- Confetti Burst --- */}
         <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center z-0">
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30) * (Math.PI / 180);
              const distance = 150; // Distance particles fly
              const tx = Math.cos(angle) * distance;
              const ty = Math.sin(angle) * distance - 50; // Slight upward bias
              return (
                <div 
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-confetti"
                  style={{
                    // @ts-ignore
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    backgroundColor: i % 2 === 0 ? '#fbbf24' : '#60a5fa', // Gold & Blue
                    animationDelay: '0.2s',
                  }}
                />
              )
            })}
         </div>

        {/* --- Main Content Card --- */}
        <div className="relative z-10 flex flex-col items-center justify-center p-10 rounded-3xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-2xl text-center space-y-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-700">
          
          {/* --- Top Performer Celebration Section --- */}
          <div className="relative flex flex-col items-center animate-in slide-in-from-top-4 duration-700 delay-100">
              
              {/* Crown Icon (Bouncing) */}
              <div className="absolute -top-10 z-20 animate-bounce">
                  <Crown className="w-10 h-10 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
              </div>

              {/* Avatar Container with Gold Glow */}
              <div className="relative w-32 h-32 rounded-full p-1 bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
                  <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#0a0e17] relative bg-slate-800">
                     {/* IMAGE: Kalpana's Photo */}
                     <img 
                       src={TOP_PERFORMER.photoUrl} 
                       alt={TOP_PERFORMER.name} 
                       className="w-full h-full object-cover"
                       onError={(e) => {
                         // Fallback if image not found
                         e.currentTarget.src = "https://ui-avatars.com/api/?name=Kalpana&background=random"; 
                       }}
                     />
                     {/* Shine overlay */}
                     <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-40"></div>
                  </div>
                  {/* Sparkle Icon */}
                  <Sparkles className="absolute -bottom-2 -right-2 text-yellow-300 w-8 h-8 animate-pulse drop-shadow-md" />
              </div>

              <div className="mt-5 space-y-1">
                  <p className="text-yellow-400/90 text-[11px] font-bold uppercase tracking-[0.2em]">
                      {TOP_PERFORMER.title}
                  </p>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
                      {TOP_PERFORMER.name}
                  </h2>
              </div>
          </div>

          {/* Typography Section */}
          <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300 fill-mode-both pt-2">
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200 tracking-tight flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" /> Bankscart CRM
            </h1>
          </div>

          {/* Custom Loading Bar */}
          <div className="w-full max-w-[180px] space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-both">
            <div className="h-1 w-full bg-blue-900/50 rounded-full overflow-hidden relative">
               <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-indigo-500 w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
            </div>
            <p className="text-[10px] text-blue-300/50 uppercase tracking-widest">Loading Dashboard...</p>
          </div>

        </div>
        
         <div className="absolute bottom-8 text-blue-500/30 text-[10px] font-mono z-20">
           v1.0.0 Secure Build
         </div>
      </div>
    </>
  )
}
