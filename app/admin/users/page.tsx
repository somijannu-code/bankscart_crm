"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  UserPlus, Search, Trash2, Ban, CheckCircle, MoreHorizontal, Filter, Shield, Eye
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state" // Assuming you have this

// --- TYPES ---
interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  phone: string | null
  is_active: boolean
  created_at: string
  manager_id: string | null
  manager?: { full_name: string }
  last_active?: string // Derived from attendance
}

const ITEMS_PER_PAGE = 10

export default function UsersPage() {
  const supabase = createClient()

  // State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState("telecaller")
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 1. Get Current User Role
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from("users").select("role").eq("id", authUser.id).single()
        if (profile) setCurrentUserRole(profile.role)
      }

      // 2. Fetch Users
      const { data, error } = await supabase
        .from("users")
        .select(`
          *,
          manager:users!users_manager_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false })
      
      if (error) throw error

      // 3. Fetch Online Status & Last Active
      const today = new Date().toISOString().split('T')[0]
      const { data: attendance } = await supabase.from("attendance").select("user_id, check_in").eq("date", today)
      
      const statusMap: Record<string, boolean> = {}
      attendance?.forEach((r: any) => {
          if(r.check_in) statusMap[r.user_id] = true
      })
      setTelecallerStatus(statusMap)

      setUsers(data || [])

    } catch (err: any) {
      console.error(err)
      toast.error("Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- FILTER & PAGINATION LOGIC ---
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.is_active : !user.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const paginatedUsers = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return filteredUsers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredUsers, currentPage])

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)

  // --- ACTIONS ---
  const handleBulkAction = async (action: 'delete' | 'deactivate') => {
    if (!confirm(`Are you sure you want to ${action} ${selectedUserIds.length} users?`)) return

    setIsProcessing(true)
    try {
      if (action === 'delete') {
        const { error } = await supabase.from("users").delete().in("id", selectedUserIds)
        if (error) throw error
        setUsers(prev => prev.filter(u => !selectedUserIds.includes(u.id)))
        toast.success("Users deleted permanently")
      } else {
        const { error } = await supabase.from("users").update({ is_active: false }).in("id", selectedUserIds)
        if (error) throw error
        setUsers(prev => prev.map(u => selectedUserIds.includes(u.id) ? { ...u, is_active: false } : u))
        toast.success("Users deactivated")
      }
      setSelectedUserIds([])
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    setSelectedUserIds(selectedUserIds.length === paginatedUsers.length ? [] : paginatedUsers.map(u => u.id))
  }

  const canManage = ['super_admin', 'admin', 'owner'].includes(currentUserRole)

  // --- RENDER HELPERS ---
  const getRoleBadge = (role: string) => {
    const styles = {
      admin: "bg-purple-100 text-purple-700 border-purple-200",
      super_admin: "bg-purple-100 text-purple-700 border-purple-200",
      manager: "bg-blue-100 text-blue-700 border-blue-200",
      telecaller: "bg-slate-100 text-slate-700 border-slate-200"
    }
    return (
        <Badge variant="outline" className={`capitalize font-medium border-0 ${styles[role as keyof typeof styles] || styles.telecaller}`}>
            {role.replace('_', ' ')}
        </Badge>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage {users.length} members across your organization.</p>
        </div>
        
        {canManage && (
          <Link href="/admin/users/new">
            <Button className="shadow-sm bg-indigo-600 hover:bg-indigo-700 transition-all">
              <UserPlus className="h-4 w-4 mr-2" /> Add Member
            </Button>
          </Link>
        )}
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-1 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
                placeholder="Search team..." 
                className="pl-9 border-0 bg-transparent focus-visible:ring-0" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
        </div>
        <div className="flex gap-2 w-full sm:w-auto p-1">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-50 border-slate-200">
                    <Filter className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="telecaller">Telecaller</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* BULK ACTIONS BANNER */}
      {selectedUserIds.length > 0 && canManage && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 px-4 flex items-center justify-between animate-in slide-in-from-top-2">
              <span className="text-sm text-indigo-700 font-medium">{selectedUserIds.length} users selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100" onClick={() => handleBulkAction('deactivate')} disabled={isProcessing}>
                  <Ban className="h-4 w-4 mr-2" /> Deactivate
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleBulkAction('delete')} disabled={isProcessing}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
          </div>
      )}

      {/* DATA TABLE */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px] text-center">
                  <Checkbox 
                    checked={paginatedUsers.length > 0 && selectedUserIds.length === paginatedUsers.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[300px]">User Profile</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Manager</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <EmptyState 
                        icon={Search} 
                        title="No users found" 
                        description="Try adjusting your search or filters to find team members." 
                        variant="ghost"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} className={`group transition-colors ${selectedUserIds.includes(user.id) ? "bg-indigo-50/50 hover:bg-indigo-50" : "hover:bg-slate-50"}`}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleSelection(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9 border border-slate-200">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700">{user.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          {/* Online Dot */}
                          {user.role === 'telecaller' && (
                            <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${telecallerStatus[user.id] ? "bg-green-500" : "bg-slate-300"}`} />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{user.full_name}</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full w-fit border border-emerald-100">
                          <CheckCircle className="h-3 w-3" /> Active
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full w-fit border border-slate-200">
                          <Ban className="h-3 w-3" /> Inactive
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">
                      {user.manager?.full_name ? (
                          <div className="flex items-center gap-1.5">
                              <Shield className="h-3 w-3 text-slate-400" />
                              {user.manager.full_name}
                          </div>
                      ) : (
                          <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <Link href={`/admin/users/${user.id}/edit`}>
                              <DropdownMenuItem>Edit Details</DropdownMenuItem>
                            </Link>
                            
                            {/* Impersonation Feature (For Admins) */}
                            {currentUserRole === 'super_admin' && (
                                <DropdownMenuItem onClick={() => toast.info("Impersonation feature coming soon!")}>
                                    <Eye className="h-4 w-4 mr-2 text-slate-500" /> Impersonate
                                </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => {
                                setSelectedUserIds([user.id])
                                handleBulkAction('delete')
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* PAGINATION FOOTER */}
        {filteredUsers.length > 0 && (
            <div className="border-t p-4 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs text-slate-500">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} entries
                </span>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(p => p - 1)}
                    >
                        Previous
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === totalPages} 
                        onClick={() => setCurrentPage(p => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>
        )}
      </Card>
    </div>
  )
}
