"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Calendar, MessageSquare, ArrowLeft, Clock, Save, User, DollarSign, Loader2, RefreshCw, XCircle, Building, Home, Briefcase, CreditCard, Edit, Edit2, Edit3 } from "lucide-react";
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

// Priority options
const PRIORITY_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" }
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

// --- 2. EDITABLE FIELD COMPONENTS ---

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  onSave: (value: string | number | null) => void;
  type?: 'text' | 'number' | 'email' | 'tel' | 'textarea';
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
}

const EditableField = ({ 
  label, 
  value, 
  onSave, 
  type = 'text', 
  placeholder = '',
  options,
  className = ''
}: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(type === 'number' && editValue !== '' ? Number(editValue) : editValue);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const displayValue = value || 'N/A';

  return (
    <div className={`flex flex-col space-y-2 p-3 bg-gray-50 rounded-lg ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {options ? (
            <Select value={editValue as string} onValueChange={setEditValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select ${label}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : type === 'textarea' ? (
            <Textarea
              value={editValue as string}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              rows={3}
            />
          ) : (
            <Input
              type={type}
              value={editValue as string}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="w-full"
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800 break-words">{displayValue}</p>
      )}
    </div>
  );
};

// --- 3. INLINE STATUS UPDATER COMPONENT ---

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

// --- 4. MAIN LEAD PROFILE PAGE ---

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
  const [isSaving, setIsSaving] = useState(false);
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

  const updateField = async (field: keyof Lead, value: any) => {
    if (!lead) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ 
        [field]: value,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (error) {
      console.error(`Error updating ${field}:`, error);
      // toast.error(`Failed to update ${field}`);
    } else {
      setLead(prev => prev ? { ...prev, [field]: value } : null);
      // toast.success(`${field.replace('_', ' ')} updated successfully`);
    }
    setIsSaving(false);
  };

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
                    <EditableField 
                        label="Name" 
                        value={lead.name} 
                        onSave={(value) => updateField('name', value)}
                    />
                    <EditableField 
                        label="Phone" 
                        value={lead.phone} 
                        onSave={(value) => updateField('phone', value)}
                        type="tel"
                    />
                    <EditableField 
                        label="Email" 
                        value={lead.email} 
                        onSave={(value) => updateField('email', value)}
                        type="email"
                    />
                    <EditableField 
                        label="Alternative Mobile" 
                        value={lead.alternative_mobile} 
                        onSave={(value) => updateField('alternative_mobile', value)}
                        type="tel"
                    />
                    <EditableField 
                        label="Personal Email" 
                        value={lead.personal_email} 
                        onSave={(value) => updateField('personal_email', value)}
                        type="email"
                    />
                    <EditableField 
                        label="Gender" 
                        value={lead.gender} 
                        onSave={(value) => updateField('gender', value)}
                        options={GENDER_OPTIONS}
                    />
                    <EditableField 
                        label="Marital Status" 
                        value={lead.marital_status} 
                        onSave={(value) => updateField('marital_status', value)}
                        options={MARITAL_STATUS_OPTIONS}
                    />
                    <EditableField 
                        label="PAN Number" 
                        value={lead.pan_number} 
                        onSave={(value) => updateField('pan_number', value)}
                        placeholder="Enter PAN number"
                    />
                    <EditableField 
                        label="Application Number" 
                        value={lead.application_number} 
                        onSave={(value) => updateField('application_number', value)}
                    />
                    <EditableField 
                        label="Telecaller Name" 
                        value={lead.telecaller_name} 
                        onSave={(value) => updateField('telecaller_name', value)}
                    />
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
                    <EditableField 
                        label="Company" 
                        value={lead.company} 
                        onSave={(value) => updateField('company', value)}
                    />
                    <EditableField 
                        label="Designation" 
                        value={lead.designation} 
                        onSave={(value) => updateField('designation', value)}
                    />
                    <EditableField 
                        label="Office Email" 
                        value={lead.office_email} 
                        onSave={(value) => updateField('office_email', value)}
                        type="email"
                    />
                    <EditableField 
                        label="Occupation" 
                        value={lead.occupation} 
                        onSave={(value) => updateField('occupation', value)}
                        options={OCCUPATION_OPTIONS}
                    />
                    <EditableField 
                        label="Experience" 
                        value={lead.experience} 
                        onSave={(value) => updateField('experience', value)}
                        type="number"
                        placeholder="Years of experience"
                    />
                    <EditableField 
                        label="Nth Salary" 
                        value={lead.nth_salary} 
                        onSave={(value) => updateField('nth_salary', value)}
                        type="number"
                        placeholder="Salary amount"
                    />
                    <EditableField 
                        label="Lead Source" 
                        value={lead.source} 
                        onSave={(value) => updateField('source', value)}
                    />
                    <div className="flex flex-col space-y-1 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500">Creation Date</p>
                        <p className="text-sm text-gray-800">{new Date(lead.created_at).toLocaleDateString()}</p>
                    </div>
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
                    <EditableField 
                        label="Loan Amount" 
                        value={lead.loan_amount} 
                        onSave={(value) => updateField('loan_amount', value)}
                        type="number"
                        className="font-bold text-green-700"
                    />
                    <EditableField 
                        label="Disbursed Amount" 
                        value={lead.disbursed_amount} 
                        onSave={(value) => updateField('disbursed_amount', value)}
                        type="number"
                        className="font-bold text-blue-700"
                    />
                    <EditableField 
                        label="Loan Type" 
                        value={lead.loan_type} 
                        onSave={(value) => updateField('loan_type', value)}
                    />
                    <EditableField 
                        label="ROI" 
                        value={lead.roi} 
                        onSave={(value) => updateField('roi', value)}
                        type="number"
                        placeholder="Rate of interest"
                    />
                    <EditableField 
                        label="Tenure" 
                        value={lead.tenure} 
                        onSave={(value) => updateField('tenure', value)}
                        type="number"
                        placeholder="Months"
                    />
                    <EditableField 
                        label="Priority" 
                        value={lead.priority} 
                        onSave={(value) => updateField('priority', value)}
                        options={PRIORITY_OPTIONS}
                    />
                    <div className="flex flex-col space-y-1 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500">Assigned To</p>
                        <p className="text-sm text-gray-800">{lead.assigned_to ? lead.assigned_to.substring(0, 8) + '...' : 'Unassigned'}</p>
                    </div>
                    <div className="flex flex-col space-y-1 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500">Current Status</p>
                        <div className="flex items-center">
                            {getStatusBadge(lead.status)}
                        </div>
                    </div>
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
                    <EditableField 
                        label="Bank Name" 
                        value={lead.bank_name} 
                        onSave={(value) => updateField('bank_name', value)}
                    />
                    <EditableField 
                        label="Account Number" 
                        value={lead.account_number} 
                        onSave={(value) => updateField('account_number', value)}
                        type="text"
                        placeholder="Bank account number"
                    />
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
                    <EditableField 
                        label="Residence Address" 
                        value={lead.residence_address} 
                        onSave={(value) => updateField('residence_address', value)}
                        type="textarea"
                    />
                    <EditableField 
                        label="Permanent Address" 
                        value={lead.permanent_address} 
                        onSave={(value) => updateField('permanent_address', value)}
                        type="textarea"
                    />
                    <EditableField 
                        label="Office Address" 
                        value={lead.office_address} 
                        onSave={(value) => updateField('office_address', value)}
                        type="textarea"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <EditableField 
                            label="Residence Type" 
                            value={lead.residence_type} 
                            onSave={(value) => updateField('residence_type', value)}
                            options={RESIDENCE_TYPE_OPTIONS}
                        />
                        <EditableField 
                            label="City" 
                            value={lead.city} 
                            onSave={(value) => updateField('city', value)}
                        />
                        <EditableField 
                            label="State" 
                            value={lead.state} 
                            onSave={(value) => updateField('state', value)}
                        />
                        <EditableField 
                            label="Country" 
                            value={lead.country} 
                            onSave={(value) => updateField('country', value)}
                        />
                        <EditableField 
                            label="ZIP Code" 
                            value={lead.zip_code} 
                            onSave={(value) => updateField('zip_code', value)}
                        />
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

            {/* Activity Tabs */}
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="notes">Notes/Calls</TabsTrigger>
                </TabsList>
                
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
