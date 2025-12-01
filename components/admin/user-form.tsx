"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"

interface UserFormProps {
  initialData?: {
    id: string
    email: string
    full_name: string
    phone: string
    role: string
    manager_id: string | null
  }
  isEditing?: boolean
}

export function UserForm({ initialData, isEditing = false }: UserFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [formData, setFormData] = useState({
    email: initialData?.email || "",
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    role: initialData?.role || "telecaller",
    manager_id: initialData?.manager_id || "none",
    password: "", // Only for new users
  })
  
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAdmins = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "admin")
      
      if (data) {
        setAdmins(data)
      }
    }
    
    fetchAdmins()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isEditing && initialData) {
        // Update existing user
        const { error: updateError } = await supabase
          .from("users")
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            manager_id: formData.manager_id === "none" ? null : formData.manager_id
          })
          .eq("id", initialData.id)

        if (updateError) throw updateError
        
        alert("User updated successfully")
        router.push("/admin/users")
        router.refresh()
      } else {
        // Create new user
        // Note: In a real app, you might use a server action or an admin API to create users without logging them in.
        // Here we'll use the client-side signUp, but this logs the current user out if not careful.
        // Ideally, we should use a backend function. 
        // For this task, we'll assume the user is an Admin creating another user.
        // Supabase `signUp` on client side logs the new user in. 
        // To avoid this, we should use `supabase.auth.admin.createUser` which requires service_role key (backend).
        // OR use a secondary client?
        // Since we are in the browser, we can't use service_role safely.
        // We will use a workaround: Call an API route.
        
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            manager_id: formData.manager_id === "none" ? null : formData.manager_id
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to create user")
        }

        alert("User created successfully")
        router.push("/admin/users")
        router.refresh()
      }
    } catch (err: any) {
      console.error("Error saving user:", err)
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit User" : "Create New User"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update user details and assignment" : "Add a new user to the system"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isEditing} // Email cannot be changed easily
            />
          </div>

          {!isEditing && (
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telecaller">Telecaller</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manager">Reports To (Manager)</Label>
            <Select 
              value={formData.manager_id || "none"} 
              onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager (Top Level)</SelectItem>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign a manager for this user. Admins can manage their own team.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
