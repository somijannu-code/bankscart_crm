"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { sidebarGroups } from "@/config/sidebar-nav"

// UI Components
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Icons
import { ChevronLeft, ChevronRight, Menu } from "lucide-react"

// --- SUB-COMPONENT: Nav Item (Updated with 3D Effect) ---
function SidebarItem({ item, isCollapsed, isActive }: { item: any, isCollapsed: boolean, isActive: boolean }) {
  const Icon = item.icon

  // 1. COLLAPSED VIEW (Icon Only) - 3D Icon Pop
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href} className="flex justify-center mb-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-xl transition-all duration-300 ease-out",
                // 3D Hover Effect for Icons
                "hover:scale-110 hover:shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:-translate-y-1",
                isActive 
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{item.name}</span>
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-900 text-white border-0 font-medium ml-2 shadow-xl animate-in zoom-in-50 duration-200">
          {item.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  // 2. EXPANDED VIEW (Full Row) - 3D Card Lift
  return (
    <Link href={item.href} className="block mb-2 px-1">
      <div
        className={cn(
          "group relative flex items-center w-full p-2.5 rounded-xl transition-all duration-300 ease-out cursor-pointer overflow-hidden",
          // Base State
          "border border-transparent",
          // 3D HOVER EFFECT: Lift up + Drop Shadow + Scale + Border Highlight
          "hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] hover:scale-[1.02] hover:bg-white hover:border-slate-100",
          isActive 
            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border-blue-100" 
            : "text-slate-600"
        )}
      >
        {/* Active Indicator Bar (Left side) */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-blue-600 rounded-r-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
        )}

        <Icon className={cn(
          "h-5 w-5 mr-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", // Subtle icon rotation
          isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"
        )} />
        
        <span className={cn(
          "font-medium transition-colors",
          isActive ? "text-blue-900" : "group-hover:text-slate-900"
        )}>
          {item.name}
        </span>

        {/* Subtle Shine Effect on Hover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-700 pointer-events-none" />
      </div>
    </Link>
  )
}

// --- MAIN SIDEBAR COMPONENT ---
export function AdminSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(!isCollapsed))
  }

  // Hydration guard
  if (!isMounted) return <div className="hidden md:flex w-[70px] h-screen bg-white border-r" />

  return (
    <>
      {/* 1. MOBILE SIDEBAR */}
      <div className="md:hidden p-4 fixed top-0 left-0 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-lg active:scale-95 transition-transform">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r-0">
            <SidebarContent isCollapsed={false} pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 2. DESKTOP SIDEBAR */}
      <div 
        className={cn(
          "hidden md:flex flex-col h-screen bg-slate-50/50 border-r transition-all duration-300 relative sticky top-0",
          isCollapsed ? "w-[80px]" : "w-72"
        )}
      >
        {/* 3D Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-3 top-9 h-7 w-7 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] border border-slate-200 z-30 hidden md:flex hover:scale-110 hover:shadow-md transition-all text-slate-500 hover:text-blue-600"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <SidebarContent isCollapsed={isCollapsed} pathname={pathname} />
      </div>
    </>
  )
}

// --- INTERNAL CONTENT RENDERER ---
function SidebarContent({ isCollapsed, pathname }: { isCollapsed: boolean, pathname: string }) {
  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl">
      
      {/* Branding */}
      <div className={cn("h-20 flex items-center border-b border-slate-100/80 px-5 transition-all", isCollapsed ? "justify-center" : "justify-start gap-3")}>
        <div className="relative group">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 flex-shrink-0 transition-transform duration-500 group-hover:rotate-[360deg]">
              BC
            </div>
            {/* Glow effect under logo */}
            <div className="absolute -inset-1 bg-blue-500/30 blur-lg rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
        </div>
        
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden animate-in slide-in-from-left-2 duration-300">
            <span className="font-bold text-slate-800 text-lg leading-none tracking-tight">BanksCart</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Admin Panel</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-6">
        <div className="px-4 space-y-8">
          <TooltipProvider delayDuration={0}>
            {sidebarGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {!isCollapsed && (
                  <h4 className="mb-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
                    {group.label}
                  </h4>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <SidebarItem 
                      key={item.href} 
                      item={item} 
                      isCollapsed={isCollapsed} 
                      isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href)} 
                    />
                  ))}
                </div>
                {!isCollapsed && groupIndex !== sidebarGroups.length - 1 && (
                    <div className="mt-6 mx-2 border-b border-slate-100" />
                )}
              </div>
            ))}
          </TooltipProvider>
        </div>
      </ScrollArea>

      {/* User & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-3 mb-4 p-2 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow cursor-default">
            <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
              <AvatarImage src="/placeholder-user.jpg" />
              <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 text-xs font-bold">AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-slate-800 truncate">Admin User</span>
              <span className="text-[10px] text-slate-500 truncate">admin@bankscart.com</span>
            </div>
          </div>
        )}
        
        <LogoutButton 
          variant={isCollapsed ? "ghost" : "outline"}
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "w-full transition-all duration-300 hover:shadow-md hover:border-red-100 hover:bg-red-50 hover:text-red-600",
            isCollapsed ? "justify-center rounded-xl h-10 w-10" : "justify-start gap-2 h-10 border-slate-200 rounded-lg"
          )}
          showText={!isCollapsed}
        />
      </div>
    </div>
  )
}
