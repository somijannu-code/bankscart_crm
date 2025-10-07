"use client"

import { useState } from 'react'
import { LayoutDashboard, Users, UserPlus, FileSpreadsheet, BarChart3, Settings, MessageCircle, Calendar, FileText, ChevronLeft, LogOut } from "lucide-react"

// --- Local Utility and Mock Components to ensure file is self-contained ---

/**
 * Local implementation of 'cn' (classNames utility)
 * @param {...string} classes - Class strings to conditionally join.
 */
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Mock implementation of 'next/navigation' usePathname
 * Hardcoded to '/admin' to simulate the active route for styling purposes.
 */
const usePathname = () => "/admin";

/**
 * Mock implementation of 'next/link'
 * Replaced with simple anchor tags or divs, preventing Next.js specific errors.
 */
const Link = ({ children, href, title }) => (
  // Use a simple div or anchor tag as a placeholder for navigation
  <div onClick={(e) => console.log(`Navigating to ${href}`)} title={title} className="cursor-pointer">
    {children}
  </div>
);

/**
 * Mock implementation of the generic Button component (based on shadcn/ui)
 */
const Button = ({ children, className, variant, ...props }) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ring-offset-background h-10";

    const variantClasses = {
        default: "bg-blue-600 text-white hover:bg-blue-700",
        ghost: "hover:bg-gray-100 hover:text-gray-900",
    };

    return (
        <button
            className={cn(baseClasses, variantClasses[variant] || variantClasses.default, className)}
            {...props}
        >
            {children}
        </button>
    );
};

/**
 * Self-contained Mock LogoutButton
 * Handles the logic for showing text/icon based on collapse state.
 */
const LogoutButton = ({ isCollapsed }) => (
    <Button
        variant="ghost"
        className={cn(
            "w-full text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-300",
            isCollapsed ? "px-2 h-10 flex justify-center" : "px-4 gap-3 justify-start"
        )}
        onClick={() => console.log("Logout triggered")}
    >
        <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-1")} />
        {/* Text name is conditionally shown */}
        <span className={cn(
            "whitespace-nowrap transition-all duration-300 ease-in-out",
            isCollapsed ? "opacity-0 w-0 h-0 overflow-hidden" : "opacity-100 w-auto h-auto"
        )}>
            Logout
        </span>
    </Button>
);

// --- AdminSidebar Component ---

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
  // 1. State for managing the collapsed status
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => setIsCollapsed(!isCollapsed)

  // 2. Dynamic classes for width control
  const sidebarWidthClass = isCollapsed ? "w-[70px]" : "w-64"

  // 3. Class to hide text content smoothly
  // Note: This is used within the Link buttons to hide the name
  const textVisibilityClass = isCollapsed ? "opacity-0 w-0 h-0 overflow-hidden" : "opacity-100 w-auto h-auto"

  return (
    // Main container with dynamic width and transition
    <div className={cn(
        "bg-white shadow-xl flex flex-col h-screen transition-all duration-300 ease-in-out relative z-10 border-r",
        sidebarWidthClass
    )}>

      {/* Toggle Button - positioned absolutely on the right edge */}
      <button
        onClick={toggleCollapse}
        className={cn(
          "absolute top-6 right-[-12px] h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transition-transform duration-300 z-20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500",
          isCollapsed ? "rotate-180" : ""
        )}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Header/Logo Section */}
      <div className="p-4 border-b">
        <div className={cn("overflow-hidden transition-all duration-300", isCollapsed ? "h-6" : "h-auto")}>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {/* Show a shortened version when collapsed */}
                {isCollapsed ? "BC" : "Bankscart CRM"}
            </h1>
            <p className={cn("text-sm text-gray-600 mt-1 transition-opacity duration-150", isCollapsed ? "opacity-0 h-0" : "opacity-100 h-auto")}>
                Admin Panel
            </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          // Use hardcoded/mocked pathname for active check
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.name} href={item.href} title={item.name}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-300",
                  isCollapsed ? "px-2 h-10 flex justify-center" : "px-4 gap-3", // Adjusted spacing for collapse
                  isActive
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {/* Icon is always visible */}
                <Icon className={cn("h-5 w-5", isCollapsed && "mx-auto")} />

                {/* Text name is conditionally shown */}
                <span className={cn(
                    "whitespace-nowrap transition-all duration-300 ease-in-out",
                    textVisibilityClass
                )}>
                  {item.name}
                </span>
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer/Logout Section */}
      <div className="p-4 border-t">
        <LogoutButton isCollapsed={isCollapsed} />
      </div>
    </div>
  )
}
