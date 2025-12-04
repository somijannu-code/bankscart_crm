import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, UserPlus, Mail, Phone, AlertCircle, Shield, ShieldOff, Edit } from "lucide-react"
import Link from "next/link"

// Define type for attendance record
interface AttendanceRecord {
  user_id: string;
  check_in: string | null;
}

export default async function UsersPage() {
  const supabase = await createClient()

  // 1. GET CURRENT USER DETAILS (To determine permissions)
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  
  let currentUserRole = "telecaller" // Default safe role
  
  if (currentUser) {
    // Fetch the real role from the database
    const { data: myProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single()
    
    if (myProfile) {
      currentUserRole = myProfile.role
    }
  }

  // 2. DEFINE PERMISSIONS
  // We allow Super Admins, Tenant Admins, and generic 'admin' roles to add/edit users.
  // We EXPLICITLY EXCLUDE 'team_leader' from this list.
  const canManageUsers = ['super_admin', 'tenant_admin', 'owner', 'admin'].includes(currentUserRole)


  // 3. FETCH THE USERS LIST
  let users: any[] = []
  let error = null
  
  try {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role, phone, is_active, created_at, manager_id")
      .order("created_at", { ascending: false })
      .limit(200) 
    
    if (userError) {
      console.error("Error fetching users:", userError)
      error = userError
    } else {
      users = userData || []
    }
  } catch (err) {
    console.error("Exception when fetching users:", err)
    error = err as any
  }

  // Handle RLS Recursion Error
  if (error && error.message?.includes("infinite recursion")) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Telecallers</h1>
            <p className="text-gray-600 mt-1">Manage your team members</p>
          </div>
          {/* Hide button if permission denied */}
          {canManageUsers && (
            <Link href="/admin/users/new">
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add New User
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-12 w-12 mb-4" />
              <h3 className="text-lg font-medium mb-2">RLS Policy Configuration Issue</h3>
              <p className="text-sm text-center max-w-md mb-4">
                There is an infinite recursion issue in your Row Level Security policies.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Handle General Errors
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Telecallers</h1>
            <p className="text-gray-600 mt-1">Manage your team members</p>
          </div>
          {canManageUsers && (
            <Link href="/admin/users/new">
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add New User
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-12 w-12 mb-4" />
              <h3 className="text-lg font-medium mb-2">Error Loading Users</h3>
              <p className="text-sm text-center max-w-md">
                We couldn't load the user list. Please check your connection and try again.
              </p>
              <pre className="mt-4 text-xs bg-muted p-2 rounded max-w-md overflow-auto">
                {error.message}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get telecaller status for today
  let telecallerStatus: Record<string, boolean> = {}
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: attendanceRecordsData } = await supabase
      .from("attendance")
      .select("user_id, check_in")
      .eq("date", today)
    
    const attendanceRecords = attendanceRecordsData as AttendanceRecord[] | null
    
    if (attendanceRecords) {
      telecallerStatus = attendanceRecords.reduce((acc: Record<string, boolean>, record: AttendanceRecord) => {
        acc[record.user_id] = !!record.check_in
        return acc
      }, {} as Record<string, boolean>)
    }
  } catch (err) {
    console.error("Error fetching telecaller status:", err)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Telecallers</h1>
          <p className="text-gray-600 mt-1">Manage your team members</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
          
          {/* CONDITIONALLY RENDER ADD BUTTON */}
          {canManageUsers && (
            <Link href="/admin/users/new">
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add New User
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {/* Status indicator for telecaller */}
                    {user.role === "telecaller" && (
                      <div className={`w-2 h-2 rounded-full ${telecallerStatus[user.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                           title={telecallerStatus[user.id] ? 'Checked in' : 'Not checked in'} />
                    )}
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {user.full_name || 'Unnamed User'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                    <Badge variant={user.is_active ? "default" : "destructive"}>
                      {user.is_active ? 
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Active
                        </span> : 
                        <span className="flex items-center gap-1">
                          <ShieldOff className="h-3 w-3" /> Inactive
                        </span>
                      }
                    </Badge>
                    
                    {/* CONDITIONALLY RENDER EDIT BUTTON */}
                    {canManageUsers && (
                      <Link href={`/admin/users/${user.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
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
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-sm mb-4">
                There are no telecallers in your team yet.
              </p>
              
              {canManageUsers && (
                <Link href="/admin/users/new">
                  <Button className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Your First User
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
