import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, FileText, Users, ArrowRight, Clock } from "lucide-react";

// Simplified Lead type to only use the 'name' column you confirmed is available
interface Lead {
    id: string;
    name: string; // CRITICAL CHANGE: Using 'name' for leads
}

export default async function KycTeamDashboard() {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login"); 
    }

    // 2. Data Fetching for Dashboard - SIMPLIFIED TO MINIMIZE ERRORS
    const [{ count: totalAssignedLeads }, { data: recentLeadsResult }] =
        await Promise.all([
            // Count ALL Leads assigned to this member (Cannot filter by status/date if columns are missing)
            supabase.from("leads")
                .select("*", { count: "exact", head: true })
                .eq("kyc_member_id", user.id),
            
            // Fetch recent 5 leads by 'name' and 'id'. 
            // CRITICAL: We can no longer order by 'created_at'.
            // The list will be ordered arbitrarily (by primary key ID).
            supabase.from("leads")
                .select("id, name") 
                .eq("kyc_member_id", user.id)
                .limit(5)
        ]);

    const totalLeads = totalAssignedLeads || 0;

    // All status-specific stats must be placeholders since the 'status' column is missing.
    const stats = [
        {
            title: "Total Assigned Leads",
            value: totalLeads,
            icon: FileText,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            link: "/kyc-team/leads"
        },
        {
            title: "Pending Leads (Placeholder)",
            value: totalLeads, 
            icon: Clock,
            color: "text-red-600",
            bgColor: "bg-red-50",
            link: "/kyc-team/leads"
        },
        {
            title: "KYC Approved (Placeholder)",
            value: 0,
            icon: ShieldCheck,
            color: "text-green-600",
            bgColor: "bg-green-50",
            link: "/kyc-team/leads"
        },
    ];

    return (
        <div className="space-y-8 pb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800">
                <ShieldCheck className="w-8 h-8 text-purple-600" />
                Welcome to the KYC Team Portal
            </h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index} className="hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-200">
                        <CardContent className="p-6">
                            <Link href={stat.link} className="block group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                        <p className="text-4xl font-extrabold text-gray-900 mt-2">{stat.value}</p>
                                    </div>
                                    <div className={`p-4 rounded-full ${stat.bgColor} group-hover:rotate-6 transition-transform`}>
                                        <stat.icon className={`h-8 w-8 ${stat.color}`} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end pt-4 text-xs font-semibold text-purple-600 group-hover:text-purple-700">
                                    View Leads <ArrowRight className="h-3 w-3 ml-1" />
                                </div>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Leads Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-600" />
                        Top 5 Assigned Leads (No sorting available)
                    </CardTitle>
                    <Link href="/kyc-team/leads" passHref>
                        <Button variant="ghost" size="sm" className="text-purple-600">View All</Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {recentLeadsResult?.length ? (
                        <ul className="w-full space-y-3">
                            {recentLeadsResult.map((lead: Lead) => (
                                <li key={lead.id} className="flex justify-between items-center p-3 border rounded-xl bg-white hover:bg-purple-50 transition-colors shadow-sm">
                                    <span className="flex flex-col">
                                        <Link href={`/kyc-team/${lead.id}`} className="font-semibold text-purple-700 hover:underline">
                                            {lead.name}
                                        </Link>
                                        <span className="text-xs text-gray-500">View details</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-gray-400 text-white">
                                            Assigned
                                        </Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8 flex items-center justify-center gap-2">
                            <Users className="h-5 w-5"/>
                            No leads currently assigned to you.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
