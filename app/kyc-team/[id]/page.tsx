"use client";

// --- MOCK IMPORTS (Restored due to previous compilation errors) ---
// In your local environment, replace these with your actual imports:
// import { createClient } from "@/lib/supabase/client";
// import { useRouter } from "next/navigation";
import { createClient } from "mock-supabase-client"; // Mocked
import { useRouter } from "mock-next-navigation"; // Mocked
// ------------------------------------------------------------------

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input for editing
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageSquare, ArrowLeft, Clock, Save, User, DollarSign, Loader2, XCircle, Briefcase, Banknote, Edit } from "lucide-react"; 
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Assuming a toast library is available for notifications (like react-hot-toast)

// --- 1. CONSTANTS AND UTILITIES ---

const STATUSES = {
    LOGIN_DONE: "Login Done",
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "Disbursed",
} as const;

const STATUS_OPTIONS = Object.values(STATUSES);

// Updated Lead interface to include all requested fields
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
  pan_number: string | null;
  residence_address: string | null;
  permanent_address: string | null;
  office_address: string | null;
  application_number: string | null;
  nth_salary: number | null;
  office_mail_id: string | null;
  disbursed_amount: number | null;
  roi_percentage: number | null;
  tenure: number | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  marital_status: 'Married' | 'Unmarried' | 'Divorced' | 'Widowed' | null;
  residence_type: 'Self Owned' | 'Rented' | 'Company Provided' | null;
  experience_years: number | null;
  occupation: 'Private' | 'Government' | 'Public' | 'Self-Employed' | null;
  alternative_mobile_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  telecaller_name: string | null;
}

const formatCurrency = (value: number | null) => {
    if (value === null || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value));
};

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

// --- MOCK DATA AND MOCK IMPORTS ---

const MOCK_LEAD_DATA: Lead = {
  id: "lead-45678",
  name: "Priya Sharma",
  email: null, // Set to null/empty for demonstration
  phone: "9876543210",
  company: "Tech Solutions Pvt Ltd",
  designation: "Senior Software Engineer",
  source: "Website Form",
  status: STATUSES.LOGIN_DONE, // Starting status
  priority: "high",
  assigned_to: "user-12345",
  created_at: new Date(Date.now() - 86400000).toISOString(),
  updated_at: new Date().toISOString(),
  loan_amount: 500000,
  loan_type: "Personal Loan",
  address: "123, Residency Road, Bengaluru",
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  zip_code: "560001",
  pan_number: null, // Missing data
  residence_address: "Apartment 301, Sector 4, Noida", 
  permanent_address: null, // Missing data
  office_address: "Global Tech Park, Outer Ring Road, Bengaluru",
  application_number: "PL4567890",
  nth_salary: 75000,
  office_mail_id: "psharma@techsolutions.com",
  disbursed_amount: null, // Missing data
  roi_percentage: 12.5,
  tenure: 36,
  gender: null, // Missing data
  marital_status: 'Married',
  residence_type: null, // Missing data
  experience_years: 5,
  occupation: 'Private',
  alternative_mobile_number: null, // Missing data
  bank_name: 'HDFC Bank',
  account_number: '50100123456789',
  telecaller_name: 'Amit Patel',
};

const useRouter = () => ({
  push: (path: string) => console.log(`[MOCK] Navigating to: ${path}`),
  back: () => console.log("[MOCK] Going back..."),
});

const createClient = () => ({
    from: (table: string) => ({
        select: (columns: string) => ({
            eq: () => ({
                single: async () => ({
                    data: MOCK_LEAD_DATA, 
                    error: null,
                }),
            }),
        }),
        update: () => ({
            eq: async () => ({ error: null }),
        }),
    }),
    channel: (name: string) => ({
        on: () => ({
            subscribe: () => ({
                unsubscribe: () => {},
            }),
        }),
    }),
    removeChannel: () => {},
});

// --- 2. EDITABLE DETAIL ITEM COMPONENT ---

interface DetailItemProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    valueClass?: string;
    // New props for editing
    isEditing: boolean;
    fieldName: keyof Lead;
    currentValue: string | number | null;
    onUpdate: (field: keyof Lead, value: string | number) => void;
    inputType?: 'text' | 'number' | 'email' | 'phone' | 'select' | 'textarea';
    options?: { value: string; label: string }[]; // For select inputs
    placeholder?: string;
}

