import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KycSidebar from "@/components/kyc-team/KycSidebar";

// Define the structure for the user's profile data
interface UserProfile {
  full_name: string | null; // Corrected back to 'full_name'
  role: string | null; 
}

export default async function KycTeamLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // 1. User is not authenticated, redirect to login
    redirect("/login");
  }

  // 2. Fetch the user's profile (full_name and role)
  const { data: profile, error } = await supabase
    .from('users')
    .select('full_name, role') // CRITICAL: Selecting 'full_name'
    .eq('id', user.id)
    .single();
    
  // 3. Robust Error/Missing Profile Check
  if (error || !profile) {
      // If we can't get the profile or an error occurs, we assume they don't have access.
      console.error("Profile fetch error in KYC Layout:", error || "Profile not found.");
      // Redirect to a safe route to prevent the Server Component render from crashing.
      redirect("/"); 
  }
  
  // 4. Role Check
  if (profile.role !== 'kyc_team') {
    console.warn(`Access denied for user ${user.id}. Role is ${profile.role}.`);
    redirect("/"); 
  }

  const userProfile: UserProfile = {
    full_name: profile.full_name,
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
