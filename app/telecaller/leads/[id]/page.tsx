"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Phone, Mail, Calendar, MessageSquare, ArrowLeft, Clock, Send, Loader2, UserCheck, Save, Users, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast" // Assuming you have a toast library

// Placeholder for custom components - restore actual paths if needed
import { TimelineView } from "@/components/timeline-view"
import { LeadNotes } from "@/components/lead-notes"
import { LeadCallHistory } from "@/components/lead-call-history"
import { FollowUpsList } from "@/components/follow-ups-list"

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

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const STATUS_OPTIONS = Object.values(STATUSES);

interface User {
    id: string;
    email: string;
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
  priority: 'low' | 'medium' | 'high' | 'urgent' // Enforce priority type
  created_at: string
  updated_at: string
  assigned_to: string | null // Telecaller assignment
  kyc_assigned_to: string | null // KYC Team assignment
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

// Simple helper component for displaying read-only details
const DetailItem = ({ label, value, icon, valueClass = '' }: { label: string, value: React.ReactNode, icon?: React.ReactNode, valueClass?: string }) => (
    <div className="flex flex-col space-y-1 p-2 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`flex items-center gap-2 ${valueClass}`}>
            {icon}
            <span className="text-sm text-gray-800 break-words">{value}</span>
        </div>
    </div>
);

// --- 2. LEAD TRANSFER MODULE COMPONENT (UPDATED) ---

interface LeadTransferModuleProps {
    lead: Lead;
    onTransferSuccess: (kycUserId: string) => void;
}

const LeadTransferModule = ({ lead, onTransferSuccess }: LeadTransferModuleProps) => {
    const supabase = createClient();
    const { toast } = useToast();
    const [kycUsers, setKycUsers] = useState<User[]>([]);
    const [selectedKycUserId, setSelectedKycUserId] = useState<string>('');
    const [isFetchingUsers, setIsFetchingUsers] = useState(true);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);