const DetailItem = ({ 
    label, value, icon, valueClass = '', 
    isEditing, fieldName, currentValue, onUpdate, 
    inputType = 'text', options, placeholder
}: DetailItemProps) => {

    const formattedValue = typeof value === 'string' && value === 'N/A' && isEditing ? '' : value;
    
    // Determine the value for the input field
    const displayValue = currentValue !== null && currentValue !== undefined ? String(currentValue) : '';

    const renderInput = () => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
            const newValue = typeof e === 'string' ? e : e.target.value;
            // Handle number conversion for number types
            if (inputType === 'number' && newValue !== '') {
                const numValue = Number(newValue);
                if (!isNaN(numValue)) {
                    onUpdate(fieldName, numValue);
                }
            } else {
                onUpdate(fieldName, newValue);
            }
        };

        const baseProps = {
            className: "text-sm",
            placeholder: placeholder || `Enter ${label}`,
            disabled: !isEditing,
        };

        if (inputType === 'select' && options) {
            return (
                <Select 
                    value={displayValue} 
                    onValueChange={handleChange as (value: string) => void}
                    disabled={!isEditing}
                >
                    <SelectTrigger className="text-sm h-9">
                        <SelectValue placeholder={baseProps.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (inputType === 'textarea') {
            return (
                <Textarea
                    {...baseProps}
                    rows={2}
                    value={displayValue}
                    onChange={handleChange as (e: React.ChangeEvent<HTMLTextAreaElement>) => void}
                />
            );
        }

        return (
            <Input
                {...baseProps}
                type={inputType === 'phone' ? 'tel' : inputType}
                value={displayValue}
                onChange={handleChange as (e: React.ChangeEvent<HTMLInputElement>) => void}
            />
        );
    };

    return (
        <div className="flex flex-col space-y-1 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                {icon}
                {label}
            </p>
            {isEditing ? (
                renderInput()
            ) : (
                <span className={`text-sm text-gray-800 break-words ${valueClass}`}>
                    {formattedValue}
                </span>
            )}
        </div>
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
  const [editableLead, setEditableLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // New editing state
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchLead = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Mocked data fetch
    const { data, error } = await supabase
      .from('leads')
      .select('...')
      .eq('id', leadId)
      .single();

    if (error) {
      console.error("MOCK: Error fetching lead:", error);
      setError(`Lead not found or error fetching data: ${error.message}`);
      setLead(null);
    } else {
      const leadData: Lead = {
          ...(data as Lead),
          residence_address: data.residence_address || data.address,
      }
      setLead(leadData);
      setEditableLead(leadData); // Initialize editable state
    }
    setIsLoading(false);
  }, [leadId, supabase]);

  useEffect(() => {
    fetchLead();
    // Real-time listener mock remains
    // ...
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]); 

  const handleStatusUpdate = (newStatus: string) => {
      setLead(prev => (prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : null));
      setEditableLead(prev => (prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : null));
  };
  
  // New handler for updating local editable state
  const handleEditableUpdate = (field: keyof Lead, value: string | number) => {
    setEditableLead(prev => {
        if (!prev) return null;
        return {
            ...prev,
            [field]: value
        };
    });
  };

  // New handler for saving data
  const handleSave = async () => {
    if (!editableLead || isSaving) return;

    setIsSaving(true);
    console.log("MOCK: Attempting to save data to Supabase:", editableLead);

    // Filter out fields that haven't changed (optional optimization)
    // In a real app, you'd send the diff or the whole object

    // Mocked update call
    const { error } = await supabase
        .from('leads')
        .update({ ...editableLead, updated_at: new Date().toISOString() })
        .eq('id', leadId);

    setIsSaving(false);
    setIsEditing(false);

    if (error) {
        console.error("MOCK: Error saving data:", error);
        // Show error toast
    } else {
        console.log("MOCK: Data saved successfully!");
        // Update main lead state from editable state
        setLead(editableLead);
        // Show success toast
    }
  };

  const handleCancel = () => {
    // Revert changes by resetting editableLead from lead state
    setEditableLead(lead);
    setIsEditing(false);
  };


  if (isLoading || !lead) {
    // Use lead or editableLead for initial rendering
    const displayLead = lead || MOCK_LEAD_DATA; 
    
    // Check if we are loading OR if the fetch failed (error)
    if(isLoading || error) {
        return (
            <div className="flex items-center justify-center h-screen">
                {isLoading ? (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        <p className="ml-2 text-lg text-gray-600">Loading Lead Profile...</p>
                    </>
                ) : (
                    <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl">
                        <XCircle className="h-10 w-10 text-red-500 mx-auto" />
                        <h1 className="text-2xl font-bold mt-4 text-red-700">Error Loading Lead</h1>
                        <p className="text-gray-600 mt-2">{error}</p>
                        <Button onClick={() => router.push('/kyc-team/leads')} className="mt-4 bg-purple-600 hover:bg-purple-700">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Leads List
                        </Button>
                    </div>
                )}
            </div>
        );
    }
  }

  // Use editableLead for rendering data
  const displayLead = editableLead as Lead;
  
  // Define select options
  const GENDER_OPTIONS = [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }];
  const MARITAL_STATUS_OPTIONS = [{ value: 'Married', label: 'Married' }, { value: 'Unmarried', label: 'Unmarried' }, { value: 'Divorced', label: 'Divorced' }, { value: 'Widowed', label: 'Widowed' }];
  const RESIDENCE_TYPE_OPTIONS = [{ value: 'Self Owned', label: 'Self Owned' }, { value: 'Rented', label: 'Rented' }, { value: 'Company Provided', label: 'Company Provided' }];
  const OCCUPATION_OPTIONS = [{ value: 'Private', label: 'Private' }, { value: 'Government', label: 'Government' }, { value: 'Public', label: 'Public' }, { value: 'Self-Employed', label: 'Self-Employed' }];

  const baseDetailProps = {
    isEditing,
    onUpdate: handleEditableUpdate,
    placeholder: 'Click Edit to fill data',
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header and Quick Status */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} variant="outline" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{displayLead.name}</h1>
          {getStatusBadge(displayLead.status)}
        </div>
        <div className="flex gap-2">
            {isEditing ? (
                <>
                    <Button 
                        onClick={handleCancel} 
                        variant="outline" 
                        className="border-red-500 text-red-500 hover:bg-red-50"
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        className="bg-green-600 hover:bg-green-700 transition-colors"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Details'}
                    </Button>
                </>
            ) : (
                <Button 
                    onClick={() => setIsEditing(true)} 
                    className="bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Details
                </Button>
            )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Lead Details & Loan Info (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. KYC & Personal Details (Editable) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <User className="h-5 w-5" />
                        KYC & Personal Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Full Name" value={displayLead.name} valueClass="font-semibold" 
                        fieldName="name" currentValue={displayLead.name}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        icon={<Phone className="h-4 w-4 text-gray-500" />} label="Mobile Number" value={displayLead.phone} 
                        fieldName="phone" currentValue={displayLead.phone} inputType="phone"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        icon={<Phone className="h-4 w-4 text-gray-500" />} label="Alternative Mobile" value={displayLead.alternative_mobile_number || 'N/A'} 
                        fieldName="alternative_mobile_number" currentValue={displayLead.alternative_mobile_number} inputType="phone"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        icon={<Mail className="h-4 w-4 text-gray-500" />} label="Personal Email" value={displayLead.email || 'N/A'} 
                        fieldName="email" currentValue={displayLead.email} inputType="email"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="PAN Number" value={displayLead.pan_number || 'N/A'} valueClass="font-mono text-base" 
                        fieldName="pan_number" currentValue={displayLead.pan_number} 
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Gender" value={displayLead.gender || 'N/A'} 
                        fieldName="gender" currentValue={displayLead.gender} inputType="select" options={GENDER_OPTIONS}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Marital Status" value={displayLead.marital_status || 'N/A'} 
                        fieldName="marital_status" currentValue={displayLead.marital_status} inputType="select" options={MARITAL_STATUS_OPTIONS}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Residence Type" value={displayLead.residence_type || 'N/A'} 
                        fieldName="residence_type" currentValue={displayLead.residence_type} inputType="select" options={RESIDENCE_TYPE_OPTIONS}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Telecaller Name" value={displayLead.telecaller_name || 'N/A'} 
                        fieldName="telecaller_name" currentValue={displayLead.telecaller_name}
                    />
                </CardContent>
            </Card>

            {/* 2. Employment & Financial Details (Editable) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <Briefcase className="h-5 w-5" />
                        Employment & Salary Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Company Name" value={displayLead.company || 'N/A'} 
                        fieldName="company" currentValue={displayLead.company}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Occupation" value={displayLead.occupation || 'N/A'} 
                        fieldName="occupation" currentValue={displayLead.occupation} inputType="select" options={OCCUPATION_OPTIONS}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Designation" value={displayLead.designation || 'N/A'} 
                        fieldName="designation" currentValue={displayLead.designation}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Work Experience (Yrs)" value={displayLead.experience_years ? `${displayLead.experience_years} Years` : 'N/A'} 
                        fieldName="experience_years" currentValue={displayLead.experience_years} inputType="number"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        icon={<Mail className="h-4 w-4 text-gray-500" />} label="Office Mail ID" value={displayLead.office_mail_id || 'N/A'} 
                        fieldName="office_mail_id" currentValue={displayLead.office_mail_id} inputType="email"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Net Take Home Salary" value={formatCurrency(displayLead.nth_salary)} valueClass="font-bold text-base text-purple-600" 
                        fieldName="nth_salary" currentValue={displayLead.nth_salary} inputType="number"
                    />
                </CardContent>
            </Card>

            {/* 3. Loan Details (Editable) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <DollarSign className="h-5 w-5" />
                        Loan & Approval Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Application Number" value={displayLead.application_number || 'N/A'} valueClass="font-semibold text-blue-600" 
                        fieldName="application_number" currentValue={displayLead.application_number}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Requested Amount" value={formatCurrency(displayLead.loan_amount)} valueClass="font-bold text-lg text-green-700" 
                        fieldName="loan_amount" currentValue={displayLead.loan_amount} inputType="number"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Disbursed Amount" value={formatCurrency(displayLead.disbursed_amount)} valueClass="font-bold text-lg text-purple-700" 
                        fieldName="disbursed_amount" currentValue={displayLead.disbursed_amount} inputType="number"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Loan Type" value={displayLead.loan_type || 'N/A'} 
                        fieldName="loan_type" currentValue={displayLead.loan_type}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="ROI (Percentage)" value={displayLead.roi_percentage ? `${displayLead.roi_percentage}%` : 'N/A'} 
                        fieldName="roi_percentage" currentValue={displayLead.roi_percentage} inputType="number"
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Tenure (Months)" value={displayLead.tenure ? `${displayLead.tenure} Months` : 'N/A'} 
                        fieldName="tenure" currentValue={displayLead.tenure} inputType="number"
                    />
                    {/* Priority and Assigned To are typically not edited by KYC team */}
                    <DetailItem label="Priority" value={<Badge variant="secondary" className={`capitalize ${displayLead.priority === 'urgent' ? 'bg-red-500 text-white' : displayLead.priority === 'high' ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>{displayLead.priority}</Badge>} />
                    <DetailItem label="Assigned To" value={displayLead.assigned_to ? displayLead.assigned_to.substring(0, 8) + '...' : 'Unassigned'} />
                </CardContent>
            </Card>

            {/* 4. Address Details (Editable) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <MapPin className="h-5 w-5" />
                        Address Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-6">
                    {/* Residence Address */}
                    <div className="p-3 border rounded-lg bg-white shadow-sm">
                        <p className="text-sm font-semibold text-purple-600 mb-1">Residence Address</p>
                        <DetailItem 
                            {...baseDetailProps} 
                            label="" value={displayLead.residence_address || displayLead.address || 'N/A'} 
                            fieldName="residence_address" currentValue={displayLead.residence_address || displayLead.address} inputType="textarea"
                            placeholder='Full residence address line'
                        />
                        {/* Adding City, State, Zip for completeness, can also be editable DetailItems */}
                        <p className="text-xs text-gray-500 mt-1">
                            {displayLead.city}, {displayLead.state} - {displayLead.zip_code} ({displayLead.country})
                        </p>
                    </div>

                    {/* Permanent Address */}
                    <div className="p-3 border rounded-lg bg-white shadow-sm">
                        <p className="text-sm font-semibold text-purple-600 mb-1">Permanent Address</p>
                        <DetailItem 
                            {...baseDetailProps} 
                            label="" value={displayLead.permanent_address || 'N/A'} 
                            fieldName="permanent_address" currentValue={displayLead.permanent_address} inputType="textarea"
                            placeholder='Full permanent address line'
                        />
                    </div>

                    {/* Office Address */}
                    <div className="p-3 border rounded-lg bg-white shadow-sm">
                        <p className="text-sm font-semibold text-purple-600 mb-1">Office Address</p>
                        <DetailItem 
                            {...baseDetailProps} 
                            label="" value={displayLead.office_address || 'N/A'} 
                            fieldName="office_address" currentValue={displayLead.office_address} inputType="textarea"
                            placeholder='Full office address line'
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 5. Bank Details (Editable) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                        <Banknote className="h-5 w-5" />
                        Bank Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Bank Name" value={displayLead.bank_name || 'N/A'} 
                        fieldName="bank_name" currentValue={displayLead.bank_name}
                    />
                    <DetailItem 
                        {...baseDetailProps} 
                        label="Account Number" value={displayLead.account_number || 'N/A'} valueClass="font-mono text-base" 
                        fieldName="account_number" currentValue={displayLead.account_number}
                    />
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Status Updater & Tabs (1/3 width on large screens) */}
        <div className="lg:col-span-1 space-y-6">
            {/* Status Update Component - Status is always editable */}
            <LeadStatusUpdater 
                leadId={displayLead.id} 
                currentStatus={displayLead.status} 
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
                                    <p className="font-semibold">Status changed to {displayLead.status}</p>
                                    <p className="text-xs">{new Date(displayLead.updated_at).toLocaleString()}</p>
                                </div>
                                <div className="p-2 border-l-4 border-gray-300">
                                    <p className="font-semibold">Lead created</p>
                                    <p className="text-xs">{new Date(displayLead.created_at).toLocaleString()}</p>
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
