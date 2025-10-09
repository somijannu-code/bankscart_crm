"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, User, DollarSign, Loader2, RefreshCw, XCircle, Building, Home, Briefcase, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Assuming a toast library is available for notifications (like react-hot-toast)

// --- 1. CONSTANTS AND UTILITIES ---

// Define the available statuses for the loan lifecycle
const STATUSES = {
    LOGIN_DONE: "Login Done",
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "Disbursed",
} as const;

// All possible status values for the Select component
const STATUS_OPTIONS = Object.values(STATUSES);

// Gender options
const GENDER_OPTIONS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" }
] as const;

// Marital status options
const MARITAL_STATUS_OPTIONS = [
    { value: "married", label: "Married" },
    { value: "unmarried", label: "Unmarried" }
] as const;

// Residence type options
const RESIDENCE_TYPE_OPTIONS = [
    { value: "self_owned", label: "Self Owned" },
    { value: "rented", label: "Rented" },
    { value: "company_provided", label: "Company Provided" }
] as const;

// Occupation options
const OCCUPATION_OPTIONS = [
    { value: "private", label: "Private" },
    { value: "government", label: "Government" },
    { value: "public", label: "Public" }
] as const;

// Lead interface based on your full schema
interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  designation: string | null;
  source: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  loan_amount: number | null;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  
  // New fields
  pan_number: string | null;
  residence_address: string | null;
  permanent_address: string | null;
  office_address: string | null;
  application_number: string | null;
  nth_salary: number | null;
  office_email: string | null;
  personal_email: string | null;
  disbursed_amount: number | null;
  roi: number | null;
  tenure: number | null;
  gender: string | null;
  marital_status: string | null;
  residence_type: string | null;
  experience: number | null;
  occupation: string | null;
  alternative_mobile: string | null;
  bank_name: string | null;
  account_number: string | null;
  telecaller_name: string | null;
}

// Utility to format currency
const formatCurrency = (value: number | null) => {
    if (value === null || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value));
};

// Utility to format percentage
const formatPercentage = (value: number | null) => {
    if (value === null || isNaN(Number(value))) return "N/A";
    return `${value}%`;
};

// Utility to get the status badge style
const getStatusBadge = (status: string) => {
    switch (status) {
        case STATUSES.LOGIN_DONE:
            return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Login Done</Badge>;
        case STATUSES.UNDERWRITING:
            return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Underwriting</Badge>;
        case STATUSES.REJECTED:
            return <Badge className="bg-red-600 text-white hover:bg-red-700">Rejected</Badge>;
        case STATUSES.APPROVED:
            return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
        case STATUSES.DISBURSED:
            return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Disbursed</Badge>;
        default:
            return <Badge variant="secondary">New</Badge>;
    }
};

// --- 2. INLINE STATUS UPDATER COMPONENT ---

interface LeadStatusUpdaterProps {
    leadId: string;
    currentStatus: string;
    onStatusUpdate: (newStatus: string) => void;
}