    // Fetch KYC Users
    useEffect(() => {
        const fetchKycUsers = async () => {
            setIsFetchingUsers(true);
            setTransferError(null);
            
            // Query: Get users where the 'role' column is 'kyc-team'
            const { data, error } = await supabase
                .from('users') 
                .select('id, email, full_name')
                .eq('role', 'kyc_team')
                .limit(100);

            if (error) {
                console.error('Error fetching KYC users:', error);
                // ** IMPROVED ERROR MESSAGE FOR RLS DEBUGGING **
                setTransferError(`Could not load KYC team list. (Error: ${error.message}). Check RLS policies on 'users' table.`);
            } else if (data) {
                console.log(`Successfully fetched ${data.length} KYC users.`);
                setKycUsers(data as User[]);
                if (data.length > 0) {
                    // Pre-select the first user for convenience
                    setSelectedKycUserId(data[0].id);
                }
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

        const updatePayload = { 
            status: STATUSES.TRANSFERRED_TO_KYC,
            kyc_assigned_to: selectedKycUserId,
            updated_at: new Date().toISOString()
        };

        // Update the lead: set new status and assign to KYC team member
        console.log(`Attempting to transfer lead ${lead.id} to KYC user ${selectedKycUserId} with status: ${updatePayload.status}`);
        
        const { error } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', lead.id);
        
        setIsTransferring(false);

        if (error) {
            console.error("Error transferring lead:", error);
            // ** IMPROVED ERROR MESSAGE FOR UPDATE FAILURE **
            setTransferError(`Failed to transfer lead. (Error: ${error.message}). Check RLS 'UPDATE' policy on 'leads' table.`);
            toast({
                title: "Transfer Failed",
                description: `Could not transfer lead: ${error.message.substring(0, 50)}...`,
                variant: "destructive",
            });
        } else {
            onTransferSuccess(selectedKycUserId);
            toast({
                title: "Transfer Successful",
                description: `Lead transferred to KYC team member.`,
                className: "bg-indigo-500 text-white",
            });
        }
    }, [lead.id, selectedKycUserId, supabase, onTransferSuccess, toast]);

    const isAlreadyTransferred = lead.status === STATUSES.TRANSFERRED_TO_KYC;
    const isButtonDisabled = isTransferring || isFetchingUsers || !selectedKycUserId || isAlreadyTransferred || kycUsers.length === 0;

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
                
                {kycUsers.length === 0 && !isFetchingUsers && !isAlreadyTransferred && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded-md text-sm flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <p className="font-semibold">No KYC Team Members Found.</p>
                        <p className="text-xs">Ensure users with the role 'kyc-team' exist and RLS policies allow the current user to view them.</p>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="kyc-select">Select KYC Team Member</Label>
                    <Select 
                        value={selectedKycUserId} 
                        onValueChange={setSelectedKycUserId}
                        disabled={isTransferring || isFetchingUsers || isAlreadyTransferred || kycUsers.length === 0}
                    >
                        <SelectTrigger id="kyc-select" className="w-full">
                            <SelectValue placeholder={isFetchingUsers ? "Loading team..." : "Select KYC member"} />
                        </SelectTrigger>
                        <SelectContent>
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

                {transferError && (
                    <div className="text-sm p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        <p className="font-bold">Transfer Error:</p>
                        <p>{transferError}</p>
                    </div>
                )}

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
    const { toast } = useToast();
    
    // State management for lead and user 
    const [lead, setLead] = useState<Lead | null>(null)
    const [editableLeadData, setEditableLeadData] = useState<Partial<Lead>>({})
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSavingDetails, setIsSavingDetails] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    
    // Placeholder for timeline data (TimelineView expects this)
    const [timelineData, setTimelineData] = useState<any[]>([]) 

    // Fetch Lead Data
    const fetchData = useCallback(async (initialLoad = true) => {
        if (initialLoad) setLoading(true)
        setError(null)
        
        // Fetch current user details
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) {
            console.error('User fetch error:', userError)
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
            setEditableLeadData({})
        } else {
            const lead = leadData as Lead
            setLead(lead)
            // Initialize editable data with fetched data
            setEditableLeadData(lead)
            // Example timeline data entry
            setTimelineData([
                { id: 1, type: 'status_change', message: `Lead created as ${lead.status}`, timestamp: lead.created_at },
            ])
        }
        
        if (initialLoad) setLoading(false)
    }, [leadId, supabase])

    useEffect(() => {
        fetchData(true)
        
        // Setup Real-time Listener for the specific lead to keep the view updated
        const channel = supabase.channel(`lead_${leadId}_changes`);

        const subscription = channel
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
            (payload) => {
              console.log("Real-time update received for lead:", payload.new);
              const updatedLead = payload.new as Lead
              setLead(updatedLead);
              // Only update editable state if we aren't currently editing (to prevent overriding unsaved changes)
              if (!isSavingDetails) {
                 setEditableLeadData(updatedLead);
              }
            }
          )
          .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);


    // Handle input changes for editable fields
    const handleInputChange = useCallback((field: keyof Lead, value: string | number | null) => {
        setEditableLeadData(prev => ({
            ...prev,
            [field]: value
        }))
    }, []);

    // Handle Lead Detail Update (The SAVE function)
    const handleUpdateDetails = useCallback(async () => {
        if (!editableLeadData.id) return;

        setIsSavingDetails(true);
        const { 
            name, email, phone, company, designation, priority, 
            loan_amount, loan_type 
        } = editableLeadData;

        // Prepare the payload (ensure loan_amount is a number or null)
        const payload = {
            name, 
            email, 
            phone, 
            company, 
            designation, 
            priority,
            loan_amount: loan_amount ? Number(loan_amount) : null, // Convert to number
            loan_type,
            updated_at: new Date().toISOString()
        }

        const { error } = await supabase
            .from('leads')
            .update(payload)
            .eq('id', editableLeadData.id);

        setIsSavingDetails(false);

        if (error) {
            console.error('Error updating lead details:', error);
            toast({
                title: "Update Failed",
                description: `Error saving details: ${error.message}`,
                variant: "destructive",
            });
        } else {
            // Update successful, refetch/rely on real-time listener for full state refresh
            toast({
                title: "Details Saved",
                description: "Lead information updated successfully.",
            });
        }
    }, [editableLeadData, supabase, toast]);


    const handleTransferSuccess = (kycUserId: string) => {
        // Optimistically update local state after successful DB operation
        const newLead = { 
            ...(lead as Lead), 
            status: STATUSES.TRANSFERRED_TO_KYC, 
            kyc_assigned_to: kycUserId 
        }
        setLead(newLead);
        setEditableLeadData(newLead);
    };

    const handleStatusUpdate = useCallback(async (newStatus: string) => {
        if (!lead || newStatus === lead.status) return;
        
        setIsUpdatingStatus(true);
        
        const { error } = await supabase
            .from('leads')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', lead.id);

        setIsUpdatingStatus(false);

        if (error) {
            console.error('Error updating status:', error);
            toast({
                title: "Status Update Failed",
                description: "Could not update status. Please try again.",
                variant: "destructive",
            });
        }
        // Real-time listener handles state update on success
    }, [lead, supabase, toast]);


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

    const isTransferred = lead.status === STATUSES.TRANSFERRED_TO_KYC;
    const isSaveDisabled = isSavingDetails || isTransferred;
    const saveButtonColor = isSaveDisabled ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700';
    
    // Helper for rendering editable fields
    const EditableDetailInput = ({ field, label, type = 'text', icon }: { field: keyof Lead, label: string, type?: 'text' | 'email' | 'tel' | 'number', icon: React.ReactNode }) => (
        <div className="space-y-1">
            <Label htmlFor={field as string} className="text-sm font-medium text-gray-700 flex items-center gap-1">
                {icon}
                {label}
            </Label>
            <Input
                id={field as string}
                type={type}
                value={editableLeadData[field] as string || ''}
                onChange={(e) => handleInputChange(field, type === 'number' ? e.target.valueAsNumber : e.target.value)}
                className="bg-white"
                disabled={isTransferred || isSavingDetails}
            />
        </div>
    );


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

            {/* Main Content Grid (Old Layout: 2/3 Left, 1/3 Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Lead Details (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Editable Details Card */}
                    <Card className="shadow-lg border-2 border-purple-100">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-purple-700">
                                <UserCheck className="h-5 w-5" />
                                Editable Lead Information
                            </CardTitle>
                            <Button 
                                onClick={handleUpdateDetails} 
                                disabled={isSaveDisabled}
                                className={saveButtonColor}
                            >
                                {isSavingDetails ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                {isSavingDetails ? 'Saving...' : 'Save Details'}
                            </Button>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Editable Fields */}
                            <EditableDetailInput field="name" label="Full Name" icon={<UserCheck className="h-4 w-4 text-gray-500" />} />
                            <EditableDetailInput field="phone" label="Phone" type="tel" icon={<Phone className="h-4 w-4 text-gray-500" />} />
                            <EditableDetailInput field="email" label="Email" type="email" icon={<Mail className="h-4 w-4 text-gray-500" />} />
                            
                            <EditableDetailInput field="company" label="Company" icon={<UserCheck className="h-4 w-4 text-gray-500" />} />
                            <EditableDetailInput field="designation" label="Designation" icon={<UserCheck className="h-4 w-4 text-gray-500" />} />
                            
                            {/* Editable Loan/Priority Fields */}
                            <div className="space-y-1">
                                <Label htmlFor="loan_amount" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <Badge className="h-4 w-4 text-gray-500" />
                                    Loan Amount (INR)
                                </Label>
                                <Input
                                    id="loan_amount"
                                    type="number"
                                    value={editableLeadData.loan_amount || ''}
                                    onChange={(e) => handleInputChange('loan_amount', e.target.valueAsNumber)}
                                    className="bg-white"
                                    disabled={isTransferred || isSavingDetails}
                                />
                            </div>

                            <EditableDetailInput field="loan_type" label="Loan Type" icon={<Badge className="h-4 w-4 text-gray-500" />} />
                            
                            {/* Priority Select */}
                            <div className="space-y-1">
                                <Label htmlFor="priority" className="text-sm font-medium text-gray-700">Priority</Label>
                                <Select 
                                    value={editableLeadData.priority || 'medium'} 
                                    onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => handleInputChange('priority', value)}
                                    disabled={isTransferred || isSavingDetails}
                                >
                                    <SelectTrigger id="priority" className="w-full bg-white">
                                        <SelectValue placeholder="Select Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITY_OPTIONS.map(p => (
                                            <SelectItem key={p} value={p} className={`capitalize ${p === 'urgent' ? 'text-red-600 font-semibold' : ''}`}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Read-Only Fields */}
                            <DetailItem label="Lead Source" value={lead.source || 'N/A'} />
                            <DetailItem label="Assigned Telecaller ID" value={lead.assigned_to ? lead.assigned_to.substring(0, 8) + '...' : 'Unassigned'} />
                            {/* KYC ASSIGNMENT COLUMN (Read-only) */}
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
                                    <TimelineView data={timelineData} /> 
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Notes & Comments</CardTitle></CardHeader>
                                <CardContent>
                                    <LeadNotes leadId={lead.id} userId={user?.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="calls">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Call History</CardTitle></CardHeader>
                                <CardContent>
                                    <LeadCallHistory leadId={lead.id} userId={user?.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="followups">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Follow-ups</CardTitle></CardHeader>
                                <CardContent>
                                    <FollowUpsList leadId={lead.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                </div>

                {/* Right Column: Status & Transfer (1/3 width) */}
                <div className="lg:col-span-1 space-y-6">
                    
                    {/* Status Update Component (Inline) */}
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
                                <Select 
                                    value={lead.status} 
                                    onValueChange={handleStatusUpdate}
                                    disabled={isUpdatingStatus}
                                >
                                    <SelectTrigger id="status-select" className="w-full">
                                        <SelectValue placeholder="Select a new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(status => (
                                            <SelectItem key={status} value={status} className={status === lead.status ? "font-bold bg-gray-100" : ""}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                className="w-full bg-purple-600 hover:bg-purple-700 transition-colors" 
                                disabled={isUpdatingStatus || lead.status === STATUSES.TRANSFERRED_TO_KYC}
                                onClick={() => handleStatusUpdate(lead.status)} // Trigger update on current selection
                            >
                                {isUpdatingStatus ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving Status...
                                    </>
                                ) : (
                                    "Save Status"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* KYC Lead Transfer Module: Show only when Login is Done */}
                    {lead.status === STATUSES.LOGIN_DONE || lead.status === STATUSES.TRANSFERRED_TO_KYC ? (
                        <LeadTransferModule 
                            lead={lead} 
                            onTransferSuccess={handleTransferSuccess}
                        />
                    ) : (
                        <Card className="shadow-md border-2 border-gray-200 bg-gray-50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg text-gray-700">
                                    <Send className="h-5 w-5" />
                                    Lead Transfer
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    The **Transfer to KYC** option becomes available when the lead status is **Login Done**.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    
                </div>
            </div>
        </div>
    )
}
