"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { User } from "@supabase/supabase-js"
import Link from "next/link"
import { useDebounce } from "@/hooks/use-debounce" // Ensure you have this hook or use setTimeout

// UI Components
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Icons
import { 
  Settings, LogOut, User as UserIcon, Search, Menu, ChevronRight, X 
} from "lucide-react"

import { NotificationCenter } from "@/components/notification-center"

// Route Mapping for Clean Breadcrumbs
const ROUTE_LABELS: Record<string, string> = {
  admin: "Dashboard",
  leads: "Lead Management",
  users: "Team Members",
  settings: "System Settings",
  attendance: "Attendance & Shifts",
  upload: "Data Import",
  reports: "Analytics"
}

interface TopHeaderProps {
  user?: User | null
  onMenuClick?: () => void 
}

export function TopHeader({ user: initialUser, onMenuClick }: TopHeaderProps) {
  const [user, setUser] = useState<User | null>(initialUser || null)
  const [loading, setLoading] = useState(!initialUser)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Debounce Search to prevent URL spam
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (searchValue) {
        params.set('search', searchValue)
      } else {
        params.delete('search')
      }
      // Only push if changed
      if (params.toString() !== searchParams.toString()) {
        router.replace(`${pathname}?${params.toString()}`)
      }
    }, 400) // 400ms delay

    return () => clearTimeout(timer)
  }, [searchValue, router, pathname, searchParams])

  // Initial User Load
  useEffect(() => {
    if (initialUser) return
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (e) {
        console.error("Error fetching user", e)
      } finally {
        setLoading(false)
      }
    }
    getUser()
  }, [initialUser, supabase])

  // Keyboard Shortcut (Cmd+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Breadcrumb Logic
  const breadcrumbs = pathname.split('/').filter(Boolean).map((segment, index, arr) => {
    const href = `/${arr.slice(0, index + 1).join('/')}`
    
    // Check if UUID (rough check for 32+ chars)
    const isUUID = segment.length > 30 
    const label = isUUID ? "Details" : (ROUTE_LABELS[segment] || segment.replace(/-/g, ' '))
    const isLast = index === arr.length - 1
    
    return { href, label, isLast }
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const getInitials = () => {
    if (!user) return "U"
    const name = user.user_metadata?.full_name
    return name ? name.substring(0, 2).toUpperCase() : user.email?.substring(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b h-16 px-4 md:px-6 flex items-center justify-between gap-4 transition-all">
      
      {/* LEFT: Mobile Toggle & Breadcrumbs */}
      <div className={`flex items-center gap-4 ${isSearchOpen ? 'hidden md:flex' : 'flex-1'}`}>
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="hidden md:block">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item) => (
                <div key={item.href} className="flex items-center">
                  <BreadcrumbItem>
                    {item.isLast ? (
                      <BreadcrumbPage className="font-semibold text-slate-800">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={item.href} className="text-slate-500 hover:text-slate-900 transition-colors">
                          {item.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!item.isLast && <BreadcrumbSeparator className="mx-2"><ChevronRight className="h-3.5 w-3.5"/></BreadcrumbSeparator>}
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* MIDDLE: Search Bar (Responsive) */}
      <div className={`flex items-center justify-end transition-all duration-300 ${isSearchOpen ? 'w-full md:w-auto' : 'w-auto'}`}>
        
        {/* Mobile Search Trigger */}
        {!isSearchOpen && (
          <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setIsSearchOpen(true)}>
            <Search className="h-5 w-5 text-slate-500" />
          </Button>
        )}

        {/* The Input */}
        <div className={`${isSearchOpen ? 'flex w-full md:w-96' : 'hidden md:flex md:w-80'} relative group transition-all`}>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
          <Input 
            ref={searchInputRef}
            placeholder="Search leads, users..." 
            className="pl-9 pr-12 h-9 bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 focus-visible:bg-white transition-all w-full"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onBlur={() => !searchValue && setIsSearchOpen(false)} 
          />
          
          {/* Close Button (Mobile) or Kbd (Desktop) */}
          <div className="absolute right-2 top-2 flex items-center">
            {isSearchOpen ? (
               <button onClick={() => { setSearchValue(""); setIsSearchOpen(false); }} className="md:hidden text-slate-400">
                 <X className="h-4 w-4" />
               </button>
            ) : null}
            <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
      </div>

      {/* RIGHT: Actions & Profile */}
      <div className={`flex items-center gap-2 sm:gap-3 shrink-0 ${isSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        
        <NotificationCenter />

        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2">
                <Avatar className="h-9 w-9 border border-slate-200 hover:shadow-md transition-all">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-medium text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none truncate">{user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="cursor-pointer w-full flex items-center">
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="cursor-pointer w-full flex items-center">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
