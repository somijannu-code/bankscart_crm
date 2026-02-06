import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminLeaveDashboard } from "@/components/admin/admin-leave-dashboard";

export default async function AdminLeaveManagementPage() {
  const supabase = await createClient();
  
  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 2. Fetch Data (All leaves, sorted by newest)
  const { data: leaves, error } = await supabase
    .from("leaves")
    .select(`
      *,
      user:users!leaves_user_id_fkey(full_name, email, role),
      approver:users!leaves_approved_by_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching leaves:", error);
    // In a real app, render an error boundary or empty state here
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
        <p className="text-slate-500">Overview of all employee leave requests and history.</p>
      </div>
      
      <AdminLeaveDashboard 
        leaves={leaves || []} 
        currentUserId={user.id} 
      />
    </div>
  );
}
