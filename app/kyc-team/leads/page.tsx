// app/kyc-team/leads/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KycLeadsTable from "@/components/kyc-team/KycLeadsTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default async function KycLeadsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Get user role from the database
    const { data: userData, error } = await supabase
        .from("users") // or whatever your users table is called
        .select("role")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error fetching user role:", error);
    }

    const userRole = userData?.role || "unknown";

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="w-7 h-7 text-primary" />
                My Assigned KYC Leads
            </h1>
            <p className="text-gray-500">
                Review and process leads assigned to you for KYC verification.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle>Leads Requiring Action</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Pass all required props */}
                    <KycLeadsTable 
                        currentUserId={user.id} 
                        initialStatus="all"
                        userRole={userRole}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
