"use client";

import { useState, useEffect } from "react"
// Removed: import Link from "next/link" - Using simple <a> tag instead
// Removed: import { createClient } from "@/lib/supabase/client" - Using mock client/database constants
import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download, Trash2, // Added Trash2 icon for delete
  MoreHorizontal, Check, X, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
// Removed: import { LeadStatusDialog } from "@/components/lead-status-dialog" - Using basic placeholder function
// Removed: import { QuickActions } from "@/components/quick-actions" - Using basic placeholder function
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// Removed: import { useTelecallerStatus } from "@/hooks/use-telecaller-status" - Using placeholder status
// IMPORTANT: You need to import a multi-select component here.
// For example: import { MultiSelect } from "@/components/ui/multi-select"; 

// --- MOCK/PLACEHOLDER IMPORTS FOR COMPILATION ---
// Using Firebase imports for persistent storage as per guidelines
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, 
  collection, query, where, addDoc, getDocs 
} from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Placeholder components/hooks to prevent errors
const LeadStatusDialog = ({ open, onOpenChange, onStatusUpdate, leadId, currentStatus, isCallInitiated, onCallLogged }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h3 className="font-bold text-lg">Update Status for Lead {leadId}</h3>
        <p className="text-sm text-gray-500 my-2">Current Status: <span className="font-semibold">{currentStatus}</span></p>
        {isCallInitiated && <p className="text-red-500 mb-4">Call initiated! Log the outcome.</p>}
        <Button onClick={() => onStatusUpdate('contacted')} className="w-full mt-2">Set to Contacted</Button>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full mt-2">Close</Button>
      </div>
    </div>
  );
};
const QuickActions = ({ phone, email, leadId, onCallInitiated }: any) => (
  <div className="flex gap-1 items-center">
    <a href={`tel:${phone}`} onClick={onCallInitiated} className="p-1 rounded hover:bg-gray-100" title="Call">
      <Phone className="h-4 w-4 text-blue-600" />
    </a>
    <a href={`mailto:${email}`} className="p-1 rounded hover:bg-gray-100" title="Email">
      <Mail className="h-4 w-4 text-green-600" />
    </a>
  </div>
);
const useTelecallerStatus = (telecallerIds: string[]) => ({
  telecallerStatus: telecallerIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
  loading: false
});

// --- FIREBASE INITIALIZATION ---
let app: any;
let db: any;
let auth: any;

try {
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Security Rule helper
const getPrivateCollectionRef = (collectionName: string, userId: string) => {
  if (!db) return null;
  return collection(db, 'artifacts', appId, 'users', userId, collectionName);
};

// --- END MOCK/PLACEHOLDER IMPORTS ---

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  priority: string
  created_at: string
  last_contacted: string | null
  loan_amount: number | null
  loan_type: string | null
  source: string | null
  assigned_to: string | null
  assigned_user: {
    id: string
    full_name: string
  } | null
  city: string | null
  follow_up_date: string | null
}