const LeadStatusUpdater = ({ leadId, currentStatus, onStatusUpdate }: LeadStatusUpdaterProps) => {
    const [newStatus, setNewStatus] = useState(currentStatus);
    const [isUpdating, setIsUpdating] = useState(false);
    const supabase = createClient();

    // Reset status selector if parent component updates currentStatus (e.g., from real-time listener)
    useEffect(() => {
        setNewStatus(currentStatus);
    }, [currentStatus]);

    const handleUpdate = useCallback(async () => {
        if (newStatus === currentStatus) {
            return;
        }

        setIsUpdating(true);
        // Note: For KYC users, we only allow updates to certain statuses. 
        // We rely on RLS/Postgres policies to enforce which user can update which status.
        const { error } = await supabase
            .from('leads')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        
        setIsUpdating(false);

        if (error) {
            console.error("Error updating status:", error);
            // toast.error("Failed to update status. Please try again.");
            setNewStatus(currentStatus); 
        } else {
            // toast.success(`Status updated to ${newStatus}`);
            onStatusUpdate(newStatus); 
        }
    }, [newStatus, currentStatus, leadId, supabase, onStatusUpdate]);

    const isSaveDisabled = isUpdating || newStatus === currentStatus;

    return (
        <Card className="shadow-lg border-2 border-purple-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-purple-700">
                    <Clock className="h-5 w-5" />
                    Update Loan Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <Label htmlFor="status-select" className="min-w-[80px]">Current Status:</Label>
                    <div className="flex-grow">
                        {getStatusBadge(currentStatus)}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Label htmlFor="status-select" className="min-w-[80px]">Set New Status:</Label>
                    <Select 
                        value={newStatus} 
                        onValueChange={setNewStatus}
                        disabled={isUpdating}
                    >
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
                <Button 
                    onClick={handleUpdate} 
                    disabled={isSaveDisabled}
                    className="w-full bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                    {isUpdating ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Status Change
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

// --- 3. MAIN LEAD PROFILE PAGE ---

interface LeadProfilePageProps {
  params: {
    id: string;
  };
}

export default function KycLeadProfilePage({ params }: LeadProfilePageProps) {
  const router = useRouter();
  const leadId = params.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchLead = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Fetch all columns from the lead table including new fields
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id, name, email, phone, company, designation, source, 
        status, priority, assigned_to, created_at, updated_at, 
        loan_amount, loan_type, address, city, state, country, zip_code,
        pan_number, residence_address, permanent_address, office_address,
        application_number, nth_salary, office_email, personal_email,
        disbursed_amount, roi, tenure, gender, marital_status, residence_type,
        experience, occupation, alternative_mobile, bank_name, account_number,
        telecaller_name
      `)
      .eq('id', leadId)
      .single();

    if (error) {
      console.error("Error fetching lead:", error);
      setError(`Lead not found or error fetching data: ${error.message}`);
      setLead(null);
    } else {
      setLead(data as Lead);
    }
    setIsLoading(false);
  }, [leadId, supabase]);

  useEffect(() => {
    fetchLead();

    // Setup Real-time Listener for the specific lead to update status automatically
    const channel = supabase.channel(`lead_${leadId}_changes`);

    const subscription = channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
        (payload) => {
          console.log("Real-time update received for lead:", payload.new);
          // Only update the state with new data, which is most important for status
          setLead(prev => ({ ...(prev as Lead), ...(payload.new as Lead) }));
        }
      )
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]); 

  const handleStatusUpdate = (newStatus: string) => {
      // Update the local state instantly after successful update from LeadStatusUpdater
      setLead(prev => (prev ? { ...prev, status: newStatus } : null));
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <p className="ml-2 text-lg text-gray-600">Loading Lead Profile...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl">
        <XCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold mt-4 text-red-700">Error Loading Lead</h1>
        <p className="text-gray-600 mt-2">{error || "The requested lead could not be found."}</p>
        <Button onClick={() => router.push('/kyc-team/leads')} className="mt-4 bg-purple-600 hover:bg-purple-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads List
        </Button>
      </div>
    );
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
        
        {/* Left Column: Lead Details & Loan Info (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Personal and Contact Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <User className="h-5 w-5" />
                        Personal & Contact Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem icon={<Phone className="h-4 w-4 text-gray-500" />} label="Phone" value={lead.phone} />
                    <DetailItem icon={<Mail className="h-4 w-4 text-gray-500" />} label="Email" value={lead.email || 'N/A'} />
                    <DetailItem label="Alternative Mobile" value={lead.alternative_mobile || 'N/A'} />
                    <DetailItem label="Personal Email" value={lead.personal_email || 'N/A'} />
                    <DetailItem label="Gender" value={lead.gender ? lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1) : 'N/A'} />
                    <DetailItem label="Marital Status" value={lead.marital_status ? lead.marital_status.charAt(0).toUpperCase() + lead.marital_status.slice(1) : 'N/A'} />
                    <DetailItem label="PAN Number" value={lead.pan_number || 'N/A'} />
                    <DetailItem label="Application Number" value={lead.application_number || 'N/A'} />
                    <DetailItem label="Telecaller Name" value={lead.telecaller_name || 'N/A'} />
                </CardContent>
            </Card>

            {/* Professional Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <Briefcase className="h-5 w-5" />
                        Professional Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem label="Company" value={lead.company || 'N/A'} />
                    <DetailItem label="Designation" value={lead.designation || 'N/A'} />
                    <DetailItem label="Office Email" value={lead.office_email || 'N/A'} />
                    <DetailItem label="Occupation" value={lead.occupation ? lead.occupation.charAt(0).toUpperCase() + lead.occupation.slice(1) : 'N/A'} />
                    <DetailItem label="Experience" value={lead.experience ? `${lead.experience} years` : 'N/A'} />
                    <DetailItem label="Nth Salary" value={lead.nth_salary ? formatCurrency(lead.nth_salary) : 'N/A'} />
                    <DetailItem label="Lead Source" value={lead.source || 'N/A'} />
                    <DetailItem label="Creation Date" value={new Date(lead.created_at).toLocaleDateString()} />
                </CardContent>
            </Card>

            {/* Loan Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <DollarSign className="h-5 w-5" />
                        Loan & Financial Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem label="Loan Amount" value={formatCurrency(lead.loan_amount)} valueClass="font-bold text-lg text-green-700" />
                    <DetailItem label="Disbursed Amount" value={formatCurrency(lead.disbursed_amount)} valueClass="font-bold text-lg text-blue-700" />
                    <DetailItem label="Loan Type" value={lead.loan_type || 'N/A'} />
                    <DetailItem label="ROI" value={formatPercentage(lead.roi)} />
                    <DetailItem label="Tenure" value={lead.tenure ? `${lead.tenure} months` : 'N/A'} />
                    <DetailItem label="Priority" value={<Badge variant="secondary" className={`capitalize ${lead.priority === 'urgent' ? 'bg-red-500 text-white' : lead.priority === 'high' ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>{lead.priority}</Badge>} />
                    <DetailItem label="Assigned To" value={lead.assigned_to ? lead.assigned_to.substring(0, 8) + '...' : 'Unassigned'} />
                    <DetailItem label="Current Status" value={getStatusBadge(lead.status)} valueClass="flex items-center" />
                </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <CreditCard className="h-5 w-5" />
                        Bank Account Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem label="Bank Name" value={lead.bank_name || 'N/A'} />
                    <DetailItem label="Account Number" value={lead.account_number ? '••••' + lead.account_number.slice(-4) : 'N/A'} />
                </CardContent>
            </Card>

            {/* Address Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <MapPin className="h-5 w-5" />
                        Address Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">Residence Address</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {lead.residence_address || 'N/A'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">Permanent Address</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {lead.permanent_address || 'N/A'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">Office Address</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {lead.office_address || 'N/A'}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <DetailItem label="Residence Type" value={lead.residence_type ? lead.residence_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'N/A'} />
                        <DetailItem label="City" value={lead.city || 'N/A'} />
                        <DetailItem label="State" value={lead.state || 'N/A'} />
                        <DetailItem label="Country" value={lead.country || 'N/A'} />
                        <DetailItem label="ZIP Code" value={lead.zip_code || 'N/A'} />
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Status Updater & Tabs (1/3 width on large screens) */}
        <div className="lg:col-span-1 space-y-6">
            {/* Status Update Component */}
            <LeadStatusUpdater 
                leadId={lead.id} 
                currentStatus={lead.status} 
                onStatusUpdate={handleStatusUpdate}
            />

            {/* Activity Tabs (Simplified stubs) */}
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="notes">Notes/Calls</TabsTrigger>
                </TabsList>
                
                {/* Timeline Content Stub */}
                <TabsContent value="timeline">
                    <Card>
                        <CardHeader>
                            <CardTitle>Activity Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-gray-500 space-y-2">
                                <div className="p-2 border-l-4 border-purple-400">
                                    <p className="font-semibold">Status changed to {lead.status}</p>
                                    <p className="text-xs">{new Date(lead.updated_at).toLocaleString()}</p>
                                </div>
                                <div className="p-2 border-l-4 border-gray-300">
                                    <p className="font-semibold">Lead created</p>
                                    <p className="text-xs">{new Date(lead.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notes/Calls Content Stub */}
                <TabsContent value="notes">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Notes & Follow-ups
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-500">
                                Feature coming soon: Add notes, call logs, and follow-ups.
                            </p>
                            <Textarea placeholder="Add a quick note..." className="mt-3" rows={3} />
                            <Button size="sm" className="mt-2 w-full bg-purple-600 hover:bg-purple-700">Save Note</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
      </div>
    </div>
  );
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
