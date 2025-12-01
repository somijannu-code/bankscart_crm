import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/admin/user-form"
import { notFound } from "next/navigation"
export default async function EditUserPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", params.id)
    .single()
    
  if (error || !user) {
    notFound()
  }
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
        <p className="text-gray-600 mt-1">Update user details and team assignment.</p>
      </div>
      
      <UserForm initialData={user} isEditing={true} />
    </div>
  )
}
