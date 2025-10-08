import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, FileText, CheckCircle, Clock, Send, Users } from "lucide-react";

// Simplified Lead type based on your table usage
interface Lead {
    id: string;
    full_name: string;
    phone: string;
    status: string;
    created_at: string;
}

export default async function KycTeamDashboard() {
    const supabase = await createClient();
    
    // 1. Auth & Role Check
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login"); 
    }

    // Assuming role is in a 'users' table, like in page (17).tsx
    const { data: profile } = await supabase
        .from('users') 
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (profile?.role !== 'kyc_team') {
        // Redirect if user is not a KYC member
        redirect("/telecaller"); 
    }

    // 2. Data Fetching for Dashboard
    const [{ count: awaitingKyc }, { count: approvedToday }, { data: recentLeads }] =
        await Promise.all([
            // Count Leads assigned to this member, awaiting KYC
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", "Awaiting KYC"),
            
            // Count Leads assigned to this member, approved today
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id)
                .eq("status", "KYC Approved")
                .gte("updated_at", new Date().toISOString().split("T")[0]), // Filter for today
            
            // Fetch recent 10 leads awaiting KYC
            supabase.from("leads")
                .select("id, full_name, phone, status, created_at")
                .eq("kyc_member_id", user.id)
                .eq("status", "Awaiting KYC")
                .order("created_at", { ascending: false })
                .limit(10)
        ]);

    const stats = [
        {
            title: "Assigned Leads (Pending)",
            value: awaitingKyc || 0,
            icon: Clock,
            color: "text-red-600",
            bgColor: "bg-red-50",
        },
        {
            title: "KYC Approved Today",
            value: approvedToday || 0,
            icon: CheckCircle,
            color: "text-green-600",
            bgColor: "bg-green-50",
        },
        {
            title: "Total Assigned (All-Time)",
            value: (awaitingKyc || 0) + (approvedToday || 0), // Placeholder for actual total count
            icon: FileText,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
        },
    ];

    return (
        <div className="space-y-6 p-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-8 h-8 text-primary" />
                KYC Team Dashboard
            </h1>

            {/* Stats Grid - Consistent with your Admin dashboard (page 17) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map((stat, index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Leads Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        Recently Assigned Leads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentLeads?.length ? (
                        <ul className="w-full space-y-2">
                            {recentLeads.map((lead: Lead) => (
                                <li key={lead.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50 transition-colors">
                                    <span>
                                        <Link href={`/kyc-team/${lead.id}`} className="font-semibold text-primary hover:underline">
                                            {lead.full_name}
                                        </Link>
                                        <span className="text-sm text-gray-500 ml-3">({lead.phone})</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-orange-500" />
                                        <span className="text-sm font-medium text-orange-500">Awaiting KYC</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8 flex items-center justify-center gap-2">
                            <Users className="h-5 w-5"/>
                            No leads currently assigned for verification.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
