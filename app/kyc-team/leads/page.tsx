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
                    <KycLeadsTable 
                        currentUserId={user.id} 
                        initialStatus="all"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