interface LeadsTableProps {
  leads: Lead[]
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadsTable({ leads = [], telecallers = [] }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    contact: true,
    company: true,
    status: true,
    priority: true,
    created: true,
    lastContacted: true,
    loanAmount: true,
    loanType: true,
    source: true,
    assignedTo: true,
    actions: true
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  
  // State for Firebase auth readiness and user ID
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Update state to hold an array of strings
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  
  // 1. Firebase Auth/Init Effect
  useEffect(() => {
    const authenticate = async () => {
      if (!auth) {
        setUserId(crypto.randomUUID());
        setIsAuthReady(true);
        return;
      }
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
          setUserId(currentUser.uid);
        } else {
          setUserId(crypto.randomUUID());
        }
      } catch (error) {
        console.error("Firebase Auth error:", error);
        setUserId(crypto.randomUUID());
      } finally {
        setIsAuthReady(true);
      }
    };

    authenticate();
  }, []); // Run only once on mount

  // Get telecaller status for all telecallers in the leads and telecallers list
  const allTelecallerIds = [
    ...leads.map(lead => lead.assigned_user?.id).filter(Boolean) as string[],
    ...telecallers.map(t => t.id)
  ].filter((id, index, self) => self.indexOf(id) === index) // Remove duplicates

  const { telecallerStatus, loading: statusLoading } = useTelecallerStatus(allTelecallerIds)

  // Add safe value getters
  const getSafeValue = (value: any, defaultValue: string = 'N/A') => {
    return value ?? defaultValue
  }

  // Filter and sort leads (Client-side sorting remains the same)
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchTerm === "" || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.phone.includes(searchTerm) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    const matchesPriority = priorityFilter === "all" || lead.priority === priorityFilter
    const matchesAssignedTo = assignedToFilter === "all" || 
      (assignedToFilter === "unassigned" && !lead.assigned_to) ||
      lead.assigned_to === assignedToFilter
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo
  }).sort((a, b) => {
    let aValue = a[sortField as keyof Lead]
    let bValue = b[sortField as keyof Lead]
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue === null) return sortDirection === 'asc' ? -1 : 1
    if (bValue === null) return sortDirection === 'asc' ? 1 : -1
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / pageSize)
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const [isCallInitiated, setIsCallInitiated] = useState(false) // New state to track if call is initiated

  const handleCallInitiated = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true) // Set to true when call is initiated
  }

  // New function to handle when call is logged
  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false) // Reset the call initiated state
  }

  // NOTE: Switched to Firestore logic
  const updateLeadInFirestore = async (leadId: string, updateData: any) => {
    if (!db || !userId) {
      console.error("Database or User not ready.");
      return;
    }
    const leadRef = doc(getPrivateCollectionRef('leads', userId) as any, leadId);
    await updateDoc(leadRef, updateData);
  }

  // NOTE: Switched to Firestore logic
  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    if (!selectedLead?.id) return
    
    try {
      const updateData: any = { 
        status: newStatus,
        last_contacted: new Date().toISOString()
      }

      // Add note if provided
      if (note && userId) {
        const notesRef = getPrivateCollectionRef('notes', userId);
        if (notesRef) {
          await addDoc(notesRef, {
            lead_id: selectedLead.id,
            note: note,
            note_type: newStatus === "not_eligible" ? "status_change_note" : "follow_up_note",
            created_at: new Date().toISOString()
          });
        }
      }

      // Add callback date if provided for Call Back status
      if (newStatus === "Call_Back" && callbackDate && userId) {
        const followUpsRef = getPrivateCollectionRef('follow_ups', userId);
        if (followUpsRef) {
          await addDoc(followUpsRef, {
            lead_id: selectedLead.id,
            scheduled_date: callbackDate,
            status: "scheduled",
            created_at: new Date().toISOString()
          });
        }
        updateData.follow_up_date = callbackDate
      }
      
      await updateLeadInFirestore(selectedLead.id, updateData);

      console.log(`Status updated for lead ${selectedLead.id} to ${newStatus}`)
      // In a real app with onSnapshot, this reload is not necessary
      // window.location.reload() 
      
    } catch (error) {
      console.error("Error updating lead status:", error)
    }
  }

  // NOTE: Switched to Firestore logic
  const handleAssignLead = async (leadId: string, telecallerId: string) => {
    if (!auth || !userId) {
      console.error("Authentication or User ID not ready.");
      return;
    }
    
    try {
      const assignedById = auth.currentUser?.uid || userId

      const updateData = { 
        assigned_to: telecallerId === "unassigned" ? null : telecallerId,
        assigned_by: assignedById,
        assigned_at: new Date().toISOString()
      }

      await updateLeadInFirestore(leadId, updateData);

      console.log(`Lead ${leadId} assigned to ${telecallerId}`)
      // In a real app with onSnapshot, this reload is not necessary
      // window.location.reload()
      
    } catch (error) {
      console.error("Error assigning lead:", error)
    }
  }

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([])
    } else {
      // Only select leads on the current page for simplicity
      setSelectedLeads(paginatedLeads.map(lead => lead.id))
    }
  }

  // Function to handle bulk assign (Firestore Logic)
  const handleBulkAssign = async () => {
    // Check if any telecallers or leads are selected
    if (bulkAssignTo.length === 0 || selectedLeads.length === 0 || !auth || !userId) return

    try {
      const assignedById = auth.currentUser?.uid || userId
      const telecallerIds = bulkAssignTo; 
      const updates: Promise<void>[] = [];

      // Distribute leads equally among telecallers using round-robin
      selectedLeads.forEach((leadId, index) => {
          const telecallerId = telecallerIds[index % telecallerIds.length];
          
          const updateData = {
              assigned_to: telecallerId,
              assigned_by: assignedById,
              assigned_at: new Date().toISOString()
          };
          
          updates.push(updateLeadInFirestore(leadId, updateData));
      });

      // Execute all updates concurrently
      await Promise.all(updates);

      console.log(`Bulk assigned ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setBulkAssignTo([])
      
    } catch (error) {
      console.error("Error bulk assigning leads:", error)
    }
  }

  // Function to handle bulk status update (Firestore Logic)
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedLeads.length === 0 || !userId) return

    try {
      const updates: Promise<void>[] = [];
      const updateData = { 
        status: bulkStatus,
        last_contacted: new Date().toISOString()
      };

      // Create update promises for all selected leads
      selectedLeads.forEach(leadId => {
        updates.push(updateLeadInFirestore(leadId, updateData));
      });

      // Execute all updates concurrently
      await Promise.all(updates);
      
      console.log(`Bulk updated status for ${selectedLeads.length} leads to ${bulkStatus}`)
      setSelectedLeads([])
      setBulkStatus("")
      
    } catch (error) {
      console.error("Error bulk updating lead status:", error)
    }
  }

  // --- NEW FUNCTION: Bulk Delete (Firestore Logic) ---
  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0 || !db || !userId) return
    
    // WARNING: Using custom modal UI instead of window.confirm
    const confirmed = await new Promise(resolve => {
        // Simple mock for a confirmation modal. Replace with a proper UI modal.
        const confirmation = window.prompt(`Type 'DELETE' to confirm permanent deletion of ${selectedLeads.length} leads:`)
        resolve(confirmation === 'DELETE')
    })

    if (!confirmed) return

    try {
      const leadsRef = getPrivateCollectionRef('leads', userId);
      if (!leadsRef) throw new Error("Leads collection reference is missing.");

      // In Firestore, bulk delete needs to iterate and delete or use batch writes for up to 500 documents.
      // For simplicity here, we assume the user is only deleting the visible page leads (max 500).
      
      const deletePromises: Promise<void>[] = [];
      
      selectedLeads.forEach(leadId => {
        const leadDocRef = doc(leadsRef as any, leadId);
        deletePromises.push(deleteDoc(leadDocRef));
      });
      
      await Promise.all(deletePromises);

      console.log(`Bulk deleted ${selectedLeads.length} leads`)
      setSelectedLeads([])
      
    } catch (error) {
      console.error("Error bulk deleting leads:", error)
      // Provide user feedback about the failure
    }
  }
  
  // --- NEW FUNCTION: Bulk Export (No change needed, client-side) ---
  const handleBulkExport = () => {
    if (selectedLeads.length === 0) {
        // IMPORTANT: Using console log instead of alert()
        console.log("Please select leads to export.")
        return
    }

    // 1. Get the data for the selected leads
    const leadsToExport = leads.filter(lead => selectedLeads.includes(lead.id))

    if (leadsToExport.length === 0) {
        console.warn("No data found for selected leads.")
        return
    }

    // 2. Prepare CSV content
    const headers = [
        "ID", "Name", "Email", "Phone", "Company", "Status", "Priority", 
        "Loan Amount", "Loan Type", "Source", "Assigned To", "Created At", 
        "Last Contacted", "Follow Up Date", "City"
    ]
    
    // Map leads data to CSV rows
    const csvRows = leadsToExport.map(lead => [
        lead.id,
        `"${(lead.name || '').replace(/"/g, '""')}"`, // Handle quotes in text fields
        lead.email || '',
        lead.phone || '',
        `"${(lead.company || '').replace(/"/g, '""')}"`,
        lead.status || '',
        lead.priority || '',
        lead.loan_amount || '',
        lead.loan_type || '',
        lead.source || '',
        lead.assigned_user?.full_name || 'Unassigned',
        lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '',
        lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : 'Never',
        lead.follow_up_date || '',
        lead.city || ''
    ])

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.join(','))
    ].join('\n')

    // 3. Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    console.log(`Exported ${leadsToExport.length} leads to CSV.`)
  }
  // ------------------------------------

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800"
      case "contacted":
        return "bg-yellow-100 text-yellow-800"
      case "Interested":
        return "bg-green-100 text-green-800"
      case "Documents_Sent":
        return "bg-purple-100 text-purple-800"
      case "Login":
        return "bg-orange-100 text-orange-800"
      case "Disbursed":
        return "bg-green-100 text-green-800"
      case "Not_Interested":
        return "bg-red-100 text-red-800"
      case "Call_Back":
        return "bg-indigo-100 text-indigo-800"
      case "not_eligible":
        return "bg-red-100 text-red-800"
      case "nr":
        return "bg-gray-100 text-gray-800"
      case "self_employed":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (!leads) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No leads data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-800">Leads Dashboard</h1>
      <p className="text-sm text-gray-500">User ID: {userId ? userId : 'Authenticating...'}</p>
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-w-[120px] sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="Interested">Interested</SelectItem>
              <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
              <SelectItem value="Login">Login</SelectItem>
              <SelectItem value="Disbursed">Disbursed</SelectItem>
              <SelectItem value="Not_Interested">Not Interested</SelectItem>
              <SelectItem value="Call_Back">Call Back</SelectItem>
              <SelectItem value="not_eligible">Not Eligible</SelectItem>
              <SelectItem value="nr">NR</SelectItem>
              <SelectItem value="self_employed">Self Employed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="min-w-[120px] sm:w-40">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
            <SelectTrigger className="min-w-[120px] sm:w-40">
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {telecallers.map((telecaller) => (
                <SelectItem key={telecaller.id} value={telecaller.id}>
                  <div className="flex items-center gap-2">
                    {/* Status indicator for telecaller */}
                    {telecallerStatus[telecaller.id] !== undefined && (
                      <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                           title={telecallerStatus[telecaller.id] ? 'Checked in' : 'Not checked in'} />
                    )}
                    {telecaller.full_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(visibleColumns).map(([key, value]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  className="capitalize"
                  checked={value}
                  onCheckedChange={(checked) =>
                    setVisibleColumns({ ...visibleColumns, [key]: checked })
                  }
                >
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-800 font-semibold min-w-max">
            {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
          </span>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Status Update */}
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Update status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Documents_Sent">Documents Sent</SelectItem>
                <SelectItem value="Login">Login</SelectItem>
                <SelectItem value="Disbursed">Disbursed</SelectItem>
                <SelectItem value="Not_Interested">Not Interested</SelectItem>
                <SelectItem value="Call_Back">Call Back</SelectItem>
                <SelectItem value="not_eligible">Not Eligible</SelectItem>
                <SelectItem value="nr">NR</SelectItem>
                <SelectItem value="self_employed">Self Employed</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus}
              size="sm"
            >
              Update Status
            </Button>
            
            {/* Bulk Assign (Placeholder for MultiSelect) */}
            <div className="w-40">
              {/* NOTE: This is a simple fallback and does not support multi-select. */}
              <Select
                onValueChange={(value) => {
                  setBulkAssignTo(value ? [value] : []);
                }}
                value={bulkAssignTo.length > 0 ? bulkAssignTo[0] : ""}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassign</SelectItem>
                  {telecallers.map((telecaller) => (
                    <SelectItem key={telecaller.id} value={telecaller.id}>
                      <div className="flex items-center gap-2">
                        {telecallerStatus[telecaller.id] !== undefined && (
                          <div
                            className={`w-2 h-2 rounded-full ${
                              telecallerStatus[telecaller.id] ? "bg-green-500" : "bg-red-500"
                            }`}
                            title={
                              telecallerStatus[telecaller.id]
                                ? "Checked in"
                                : "Not checked in"
                            }
                          />
                        )}
                        {telecaller.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleBulkAssign}
              disabled={bulkAssignTo.length === 0}
              size="sm"
            >
              Assign
            </Button>

            {/* Bulk Export Button */}
            <Button 
              variant="outline"
              onClick={handleBulkExport}
              disabled={selectedLeads.length === 0}
              size="sm"
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            {/* Bulk Delete Button */}
            <Button 
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={selectedLeads.length === 0}
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setSelectedLeads([])}
              size="sm"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky left-0 bg-white z-10">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                  onChange={selectAllLeads}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </TableHead>
              {visibleColumns.name && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSort('name')}
                >
                  Name {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
              )}
              {visibleColumns.contact && <TableHead>Contact</TableHead>}
              {visibleColumns.company && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSort('company')}
                >
                  Company {sortField === 'company' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
              )}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              {visibleColumns.priority && <TableHead>Priority</TableHead>}
              {visibleColumns.loanAmount && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSort('loan_amount')}
                >
                  Loan Amount {sortField === 'loan_amount' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
              )}
              {visibleColumns.loanType && <TableHead>Loan Type</TableHead>}
              {visibleColumns.source && <TableHead>Source</TableHead>}
              {visibleColumns.assignedTo && <TableHead>Assigned To</TableHead>}
              {visibleColumns.created && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSort('created_at')}
                >
                  Created {sortField === 'created_at' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
              )}
              {visibleColumns.lastContacted && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => handleSort('last_contacted')}
                >
                  Last Contacted {sortField === 'last_contacted' && (sortDirection === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                </TableHead>
              )}
              {visibleColumns.actions && <TableHead className="sticky right-0 bg-white z-10">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLeads.map((lead) => (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-gray-50">
                <TableCell className="sticky left-0 bg-white z-10">
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(lead.id)}
                    onChange={() => toggleLeadSelection(lead.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                {visibleColumns.name && (
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <a 
                        href={`#lead-${lead.id}`} // Using an internal hash link placeholder
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                      >
                        {getSafeValue(lead.name, 'Unknown')}
                      </a>
                    </div>
                  </TableCell>
                )}
                {visibleColumns.contact && (
                  <TableCell>
                    <QuickActions
                      phone={getSafeValue(lead.phone, '')}
                      email={getSafeValue(lead.email, '')}
                      leadId={lead.id}
                      onCallInitiated={() => {
                        handleCallInitiated(lead);
                      }}
                    />
                  </TableCell>
                )}
                {visibleColumns.company && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {getSafeValue(lead.company, 'No company')}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.status && (
                  <TableCell>
                    <Badge className={getStatusColor(lead.status)}>
                      {getSafeValue(lead.status, 'unknown').replace("_", " ").toUpperCase()}
                    </Badge>
                  </TableCell>
                )}
                {visibleColumns.priority && (
                  <TableCell>
                    <Badge variant={getPriorityVariant(getSafeValue(lead.priority, 'medium'))}>
                      {getSafeValue(lead.priority, 'medium').toUpperCase()}
                    </Badge>
                  </TableCell>
                )}
                {visibleColumns.loanAmount && (
                  <TableCell>
                    {formatCurrency(lead.loan_amount)}
                  </TableCell>
                )}
                {visibleColumns.loanType && (
                  <TableCell>
                    {getSafeValue(lead.loan_type, 'N/A')}
                  </TableCell>
                )}
                {visibleColumns.source && (
                  <TableCell>
                    {getSafeValue(lead.source, 'N/A')}
                  </TableCell>
                )}
                {visibleColumns.assignedTo && (
                  <TableCell>
                    {lead.assigned_user ? (
                      <div className="flex items-center gap-2">
                        {/* Status indicator for assigned telecaller */}
                        {telecallerStatus[lead.assigned_user.id] !== undefined && (
                          <div className={`w-2 h-2 rounded-full ${telecallerStatus[lead.assigned_user.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                               title={telecallerStatus[lead.assigned_user.id] ? 'Checked in' : 'Not checked in'} />
                        )}
                        {lead.assigned_user.full_name}
                      </div>
                    ) : (
                      <span className="text-gray-500">Unassigned</span>
                    )}
                  </TableCell>
                )}
                {visibleColumns.created && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.lastContacted && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {lead.last_contacted
                        ? new Date(lead.last_contacted).toLocaleDateString()
                        : "Never"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.actions && (
                  <TableCell className="sticky right-0 bg-white z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`#lead-${lead.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedLead(lead)
                          setIsStatusDialogOpen(true)
                        }}>
                          <Check className="mr-2 h-4 w-4" />
                          Update Status
                        </DropdownMenuItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <User className="mr-2 h-4 w-4" />
                              Assign To
                            </DropdownMenuItem>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAssignLead(lead.id, "unassigned")}>
                              Unassign
                            </DropdownMenuItem>
                            {telecallers.map((telecaller) => (
                              <DropdownMenuItem 
                                key={telecaller.id} 
                                onClick={() => handleAssignLead(lead.id, telecaller.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {/* Status indicator for telecaller */}
                                  {telecallerStatus[telecaller.id] !== undefined && (
                                    <div className={`w-2 h-2 rounded-full ${telecallerStatus[telecaller.id] ? 'bg-green-500' : 'bg-red-500'}`} 
                                         title={telecallerStatus[telecaller.id] ? 'Checked in' : 'Not checked in'} />
                                  )}
                                  {telecaller.full_name}
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <Select value={pageSize.toString()} onValueChange={(value) => {
              setPageSize(parseInt(value));
              setCurrentPage(1); // Reset to first page when changing page size
            }}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredLeads.length)} to {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leads found. Try adjusting your filters or upload some leads.
        </div>
      )}
      
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open: boolean) => {
            setIsStatusDialogOpen(open)
            if (!open) setIsCallInitiated(false) // Reset when dialog is closed
          }}
          onStatusUpdate={handleStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={handleCallLogged}
        />
      )}
    </div>
  )
}
