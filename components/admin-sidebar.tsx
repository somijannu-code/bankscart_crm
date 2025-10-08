"use client"

import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { LayoutDashboard, Users, UserPlus, FileSpreadsheet, BarChart3, Settings, MessageCircle, Calendar, FileText } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

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
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-900">Bankscart CRM</h1>
        <p className="text-sm text-gray-600 mt-1">Admin Panel</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn("w-full justify-start gap-3", isActive && "bg-blue-600 text-white hover:bg-blue-700")}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <LogoutButton />
      </div>
    </div>
  )
}
