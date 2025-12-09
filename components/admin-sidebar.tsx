"use client"

import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { LayoutDashboard, Users, UserPlus, FileSpreadsheet, BarChart3, Settings, MessageCircle, Calendar, FileText, ChevronLeft, ChevronRight, IndianRupee, Logs } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "All Leads", href: "/admin/leads", icon: FileSpreadsheet },
  { name: "Upload Leads", href: "/admin/upload", icon: UserPlus },
  { name: "Telecallers", href: "/admin/users", icon: Users },
  { name: "Attendance", href: "/admin/attendance", icon: Calendar },
  { name: "Leave Management", href: "/admin/leave-management", icon: FileText },
  { name: "Reports", href: "/admin/reports", icon: BarChart3 },
  { name: "Team Chat", href: "/admin/chat", icon: MessageCircle },
  { name: "Settings", href: "/admin/settings", icon: Settings },
  { name: "Disbursed Data", href: "/admin/disbursement-report", icon: IndianRupee },
  { name: "Available Leads", href: "/admin/calls", icon: FileSpreadsheet },
  { name: "Activities", href: "/admin/audit-logs", icon: Logs },

]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(true)

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={cn(
      "bg-white shadow-lg flex flex-col transition-all duration-300 ease-in-out relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-white shadow-md hover:bg-gray-50 z-10"
        onClick={toggleSidebar}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Header */}
      <div className={cn(
        "p-6 border-b transition-all duration-300",
        isCollapsed && "p-4"
      )}>
        <h1 className={cn(
          "text-xl font-bold text-gray-900 transition-all duration-300",
          isCollapsed && "text-center text-lg"
        )}>
          {isCollapsed ? "BC" : "Bankscart CRM"}
        </h1>
        {!isCollapsed && (
          <p className="text-sm text-gray-600 mt-1">Admin Panel</p>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 p-4 space-y-2 transition-all duration-300",
        isCollapsed && "px-2"
      )}>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-all duration-200",
                  isActive && "bg-blue-600 text-white hover:bg-blue-700",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className={cn(
                  "transition-all duration-300",
                  isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                )}>
                  {item.name}
                </span>
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "p-4 border-t transition-all duration-300",
        isCollapsed && "px-2"
      )}>
        <LogoutButton 
          className={cn(
            "w-full justify-start gap-3",
            isCollapsed && "justify-center px-2"
          )}
          showText={!isCollapsed}
        />
      </div>
    </div>
  )
}
