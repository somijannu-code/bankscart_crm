"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, Send, Users, Loader2, DollarSign, UserCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Assuming these components exist based on your original file's imports
// import { TimelineView } from "@/components/timeline-view"
// import { LeadNotes } from "@/components/lead-notes"
// import { LeadCallHistory } from "@/components/lead-call-history"
// import { FollowUpsList } from "@/components/follow-ups-list"
// import { LeadStatusUpdater } from "@/components/lead-status-updater" 
// (Replacing LeadStatusUpdater with an inline status management for simplicity/control)

// --- 1. CONSTANTS AND UTILITIES ---

// Statuses relevant for a Telecaller
const STATUSES = {
    NEW: "New Lead",
    CONTACTED: "Contacted",
    FOLLOW_UP: "Follow Up",
    NOT_INTERESTED: "Not Interested",
    LOGIN_DONE: "Login Done",
    TRANSFERRED_TO_KYC: "Transferred to KYC", // New Status for Handover
} as const;

const STATUS_OPTIONS = Object.values(STATUSES);

interface User {
    id: string;
    email: string;
    // Assuming a profile table or similar stores the full name, we'll use email as fallback
    full_name: string | null; 
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  designation: string | null
  source: string | null
  status: string
  priority: string
  created_at: string
  updated_at: string
  assigned_to: string | null // Telecaller assignment
  kyc_assigned_to: string | null // NEW: KYC Team assignment
  loan_amount: number | null;
  loan_type: string | null;
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case STATUSES.NEW: return <Badge className="bg-blue-500 text-white hover:bg-blue-600">New</Badge>;
        case STATUSES.CONTACTED: return <Badge className="bg-green-500 text-white hover:bg-green-600">Contacted</Badge>;
        case STATUSES.FOLLOW_UP: return <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">Follow Up</Badge>;
        case STATUSES.NOT_INTERESTED: return <Badge className="bg-red-500 text-white hover:bg-red-600">Not Interested</Badge>;
        case STATUSES.LOGIN_DONE: return <Badge className="bg-purple-500 text-white hover:bg-purple-600">Login Done</Badge>;
        case STATUSES.TRANSFERRED_TO_KYC: return <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">Transferred to KYC</Badge>;
        default: return <Badge variant="secondary">Other</Badge>;
    }
};

const formatCurrency = (value: number | null) => {
    if (value === null || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value));
};

// --- 2. LEAD TRANSFER MODULE COMPONENT ---

interface LeadTransferModuleProps {
    lead: Lead;
    onTransferSuccess: (kycUserId: string) => void;
}

