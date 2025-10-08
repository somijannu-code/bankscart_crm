import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KycSidebar from "@/components/kyc-team/KycSidebar";

// Define the structure for the user's profile data
interface UserProfile {
  name: string | null; // CRITICAL CHANGE: Assuming 'name' column based on your feedback
  role: string | null; 
}

export default async function KycTeamLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // 1. User is not authenticated, redirect to login
    redirect("/login");
  }

  // 2. Fetch the user's profile (name and role)
  // FIX: Switched from 'full_name' to 'name' to align with likely schema
  const { data: profile, error } = await supabase
    .from('users')
    .select('name, role') // Only selecting 'name' and 'role'
    .eq('id', user.id)
    .single();
    
  // 3. Check for errors or missing profile
  if (error) {
      // This error likely means the 'users' table or selected columns don't exist.
      console.error("Profile fetch error in KYC Layout:", error);
      // Cannot determine role, so deny access and redirect to prevent crash
      redirect("/"); 
      return null;
  }
  
  // 4. Role Check: If profile is missing or role is incorrect, deny access
  if (!profile || profile.role !== 'kyc_team') {
    console.warn(`Access denied for user ${user.id}. Role is ${profile?.role || 'null'}.`);
    redirect("/"); // Redirect to a safe route (e.g., general dashboard or home)
  }

  const userProfile: UserProfile = {
    name: profile.name, // Accessing 'name'
    role: profile.role,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Hidden on mobile, sticky on larger screens */}
      <KycSidebar userProfile={userProfile} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden pt-4 md:ml-64 w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
