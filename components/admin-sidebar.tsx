"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { sidebarGroups } from "@/config/sidebar-nav" // Import from step 1

// UI Components
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { ScrollArea } from "@/components/ui/scroll-area" // Better scrolling
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet" // For Mobile

// Icons
import { ChevronLeft, ChevronRight, Menu } from "lucide-react"

// --- SUB-COMPONENT: Nav Item ---
function SidebarItem({ item, isCollapsed, isActive }: { item: any, isCollapsed: boolean, isActive: boolean }) {
  const Icon = item.icon

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href} className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-lg",
                isActive 
                  ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{item.name}</span>
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-900 text-white border-0 font-medium ml-2">
          {item.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link href={item.href} className="block">
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 px-3 h-10 mb-1 font-normal transition-colors",
          isActive 
            ? "bg-blue-50 text-blue-700 font-medium" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <Icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
        <span className="truncate">{item.name}</span>
      </Button>
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

  // Hydration guard (render minimal structure to avoid layout shift)
  if (!isMounted) return <div className="hidden md:flex w-[70px] h-screen bg-white border-r" />

  return (
    <>
      {/* 1. MOBILE SIDEBAR (Drawer) */}
      <div className="md:hidden p-4 fixed top-0 left-0 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon"><Menu className="h-4 w-4" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent isCollapsed={false} pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 2. DESKTOP SIDEBAR */}
      <div 
        className={cn(
          "hidden md:flex flex-col h-screen bg-white border-r transition-all duration-300 relative sticky top-0",
          isCollapsed ? "w-[70px]" : "w-64"
        )}
      >
        {/* Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-3 top-8 h-6 w-6 rounded-full bg-white shadow-md border z-30 hidden md:flex"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <SidebarContent isCollapsed={isCollapsed} pathname={pathname} />
      </div>
    </>
  )
}

// --- INTERNAL CONTENT RENDERER (Reused for Mobile & Desktop) ---
function SidebarContent({ isCollapsed, pathname }: { isCollapsed: boolean, pathname: string }) {
  return (
    <div className="flex flex-col h-full">
      
      {/* Branding */}
      <div className={cn("h-16 flex items-center border-b px-4 transition-all", isCollapsed ? "justify-center" : "justify-start gap-3")}>
        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0">
          BC
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-slate-900 leading-none">BanksCart</span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Admin Panel</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-6">
          <TooltipProvider delayDuration={0}>
            {sidebarGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {!isCollapsed && (
                  <h4 className="mb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                {/* Add separator between groups if not collapsed and not the last item */}
                {!isCollapsed && groupIndex !== sidebarGroups.length - 1 && <Separator className="mt-4 opacity-50" />}
              </div>
            ))}
          </TooltipProvider>
        </div>
      </ScrollArea>

      {/* User & Logout */}
      <div className="p-3 border-t bg-slate-50/50">
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar className="h-8 w-8 border">
              <AvatarImage src="/placeholder-user.jpg" />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-900 truncate">Admin User</span>
              <span className="text-xs text-slate-500 truncate">admin@bankscart.com</span>
            </div>
          </div>
        )}
        
        <LogoutButton 
          variant={isCollapsed ? "ghost" : "outline"}
          size={isCollapsed ? "icon" : "default"}
          className={cn("w-full", isCollapsed ? "justify-center" : "justify-start gap-2 border-slate-200")}
          showText={!isCollapsed}
        />
      </div>
    </div>
  )
}