const LeadTransferModule = ({ lead, onTransferSuccess }: LeadTransferModuleProps) => {
    const supabase = createClient();
    const [kycUsers, setKycUsers] = useState<User[]>([]);
    const [selectedKycUserId, setSelectedKycUserId] = useState<string>('');
    const [isFetchingUsers, setIsFetchingUsers] = useState(true);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);

    // Fetch KYC Users
    useEffect(() => {
        const fetchKycUsers = async () => {
            setIsFetchingUsers(true);
            // Assuming there is a 'users' table with a 'role' column set to 'kyc-team'
            const { data, error } = await supabase
                .from('users') 
                .select('id, email, full_name') // Select necessary user info
                .eq('role', 'kyc-team')
                .limit(100);

            if (error) {
                console.error('Error fetching KYC users:', error);
                setTransferError('Could not load KYC team list.');
            } else if (data) {
                setKycUsers(data as User[]);
            }
            setIsFetchingUsers(false);
        };
        fetchKycUsers();
    }, [supabase]);

    const handleTransfer = useCallback(async () => {
        if (!selectedKycUserId) {
            setTransferError('Please select a KYC team member.');
            return;
        }

        setIsTransferring(true);
        setTransferError(null);

        // Update the lead: set new status and assign to KYC team member
        const { error } = await supabase
            .from('leads')
            .update({ 
                status: STATUSES.TRANSFERRED_TO_KYC,
                kyc_assigned_to: selectedKycUserId,
                updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);
        
        setIsTransferring(false);

        if (error) {
            console.error("Error transferring lead:", error);
            setTransferError("Failed to transfer lead. Check permissions.");
        } else {
            // Success: notify parent and reset selection
            onTransferSuccess(selectedKycUserId);
            setSelectedKycUserId(''); // Clear selection after success
            // toast.success(`Lead successfully transferred to KYC Team member.`);
        }
    }, [lead.id, selectedKycUserId, supabase, onTransferSuccess]);

    const isAlreadyTransferred = lead.status === STATUSES.TRANSFERRED_TO_KYC;
    const isButtonDisabled = isTransferring || isFetchingUsers || !selectedKycUserId || isAlreadyTransferred;

    // Determine the current assigned KYC team member's name
    const currentKycAssignee = lead.kyc_assigned_to 
        ? kycUsers.find(u => u.id === lead.kyc_assigned_to)?.full_name || kycUsers.find(u => u.id === lead.kyc_assigned_to)?.email || lead.kyc_assigned_to.substring(0, 8) + '...'
        : null;

    return (
        <Card className="shadow-lg border-2 border-indigo-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-indigo-700">
                    <Send className="h-5 w-5" />
                    Transfer to KYC Team
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isAlreadyTransferred && (
                    <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700 p-3 rounded-md text-sm">
                        <p className="font-semibold">Already Transferred</p>
                        <p>This lead is currently in the KYC pipeline.</p>
                        {currentKycAssignee && <p className="mt-1 text-xs">Assigned to: **{currentKycAssignee}**</p>}
                    </div>
                )}
                
                <div className="space-y-2">
                    <Label htmlFor="kyc-select">Select KYC Team Member</Label>
                    <Select 
                        value={selectedKycUserId} 
                        onValueChange={setSelectedKycUserId}
                        disabled={isTransferring || isFetchingUsers || isAlreadyTransferred}
                    >
                        <SelectTrigger id="kyc-select" className="w-full">
                            <SelectValue placeholder={isFetchingUsers ? "Loading team..." : "Select KYC member"} />
                        </SelectTrigger>
                        <SelectContent>
                            {kycUsers.length === 0 && !isFetchingUsers && (
                                <div className="p-2 text-center text-sm text-gray-500">No KYC users found.</div>
                            )}
                            {kycUsers.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.full_name || user.email}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isFetchingUsers && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Fetching team list...
                        </p>
                    )}
                </div>

                {transferError && <p className="text-sm text-red-600">{transferError}</p>}

                <Button 
                    onClick={handleTransfer} 
                    disabled={isButtonDisabled}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                    {isTransferring ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Transferring...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4 mr-2" />
                            Transfer Lead to KYC
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

// --- 3. MAIN TELECALLER LEAD PROFILE PAGE ---

interface EditLeadPageProps {
  params: {
    id: string
  }
}

export default function LeadDetailPage({ params }: EditLeadPageProps) {
    const router = useRouter()
    const leadId = params.id
    const supabase = createClient()
    
    // State management for lead and user (assuming user is required for components like LeadNotes)
    const [lead, setLead] = useState<Lead | null>(null)
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    // Stubs for your imported components' data
    const [timelineData, setTimelineData] = useState<any[]>([]) 

    // Fetch Lead Data
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        
        // Fetch current user details
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) {
            console.error('User fetch error:', userError)
            // Continue loading, but user info might be incomplete
        }
        setUser(userData?.user)
        
        // Fetch Lead details (including the new kyc_assigned_to field)
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .select(`
                id, name, email, phone, company, designation, source, 
                status, priority, created_at, updated_at, assigned_to, 
                kyc_assigned_to, loan_amount, loan_type
            `)
            .eq('id', leadId)
            .single()

        if (leadError) {
            console.error('Lead fetch error:', leadError)
            setError(leadError.message)
            setLead(null)
        } else {
            setLead(leadData as Lead)
            // Placeholder for timeline data simulation
            setTimelineData([
                { id: 1, type: 'status_change', message: `Lead created as ${leadData.status}`, timestamp: leadData.created_at },
            ])
        }
        
        setLoading(false)
    }, [leadId, supabase])

    useEffect(() => {
        fetchData()
        
        // Setup Real-time Listener for the specific lead
        const channel = supabase.channel(`lead_${leadId}_changes`);

        const subscription = channel
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
            (payload) => {
              console.log("Real-time update received for lead:", payload.new);
              setLead(prev => ({ ...(prev as Lead), ...(payload.new as Lead) }));
            }
          )
          .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);

    const handleTransferSuccess = (kycUserId: string) => {
        // Optimistically update local state after successful DB operation
        setLead(prev => (prev ? { 
            ...prev, 
            status: STATUSES.TRANSFERRED_TO_KYC, 
            kyc_assigned_to: kycUserId 
        } : null));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="ml-2 text-lg text-gray-600">Loading Lead Profile...</p>
            </div>
        )
    }

    if (error || !lead) {
        return (
            <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl">
                <h1 className="text-2xl font-bold mt-4 text-red-700">Error Loading Lead</h1>
                <p className="text-gray-600 mt-2">{error || "The requested lead could not be found."}</p>
                <Button onClick={() => router.push('/telecaller/leads')} className="mt-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Leads List
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header and Quick Status */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Button onClick={() => router.back()} variant="outline" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">{lead.name}</h1>
                    {getStatusBadge(lead.status)}
                </div>
                <div className="text-sm text-gray-500">
                    Last Updated: {new Date(lead.updated_at).toLocaleString()}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Lead Details (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Personal and Contact Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-700">
                                <UserCheck className="h-5 w-5" />
                                Basic & Loan Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DetailItem icon={<Phone className="h-4 w-4 text-gray-500" />} label="Phone" value={lead.phone} />
                            <DetailItem icon={<Mail className="h-4 w-4 text-gray-500" />} label="Email" value={lead.email || 'N/A'} />
                            <DetailItem label="Loan Amount" value={formatCurrency(lead.loan_amount)} valueClass="font-bold text-lg text-green-700" />
                            <DetailItem label="Loan Type" value={lead.loan_type || 'N/A'} />
                            <DetailItem label="Company" value={lead.company || 'N/A'} />
                            <DetailItem label="Designation" value={lead.designation || 'N/A'} />
                            <DetailItem label="Lead Source" value={lead.source || 'N/A'} />
                            <DetailItem label="Priority" value={<Badge variant="secondary" className={`capitalize ${lead.priority === 'urgent' ? 'bg-red-500 text-white' : lead.priority === 'high' ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>{lead.priority}</Badge>} />
                            <DetailItem label="Assigned Telecaller ID" value={lead.assigned_to ? lead.assigned_to.substring(0, 8) + '...' : 'Unassigned'} />
                            <DetailItem label="Assigned KYC ID" value={lead.kyc_assigned_to ? lead.kyc_assigned_to.substring(0, 8) + '...' : 'None'} />
                        </CardContent>
                    </Card>

                    {/* Tabs for Timeline, Notes, Calls, Follow-ups */}
                    <Tabs defaultValue="timeline">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                            <TabsTrigger value="calls">Calls</TabsTrigger>
                            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="timeline">
                            <Card>
                                <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
                                <CardContent>
                                    {/* <TimelineView data={timelineData} /> */}
                                    <p className="text-sm text-gray-500">Timeline component integration goes here.</p>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Notes & Comments</CardTitle></CardHeader>
                                <CardContent>
                                    {/* <LeadNotes leadId={lead.id} userId={user?.id} /> */}
                                    <p className="text-sm text-gray-500">LeadNotes component integration goes here.</p>
                                    <Textarea placeholder="Add a quick note..." className="mt-3" rows={3} />
                                    <Button size="sm" className="mt-2 w-full">Save Note</Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="calls">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Call History</CardTitle></CardHeader>
                                <CardContent>
                                    {/* <LeadCallHistory leadId={lead.id} userId={user?.id} /> */}
                                    <p className="text-sm text-gray-500">LeadCallHistory component integration goes here.</p>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="followups">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Follow-ups</CardTitle></CardHeader>
                                <CardContent>
                                    {/* <FollowUpsList leadId={lead.id} /> */}
                                    <p className="text-sm text-gray-500">FollowUpsList component integration goes here.</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                </div>

                {/* Right Column: Status & Transfer (1/3 width) */}
                <div className="lg:col-span-1 space-y-6">
                    
                    {/* Status Update Component (Placeholder/Inline) */}
                    <Card className="shadow-lg border-2 border-purple-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl text-purple-700">
                                <Clock className="h-5 w-5" />
                                Update Lead Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Label htmlFor="status-select" className="min-w-[80px]">Current:</Label>
                                <div className="flex-grow">{getStatusBadge(lead.status)}</div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status-select">Set New Status:</Label>
                                <Select value={lead.status} onValueChange={(newStatus) => { 
                                    // Placeholder for actual status update logic
                                    console.log('Status update triggered:', newStatus);
                                    setLead(prev => (prev ? { ...prev, status: newStatus } : null)); 
                                    // In a real app, this would trigger LeadStatusUpdater logic
                                }}>
                                    <SelectTrigger id="status-select" className="w-full">
                                        <SelectValue placeholder="Select a new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(status => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full bg-purple-600 hover:bg-purple-700 transition-colors" disabled>
                                Save Status (Functional Component Missing)
                            </Button>
                        </CardContent>
                    </Card>

                    {/* NEW: Lead Transfer Module */}
                    {lead.status === STATUSES.LOGIN_DONE && (
                        <LeadTransferModule 
                            lead={lead} 
                            onTransferSuccess={handleTransferSuccess}
                        />
                    )}
                    
                    {/* Display current KYC assignment status if already transferred */}
                    {lead.status === STATUSES.TRANSFERRED_TO_KYC && (
                        <Card className="shadow-md border-2 border-green-200 bg-green-50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg text-green-700">
                                    <UserCheck className="h-5 w-5" />
                                    KYC Assignment Complete
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-700">
                                    This lead has been successfully handed over to the KYC team.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                </div>
            </div>
        </div>
    )
}

// Simple helper component for displaying details
const DetailItem = ({ label, value, icon, valueClass = '' }: { label: string, value: React.ReactNode, icon?: React.ReactNode, valueClass?: string }) => (
    <div className="flex flex-col space-y-1 p-2 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`flex items-center gap-2 ${valueClass}`}>
            {icon}
            <span className="text-sm text-gray-800 break-words">{value}</span>
        </div>
    </div>
);
