import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
// FIX 1: Import the client component from the file you provided
import AttendanceReportsPageClient from "./page-client"; 

export default async function AdminAttendanceReportsPage() {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch User Role
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // FIX 2: Allow all Admin-level roles, not just "admin"
  const allowedRoles = ["admin", "super_admin", "tenant_admin", "owner"];

  if (userError || !userData || !allowedRoles.includes(userData.role)) {
    // If you are 'super_admin', the old code blocked you. This fixes it.
    redirect("/admin");
  }

  return (
    <div className="p-6">
      {/* FIX 3: Render the actual client page you created */}
      <AttendanceReportsPageClient />
    </div>
  );
}
