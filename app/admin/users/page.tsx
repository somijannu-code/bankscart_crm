"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  AlertCircle,
  Shield,
  ShieldOff,
  Edit,
  Search,
  Trash2,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Define types
interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  phone: string | null
  is_active: boolean
  created_at: string
  manager_id: string | null
}

interface AttendanceRecord {
  user_id: string
  check_in: string | null
}

export default function UsersPage() {
  const supabase = createClient()
  const router = useRouter()

  // State Management
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})
  const [currentUserRole, setCurrentUserRole] = useState("telecaller")

  // 1. Fetch Data on Load
  useEffect(() => {
    fetchUsersAndPermissions()
  }, [])

  // 2. Filter Users when Search Query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
    } else {
      const lowerQuery = searchQuery.toLowerCase()
      const filtered = users.filter(user => 
        (user.full_name?.toLowerCase() || "").includes(lowerQuery) ||
        (user.email?.toLowerCase() || "").includes(lowerQuery) ||
        (user.phone || "").includes(lowerQuery)
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  const fetchUsersAndPermissions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // A. Get Current User Role
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single()
        if (profile) setCurrentUserRole(profile.role)
      }

      // B. Fetch Users List
      // UPDATE: Added .order("is_active", { ascending: false }) to show active users first
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, role, phone, is_active, created_at, manager_id")
        .order("is_active", { ascending: false }) // <--- Key Change: Active users first (true > false)
        .order("created_at", { ascending: false }) // Then newest first
        .limit(100)

      if (userError) throw userError
      
      const safeUsers = userData as UserProfile[] || []
      setUsers(safeUsers)
      setFilteredUsers(safeUsers)

      // C. Fetch Attendance Status (Who is online?)
      const today = new Date().toISOString().split('T')[0]
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id, check_in")
        .eq("date", today)
      
      if (attendanceData) {
        const statusMap = attendanceData.reduce((acc: Record<string, boolean>, record: any) => {
          acc[record.user_id] = !!record.check_in
          return acc
        }, {})
        setTelecallerStatus(statusMap)
      }

    } catch (err: any) {
      console.error("Error fetching users:", err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Handle Bulk Delete
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedUserIds.length} users? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      // Ideally, use a backend API to delete users from Auth AND Database
      // For now, we assume RLS allows deletion from public.users
      const { error } = await supabase
        .from("users")
        .delete()
        .in("id", selectedUserIds)

      if (error) throw error

      // Refresh UI
      const remainingUsers = users.filter(u => !selectedUserIds.includes(u.id))
      setUsers(remainingUsers)
      setFilteredUsers(remainingUsers) // Use remaining for filter base
      setSelectedUserIds([]) // Clear selection
      
      alert("Users deleted successfully")
    } catch (err: any) {
      console.error("Delete failed:", err)
      alert("Failed to delete users: " + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Helper: Toggle single checkbox
  const toggleSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Helper: Toggle "Select All"
  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id))
    }
  }

  // Permission Check
  const canManageUsers = ['super_admin', 'tenant_admin', 'owner', 'admin'].includes(currentUserRole)

  if (error && error.includes("infinite recursion")) {
    return (
      <div className="p-6">
        <AlertCircle className="h-10 w-10 text-red-500 mb-2"/>
        <h2 className="text-lg font-bold">Database Policy Error</h2>
        <p>Please run the "Recursion-Proof" SQL script provided earlier to fix the RLS loop.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">
            {filteredUsers.length} active members
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* SEARCH BAR */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search users..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* BULK DELETE BUTTON (Visible only when users selected) */}
          {selectedUserIds.length > 0 && canManageUsers && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
              Delete ({selectedUserIds.length})
            </Button>
          )}

          {/* ADD USER BUTTON */}
          {canManageUsers && (
            <Link href="/admin/users/new">
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden md:inline">Add User</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-gray-50/50">
          <div className="flex items-center gap-4">
            {/* SELECT ALL CHECKBOX */}
            {canManageUsers && (
              <Checkbox 
                checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            )}
            <CardTitle className="flex items-center gap-2 text-base font-medium text-gray-700">
              User List
            </CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading users...</div>
          ) : filteredUsers.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${selectedUserIds.includes(user.id) ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center space-x-4">
                    {/* ROW CHECKBOX */}
                    {canManageUsers && (
                      <Checkbox 
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleSelection(user.id)}
                      />
                    )}
                    
                    {/* Status Dot */}
                    {user.role === "telecaller" && (
                      <div className={`w-2 h-2 rounded-full shrink-0 ${telecallerStatus[user.id] ? 'bg-green-500' : 'bg-gray-300'}`} 
                           title={telecallerStatus[user.id] ? 'Checked in' : 'Offline'} />
                    )}

                    {/* Avatar */}
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold shrink-0">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base">
                        {user.full_name || 'Unnamed User'}
                      </h3>
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs md:text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Badges */}
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role.includes("admin") ? "default" : "secondary"} className="hidden md:inline-flex">
                      {user.role}
                    </Badge>
                    
                    <div className="hidden md:block">
                      {user.is_active ? 
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Active</Badge> : 
                        <Badge variant="destructive">Inactive</Badge>
                      }
                    </div>

                    {canManageUsers && (
                      <Link href={`/admin/users/${user.id}/edit`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4 text-gray-500" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>No users found matching "{searchQuery}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
