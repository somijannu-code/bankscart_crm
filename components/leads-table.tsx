import { useState, useEffect, useMemo, useCallback } from "react"
// Firebase Imports via CDN URLs for single-file environments
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, doc, updateDoc, deleteDoc, runTransaction, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { 
  User, Building, Calendar, Clock, Eye, Phone, Mail, 
  Search, Filter, ChevronDown, ChevronUp, Download, 
  MoreHorizontal, Check, X, AlertCircle, Trash2, DollarSign, Target, ListChecks, ArrowLeft, ArrowRight
} from "lucide-react"
import { format, isToday, isThisWeek, parseISO, isBefore, subDays, subWeeks, subMonths } from "date-fns";

// --- UI Components Simulation (for self-containment) ---

// Placeholder for Tailwind CSS components (simplified for single-file use)
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string, size?: 'sm' | 'default', disabled?: boolean, onClick?: () => void }> = ({ children, className = '', variant = 'default', size = 'default', disabled = false, ...props }) => {
    let baseStyle = "px-4 py-2 font-semibold rounded-lg transition duration-150 flex items-center justify-center border";
    
    if (size === 'sm') {
        baseStyle = "px-3 py-1 text-sm font-semibold rounded-lg transition duration-150 flex items-center justify-center border";
    }

    switch (variant) {
        case 'outline':
            baseStyle += " bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
            break;
        case 'secondary':
            baseStyle += " bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
            break;
        case 'destructive':
            baseStyle += " bg-red-600 text-white border-red-700 hover:bg-red-700";
            break;
        case 'ghost':
            baseStyle += " bg-transparent text-gray-700 border-transparent hover:bg-gray-100";
            break;
        case 'default':
        default:
            baseStyle += " bg-blue-600 text-white border-blue-700 hover:bg-blue-700";
            break;
    }

    if (disabled) {
        baseStyle = "px-4 py-2 font-semibold rounded-lg transition duration-150 bg-gray-300 text-gray-500 cursor-not-allowed border-none";
    }

    return (
        <button className={`${baseStyle} ${className}`} disabled={disabled} {...props}>
            {children}
        </button>
    );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
        {...props}
    />
);

const Badge: React.FC<{ children: React.ReactNode, variant?: string, className?: string }> = ({ children, variant, className = '' }) => {
    let baseStyle = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (variant) {
        case 'destructive': baseStyle += " bg-red-100 text-red-800"; break;
        case 'default': baseStyle += " bg-yellow-100 text-yellow-800"; break;
        case 'secondary': baseStyle += " bg-gray-100 text-gray-800"; break;
        default: baseStyle += " bg-blue-100 text-blue-800"; break;
    }
    return <span className={`${baseStyle} ${className}`}>{children}</span>;
};

// Simplified Table components
const Table: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => <div className={`w-full ${className}`}><table className="min-w-full divide-y divide-gray-200">{children}</table></div>;
const TableHeader: React.FC<{ children: React.ReactNode, style?: React.CSSProperties }> = ({ children, style }) => <thead className="bg-white" style={style}>{children}</thead>;
const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
const TableRow: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => <tr className={className}>{children}</tr>;
const TableHead: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className = '', onClick }) => <th onClick={onClick} scope="col" className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>{children}</th>;
const TableCell: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => <td className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>;

// Dropdown Menu Components (simplified)
const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="relative inline-block text-left">{children}</div>;
const DropdownMenuTrigger: React.FC<{ children: React.ReactNode, asChild?: boolean }> = ({ children }) => <>{children}</>;
const DropdownMenuContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`absolute right-0 mt-2 w-56 origin-top-right rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20 ${className}`}>
        <div className="py-1">{children}</div>
    </div>
);
const DropdownMenuItem: React.FC<{ children: React.ReactNode, onClick?: () => void, className?: string }> = ({ children, onClick, className = '' }) => (
    <div
        onClick={onClick}
        className={`block px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 ${className}`}
    >
        {children}
    </div>
);
const DropdownMenuCheckboxItem: React.FC<{ children: React.ReactNode, checked: boolean, onCheckedChange: (checked: boolean) => void }> = ({ children, checked, onCheckedChange }) => (
    <div
        className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
        onClick={() => onCheckedChange(!checked)}
    >
        {children}
        <input type="checkbox" checked={checked} readOnly className="rounded text-blue-600 h-4 w-4" />
    </div>
);

// Select Components (simplified)
const Select: React.FC<{ children: React.ReactNode, value: string, onValueChange: (value: string) => void, disabled?: boolean }> = ({ children, value, onValueChange, disabled }) => (
    <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm"
    >
        {children}
    </select>
);
const SelectTrigger: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => <div className={`flex items-center justify-between ${className}`}>{children} <ChevronDown className="h-4 w-4 opacity-50 ml-2" /></div>;
const SelectValue: React.FC<{ placeholder: string }> = ({ placeholder }) => <span>{placeholder}</span>;
const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>; // No visual content needed for simplified select
const SelectItem: React.FC<{ children: React.ReactNode, value: string }> = ({ children, value }) => <option value={value}>{children}</option>;

// Simple Modal (Dialog) Component
const Dialog: React.FC<{ children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void, title: string }> = ({ children, open, onOpenChange, title }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">{title}</h3>
                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-6 w-6" />
                </button>
                {children}
            </div>
        </div>
    );
};

// --- Custom Component Simulations ---

// LeadStatusDialog Simulation
interface LeadStatusDialogProps {
  leadId: string
  currentStatus: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: (newStatus: string, note?: string, callbackDate?: string) => Promise<void>
  isCallInitiated: boolean
  onCallLogged: (callLogId: string) => void // Placeholder: not implemented fully
}

const LeadStatusDialog: React.FC<LeadStatusDialogProps> = ({ 
    leadId, 
    currentStatus, 
    open, 
    onOpenChange, 
    onStatusUpdate, 
    isCallInitiated
}) => {
    const [status, setStatus] = useState(currentStatus)
    const [note, setNote] = useState('')
    const [callbackDate, setCallbackDate] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setStatus(currentStatus);
            setNote('');
            setCallbackDate('');
        }
    }, [open, currentStatus]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onStatusUpdate(status, note, callbackDate);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save status:", error);
        } finally {
            setLoading(false);
        }
    };

    const statusOptions = ["new", "contacted", "interested", "follow_up", "not_eligible", "dead"];

    return (
        <Dialog open={open} onOpenChange={onOpenChange} title={`Update Lead Status: ${leadId.slice(0, 8)}...`}>
            <div className="space-y-4">
                {isCallInitiated && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center text-blue-800">
                        <Phone className="h-4 w-4 mr-2" />
                        Call initiated. Please update status and notes after the call ends.
                    </div>
                )}
                
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                        {statusOptions.map(s => (
                            <SelectItem key={s} value={s}>
                                {s.replace('_', ' ').toUpperCase()}
                            </SelectItem>
                        ))}
                    </Select>
                </div>

                {status === 'follow_up' && (
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Next Follow-Up Date</label>
                        <Input 
                            type="date" 
                            value={callbackDate} 
                            onChange={(e) => setCallbackDate(e.target.value)} 
                        />
                    </div>
                )}
                
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">Notes (Mandatory for status change)</label>
                    <textarea 
                        value={note} 
                        onChange={(e) => setNote(e.target.value)} 
                        rows={3} 
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Add details about the interaction..."
                    />
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full mt-4">
                    {loading ? 'Saving...' : 'Save Update'}
                </Button>
            </div>
        </Dialog>
    );
};

// QuickActions Simulation
interface Lead {
  id: string
  name: string
  status: string
  phone: string
  assigned_to: string | null
}
interface QuickActionsProps {
  lead: Lead
  onCallInitiate: (lead: Lead) => void
  onAssign: (leadId: string, telecallerId: string) => void
  onStatusChange: (leadId: string, newStatus: string) => void
  telecallers: Array<{ id: string; full_name: string }>
}

const QuickActions: React.FC<QuickActionsProps> = ({ lead, onCallInitiate, onAssign, onStatusChange, telecallers }) => {
    const [assignedTo, setAssignedTo] = useState(lead.assigned_to || '');

    useEffect(() => {
        setAssignedTo(lead.assigned_to || '');
    }, [lead.assigned_to]);

    const handleAssignChange = (newId: string) => {
        setAssignedTo(newId);
        onAssign(lead.id, newId);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 right-0" >
                <DropdownMenuItem onClick={() => onCallInitiate(lead)}>
                    <Phone className="mr-2 h-4 w-4" /> Start Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(lead.id, 'follow_up')}>
                    <Calendar className="mr-2 h-4 w-4" /> Set Follow Up
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <a href={`#lead-details-${lead.id}`} className="flex items-center w-full" onClick={(e) => e.preventDefault()}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                    </a>
                </DropdownMenuItem>

                <div className="px-4 py-2 text-xs font-semibold text-gray-500">Assign Lead</div>
                <div className="p-2">
                    <Select value={assignedTo} onValueChange={handleAssignChange} disabled={telecallers.length === 0}>
                        <SelectItem value="">Unassigned</SelectItem>
                        {telecallers.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                        ))}
                    </Select>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// useTelecallerStatus Simulation (Hook)
// This simulates fetching telecaller status (online/offline)
const useTelecallerStatus = (telecallerIds: string[]) => {
    // In a real app, this would query a real-time presence system (e.g., Firestore presence)
    const [status, setStatus] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Simulate random online/offline status for demonstration
        const mockStatus = telecallerIds.reduce((acc, id) => {
            acc[id] = Math.random() > 0.3; // 70% chance of being online
            return acc;
        }, {} as Record<string, boolean>);

        const timer = setTimeout(() => {
            setStatus(mockStatus);
            setLoading(false);
        }, 500); // Simulate network delay

        return () => clearTimeout(timer);
    }, [telecallerIds]);

    return { telecallerStatus: status, loading };
};

// --- Firebase Initialization and Utility Functions ---

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app: any;
let db: any;
let auth: any;

if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

// Function to get the collection reference path based on app ID and user
const getLeadsCollectionRef = (userId: string) => {
    if (!db) {
        console.error("Firestore is not initialized.");
        return null;
    }
    // Using a public collection for leads so they can be viewed/managed by different telecallers/admins
    return collection(db, `artifacts/${appId}/public/data/leads`);
};

// --- Main Component Interface ---

interface LeadData {
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
  follow_up_date: string | null // ISO string date for next follow-up
}

interface LeadsTableProps {
  // In this self-contained version, we'll fetch leads inside the component,
  // but we keep telecallers as a prop for simplicity of the mock data structure.
  telecallers: Array<{ id: string; full_name: string }>
}

export function LeadsTable({ telecallers = [] }: LeadsTableProps) {
  
  // --- State Hooks ---
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all")
  
  // New Filters
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "today" | "this_week" | "overdue">("all")
  const [loanAmountFilterMin, setLoanAmountFilterMin] = useState<string>("")
  const [loanAmountFilterMax, setLoanAmountFilterMax] = useState<string>("")

  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true, contact: true, company: true, status: true, priority: true, created: true, 
    lastContacted: true, loanAmount: true, loanType: true, source: true, 
    assignedTo: true, followUpDate: true, actions: true
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  // State for bulk actions
  const [bulkAssignTo, setBulkAssignTo] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)

  // --- Firebase Auth and Data Fetching ---

  useEffect(() => {
    if (!firebaseConfig || !auth) {
        console.error("Firebase config or auth is missing.");
        setLoadingLeads(false);
        setIsAuthReady(true);
        return;
    }

    const initAuth = async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Firebase Auth Error:", error);
            // Fallback to anonymous if custom token fails
            try {
                await signInAnonymously(auth);
            } catch (anonError) {
                console.error("Anonymous Sign-In Failed:", anonError);
            }
        } finally {
            const user = auth.currentUser;
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(crypto.randomUUID()); // Fallback non-authenticated ID
            }
            setIsAuthReady(true);
        }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    const leadsRef = getLeadsCollectionRef(userId);
    if (!leadsRef) return;

    // Fetch leads and map assigned_to ID to assigned_user object
    const q = query(leadsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const leadsData: LeadData[] = snapshot.docs.map(doc => {
            const data = doc.data() as Omit<LeadData, 'id'> & { id: string };
            const assignedUser = telecallers.find(t => t.id === data.assigned_to);
            
            return {
                id: doc.id,
                ...data,
                assigned_user: assignedUser ? { id: assignedUser.id, full_name: assignedUser.full_name } : null,
            } as LeadData;
        });
        
        setLeads(leadsData);
        setLoadingLeads(false);
    }, (error) => {
        console.error("Firestore listen error:", error);
        setLoadingLeads(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, userId, telecallers]);

  // --- Utility & Filter Logic ---

  const getSafeValue = (value: any, defaultValue: string = 'N/A') => value ?? defaultValue

  const allTelecallerIds = useMemo(() => {
    return [
      ...leads.map(lead => lead.assigned_user?.id).filter(Boolean) as string[],
      ...telecallers.map(t => t.id)
    ].filter((id, index, self) => self.indexOf(id) === index)
  }, [leads, telecallers])

  const { telecallerStatus, loading: statusLoading } = useTelecallerStatus(allTelecallerIds)
  
  const loanMin = parseFloat(loanAmountFilterMin)
  const loanMax = parseFloat(loanAmountFilterMax)

  const filteredLeads = useMemo(() => leads.filter(lead => {
    // 1. Search
    const matchesSearch = searchTerm === "" ||
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))

    // 2. Standard Filters
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    const matchesPriority = priorityFilter === "all" || lead.priority === priorityFilter
    const matchesAssignedTo = assignedToFilter === "all" ||
      (assignedToFilter === "unassigned" && !lead.assigned_to) ||
      lead.assigned_to === assignedToFilter

    // 3. Loan Amount Filter
    const matchesLoanAmount = (
      (!loanAmountFilterMin || (lead.loan_amount !== null && lead.loan_amount >= loanMin)) &&
      (!loanAmountFilterMax || (lead.loan_amount !== null && lead.loan_amount <= loanMax))
    )

    // 4. Follow-Up Date Filter
    let matchesFollowUp = true
    const followUpDate = lead.follow_up_date ? parseISO(lead.follow_up_date) : null
    const now = new Date()
    
    if (followUpFilter !== "all") {
        if (!followUpDate) {
            matchesFollowUp = false;
        } else {
            switch (followUpFilter) {
                case "today":
                    matchesFollowUp = isToday(followUpDate);
                    break;
                case "this_week":
                    // Check if it's within the next 7 days, including today
                    const endOfWeek = subDays(new Date(), -7); 
                    matchesFollowUp = isBefore(followUpDate, endOfWeek) && !isBefore(followUpDate, subDays(now, 1));
                    break;
                case "overdue":
                    // Check if the follow-up date is strictly before today
                    matchesFollowUp = isBefore(followUpDate, subDays(now, 1));
                    break;
            }
        }
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo && matchesLoanAmount && matchesFollowUp
  }), [leads, searchTerm, statusFilter, priorityFilter, assignedToFilter, loanAmountFilterMin, loanAmountFilterMax, followUpFilter, loanMin, loanMax])

  // Sorting
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let aValue = a[sortField as keyof LeadData]
      let bValue = b[sortField as keyof LeadData]

      if (aValue === null) return sortDirection === 'asc' ? 1 : -1
      if (bValue === null) return sortDirection === 'asc' ? -1 : 1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredLeads, sortField, sortDirection])


  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / pageSize)
  const paginatedLeads = sortedLeads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  
  // Data Summary
  const filteredMetrics = useMemo(() => {
      const totalLoanAmount = sortedLeads.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0);
      const highPriorityCount = sortedLeads.filter(lead => lead.priority.toLowerCase() === 'high').length;

      return {
          totalLoanAmount: totalLoanAmount,
          highPriorityCount: highPriorityCount,
      }
  }, [sortedLeads])
  
  // --- Action Handlers (Firestore) ---

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const [isCallInitiated, setIsCallInitiated] = useState(false)

  const handleCallInitiated = (lead: LeadData) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
    setIsCallInitiated(true)
  }
  
  // Placeholder: not fully implemented
  const handleCallLogged = (callLogId: string) => {
    setIsCallInitiated(false)
  }

  const handleStatusUpdate = async (newStatus: string, note?: string, callbackDate?: string) => {
    const leadId = selectedLead?.id;
    if (!leadId || !db) return;

    try {
      const leadDocRef = doc(db, `artifacts/${appId}/public/data/leads`, leadId);
      
      const updateData: any = {
        status: newStatus,
        last_contacted: new Date().toISOString()
      }

      // Logic for note/follow-up based on status
      if (newStatus === "follow_up" && callbackDate) {
        updateData.follow_up_date = callbackDate // YYYY-MM-DD
      } else {
        updateData.follow_up_date = null; // Clear follow up date
      }

      // You would typically log the note in a separate 'call_logs' subcollection
      // For this single-file example, we just update the lead.
      
      await updateDoc(leadDocRef, updateData);

      console.log(`Status updated for lead ${leadId} to ${newStatus}`);
      // onSnapshot handles the UI update

    } catch (error) {
      console.error("Error updating lead status:", error);
      throw error; // Re-throw to show error in dialog
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    if (!db) return;
    try {
      const leadDocRef = doc(db, `artifacts/${appId}/public/data/leads`, leadId);
      
      const updateData: any = {
        status: newStatus,
        last_contacted: new Date().toISOString(),
      }

      if (newStatus === "follow_up") {
        // Set follow up to tomorrow as default if set via quick action
        updateData.follow_up_date = format(subDays(new Date(), -1), 'yyyy-MM-dd');
      } else {
        updateData.follow_up_date = null;
      }
      
      await updateDoc(leadDocRef, updateData);

      console.log(`Status changed for lead ${leadId} to ${newStatus}`)
    } catch (error) {
      console.error("Error changing lead status:", error)
    }
  }

  const handleAssignLead = async (leadId: string, telecallerId: string) => {
    if (!db || !auth.currentUser) return;
    try {
      const leadDocRef = doc(db, `artifacts/${appId}/public/data/leads`, leadId);
      const assignedById = auth.currentUser.uid;

      await updateDoc(leadDocRef, {
        assigned_to: telecallerId === "unassigned" ? null : telecallerId,
        assigned_by: assignedById,
        assigned_at: new Date().toISOString()
      });

      console.log(`Lead ${leadId} assigned to ${telecallerId}`)

    } catch (error) {
      console.error("Error assigning lead:", error)
    }
  }
  
  // Bulk Action Handlers
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    if (selectedLeads.length > 0 && selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(paginatedLeads.map(lead => lead.id))
    }
  }

  // Round-Robin Bulk Assignment Logic
  const handleBulkAssign = async () => {
    if (bulkAssignTo.length === 0 || selectedLeads.length === 0 || !db || !auth.currentUser) return

    try {
      const assignedById = auth.currentUser.uid;
      const telecallerIds = bulkAssignTo; 
      const leadsRef = collection(db, `artifacts/${appId}/public/data/leads`);
      
      await runTransaction(db, async (transaction) => {
          selectedLeads.forEach((leadId, index) => {
              const telecallerId = telecallerIds[index % telecallerIds.length]; // Round-robin
              const leadDocRef = doc(leadsRef, leadId);
              
              transaction.update(leadDocRef, {
                  assigned_to: telecallerId,
                  assigned_by: assignedById,
                  assigned_at: new Date().toISOString()
              });
          });
      });

      console.log(`Bulk assigned ${selectedLeads.length} leads via round-robin.`)
      setSelectedLeads([])
      setBulkAssignTo([])
      
    } catch (error) {
      console.error("Error bulk assigning leads:", error)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedLeads.length === 0 || !db) return

    try {
      const leadsRef = collection(db, `artifacts/${appId}/public/data/leads`);

      await runTransaction(db, async (transaction) => {
          selectedLeads.forEach((leadId) => {
              const leadDocRef = doc(leadsRef, leadId);
              
              const updateData: any = {
                status: bulkStatus,
                last_contacted: new Date().toISOString(),
                follow_up_date: bulkStatus === "follow_up" ? format(subDays(new Date(), -1), 'yyyy-MM-dd') : null,
              }
              
              transaction.update(leadDocRef, updateData);
          });
      });

      console.log(`Bulk updated status for ${selectedLeads.length} leads to ${bulkStatus}`)
      setSelectedLeads([])
      setBulkStatus("")

    } catch (error) {
      console.error("Error bulk updating lead status:", error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0 || !db) return

    if (!isBulkDeleteConfirmOpen) {
      setIsBulkDeleteConfirmOpen(true)
      return
    }

    try {
      const leadsRef = collection(db, `artifacts/${appId}/public/data/leads`);

      await runTransaction(db, async (transaction) => {
          selectedLeads.forEach((leadId) => {
              const leadDocRef = doc(leadsRef, leadId);
              transaction.delete(leadDocRef);
          });
      });

      console.log(`Bulk deleted ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setIsBulkDeleteConfirmOpen(false)

    } catch (error) {
      console.error("Error bulk deleting leads:", error)
      setIsBulkDeleteConfirmOpen(false)
    }
  }

  const handleBulkExport = () => {
    if (selectedLeads.length === 0) {
      console.error("Please select leads to export.");
      return
    }
    
    // ... CSV export logic (omitted for brevity, assume leadsToExport is filtered)
    const leadsToExport = leads
        .filter(lead => selectedLeads.includes(lead.id))
        .map(lead => ({
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: lead.status,
            priority: lead.priority,
            loan_amount: lead.loan_amount,
            assigned_to: lead.assigned_user?.full_name || 'Unassigned',
            created_at: lead.created_at,
            follow_up_date: lead.follow_up_date,
        }))

    const headers = Object.keys(leadsToExport[0]).join(',')
    const rows = leadsToExport.map(lead => Object.values(lead)
      .map(value => {
        const stringValue = value !== null && value !== undefined ? String(value) : ""
        return stringValue.includes(',') || stringValue.includes('\n') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
      })
      .join(',')
    )
    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log(`Exported ${selectedLeads.length} leads.`)
    setSelectedLeads([])
  }

  const getPriorityVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "destructive"
      case "medium": return "default"
      case "low": return "secondary"
      default: return "secondary"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "new": return "bg-blue-100 text-blue-800 border-blue-300"
      case "contacted": return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "interested": return "bg-green-100 text-green-800 border-green-300"
      case "not_eligible": return "bg-red-100 text-red-800 border-red-300"
      case "dead": return "bg-gray-100 text-gray-800 border-gray-300"
      case "follow_up": return "bg-purple-100 text-purple-800 border-purple-300"
      default: return "bg-gray-200 text-gray-800 border-gray-400"
    }
  }

  // Columns definition (for column visibility and table headers)
  const columns = [
    { key: 'select', name: '' },
    { key: 'name', name: 'Name', sortable: true },
    { key: 'contact', name: 'Contact' },
    { key: 'company', name: 'Company', sortable: true },
    { key: 'status', name: 'Status', sortable: true },
    { key: 'priority', name: 'Priority', sortable: true },
    { key: 'created_at', name: 'Created', sortable: true },
    { key: 'last_contacted', name: 'Last Contacted', sortable: true },
    { key: 'follow_up_date', name: 'Follow-Up Due', sortable: true },
    { key: 'loan_amount', name: 'Loan Amt.', sortable: true },
    { key: 'loan_type', name: 'Loan Type', sortable: true },
    { key: 'source', name: 'Source', sortable: true },
    { key: 'assigned_to', name: 'Assigned To', sortable: true },
    { key: 'actions', name: 'Actions' },
  ].map(col => ({...col, key: col.key.includes('_') ? col.key.replace(/_(\w)/g, (match, p1) => p1.toUpperCase()) : col.key })) // Convert keys for matching
  
  // Re-map column keys to match data keys where necessary
  const columnKeyMap: Record<string, keyof LeadData> = {
    name: 'name', contact: 'phone', company: 'company', status: 'status', 
    priority: 'priority', created: 'created_at', lastContacted: 'last_contacted', 
    followUpDate: 'follow_up_date', loanAmount: 'loan_amount', loanType: 'loan_type', 
    source: 'source', assignedTo: 'assigned_to',
  };

  // All unique statuses for the filter dropdown
  const uniqueStatuses = Array.from(new Set(leads.map(lead => lead.status).filter(s => s)))

  // All unique priorities for the filter dropdown
  const uniquePriorities = Array.from(new Set(leads.map(lead => lead.priority).filter(p => p)))

  // Telecaller options including 'unassigned'
  const assignedToOptions = [
    { id: 'all', full_name: 'All Telecallers' },
    { id: 'unassigned', full_name: 'Unassigned' },
    ...telecallers
  ]

  // Pagination helper to generate the page numbers to display
  const maxPagesToShow = 5
  const getPaginationPages = () => {
    const pages = []
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }
  
  const stickyHeaderStyle: React.CSSProperties = {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  }
  
  if (!isAuthReady || loadingLeads) {
      return (
          <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-lg text-gray-700">Loading Leads and Telecaller Data...</p>
          </div>
      );
  }


  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 font-sans">
        <h1 className="text-3xl font-extrabold text-gray-900">Lead Management Dashboard</h1>
        <p className="text-sm text-gray-500">User ID: <span className="font-mono text-xs bg-gray-100 p-1 rounded">{userId}</span></p>

        {/* Summary Metrics Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-blue-200 rounded-lg shadow-md flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">Filtered Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{sortedLeads.length.toLocaleString()}</p>
                </div>
                <ListChecks className="h-8 w-8 text-blue-500 opacity-70" />
            </div>
            <div className="p-4 bg-white border border-green-200 rounded-lg shadow-md flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">Total Loan Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {`₹${filteredMetrics.totalLoanAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500 opacity-70" />
            </div>
            <div className="p-4 bg-white border border-red-200 rounded-lg shadow-md flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">High Priority Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredMetrics.highPriorityCount}</p>
                </div>
                <Target className="h-8 w-8 text-red-500 opacity-70" />
            </div>
        </div>

      {/* Search and Bulk Actions Bar */}
      <div className="flex flex-col gap-4 justify-between items-start p-4 border rounded-xl bg-white shadow-lg">
        
        {/* Row 1: Search & Filters */}
        <div className="flex flex-wrap items-center gap-4 w-full">
          
          <div className="relative w-full sm:w-64 order-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search leads (Name, Email, Phone, Company)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 h-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 order-2 h-10">
                <Filter className="h-4 w-4" />
                Advanced Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Status Filter */}
                <div>
                    <label className="text-xs font-medium text-gray-700">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status.replace(/_/g, ' ').toUpperCase()}</SelectItem>
                      ))}
                    </Select>
                </div>

                {/* Priority Filter */}
                <div>
                    <label className="text-xs font-medium text-gray-700">Priority</label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {uniquePriorities.map(priority => (
                        <SelectItem key={priority} value={priority}>{priority.toUpperCase()}</SelectItem>
                      ))}
                    </Select>
                </div>
              </div>
              
              {/* Assigned To Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700">Assigned To</label>
                <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                  {assignedToOptions.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                        {user.full_name} {user.id !== 'all' && user.id !== 'unassigned' && (telecallerStatus[user.id] ? '(Online)' : '(Offline)')}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              
              {/* Follow-up Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700">Follow-Up Due</label>
                <Select value={followUpFilter} onValueChange={setFollowUpFilter as (value: string) => void}>
                  <SelectItem value="all">Any Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week (Next 7 days)</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </Select>
              </div>
              
              {/* Loan Amount Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Loan Amount (₹)</label>
                <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={loanAmountFilterMin}
                      onChange={(e) => setLoanAmountFilterMin(e.target.value)}
                      className="h-10"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={loanAmountFilterMax}
                      onChange={(e) => setLoanAmountFilterMax(e.target.value)}
                      className="h-10"
                    />
                </div>
              </div>

              <Button variant="ghost" className="w-full mt-3 h-9" onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setAssignedToFilter("all");
                setFollowUpFilter("all");
                setLoanAmountFilterMin("");
                setLoanAmountFilterMax("");
              }}>
                Clear Filters
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Row 2: Bulk Actions and Column Visibility */}
        <div className="flex flex-wrap items-center gap-3 w-full border-t pt-3 mt-3">
          
          <span className="text-sm font-medium text-gray-600 mr-2 min-w-[100px]">
              {selectedLeads.length} Selected
          </span>

          {/* Bulk Status Update */}
          <Select 
            value={bulkStatus} 
            onValueChange={setBulkStatus} 
            disabled={selectedLeads.length === 0}
            className="w-32 h-10"
          >
            <SelectItem value="">Bulk Status</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={`bulk-${status}`} value={status}>{status.replace(/_/g, ' ').toUpperCase()}</SelectItem>
            ))}
          </Select>
          <Button
            onClick={handleBulkStatusUpdate}
            disabled={selectedLeads.length === 0 || !bulkStatus}
            variant="secondary"
            className="h-10"
          >
            Update
          </Button>

          {/* Bulk Assign (Single Select for simplicity, round-robin applied) */}
          <div className="w-36">
            <Select
              value={bulkAssignTo[0] || ""}
              onValueChange={(val) => setBulkAssignTo(val ? [val] : [])}
              disabled={selectedLeads.length === 0}
              className="h-10"
            >
              <SelectItem value="">Bulk Assign</SelectItem>
              {telecallers.map(t => (
                <SelectItem key={`assign-${t.id}`} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </Select>
          </div>
          <Button
            onClick={handleBulkAssign}
            disabled={selectedLeads.length === 0 || bulkAssignTo.length === 0}
            variant="secondary"
            className="h-10"
          >
            Assign
          </Button>

          {/* Bulk Export */}
          <Button
            onClick={handleBulkExport}
            disabled={selectedLeads.length === 0}
            variant="outline"
            className="h-10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {/* Bulk Delete */}
          <Button
            onClick={handleBulkDelete}
            disabled={selectedLeads.length === 0}
            variant={isBulkDeleteConfirmOpen ? "destructive" : "outline"}
            className="h-10"
          >
            {isBulkDeleteConfirmOpen ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2 text-white" />
                Confirm Delete ({selectedLeads.length})
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Bulk
              </>
            )}
          </Button>

          {/* Column Visibility Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 ml-auto h-10">
                <Eye className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {columns.filter(col => col.key !== 'select' && col.key !== 'actions').map((column: any) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({ ...prev, [column.key]: checked }))
                  }
                >
                  {column.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table Display */}
      <div className="border rounded-xl overflow-x-auto shadow-xl bg-white">
        <Table className="min-w-[1200px]">
          <TableHeader style={stickyHeaderStyle}>
            <TableRow>
              {/* Checkbox Header */}
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  checked={selectedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                  onChange={selectAllLeads}
                />
              </TableHead>

              {columns.filter(col => col.key !== 'select' && visibleColumns[col.key]).map((column: any) => (
                <TableHead
                  key={column.key}
                  className="cursor-pointer hover:bg-gray-100 transition duration-150"
                  onClick={() => handleSort(columnKeyMap[column.key] || column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.name}
                    {sortField === (columnKeyMap[column.key] || column.key) && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedLeads.map((lead) => {
              const assignedUserId = lead.assigned_user?.id
              const isAvailable = assignedUserId ? telecallerStatus[assignedUserId] : false
              const isSelected = selectedLeads.includes(lead.id)
              
              const isOverdue = lead.follow_up_date && isBefore(parseISO(lead.follow_up_date), subDays(new Date(), 1));

              return (
                <TableRow key={lead.id} className={`hover:bg-blue-50/50 transition ${isSelected ? 'bg-blue-100/50' : ''}`}>
                  {/* Selection Checkbox */}
                  <TableCell>
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={isSelected}
                      onChange={() => toggleLeadSelection(lead.id)}
                    />
                  </TableCell>

                  {visibleColumns.name && (
                    <TableCell className="font-medium text-blue-600 hover:underline">
                      <a href={`#lead-details-${lead.id}`} onClick={(e) => {
                           e.preventDefault();
                           console.log(`Simulating navigation to lead: ${lead.id}`);
                      }}>
                        {getSafeValue(lead.name)}
                      </a>
                    </TableCell>
                  )}

                  {visibleColumns.contact && (
                    <TableCell>
                      <div className="text-sm">
                        <Phone className="h-3 w-3 inline mr-1 text-gray-500" /> {getSafeValue(lead.phone)}
                      </div>
                      <div className="text-xs text-gray-500">
                        <Mail className="h-3 w-3 inline mr-1" /> {getSafeValue(lead.email)}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns.company && <TableCell>{getSafeValue(lead.company)}</TableCell>}

                  {visibleColumns.status && (
                    <TableCell>
                      <Badge variant="outline" className={`border-2 ${getStatusColor(lead.status)}`}>{getSafeValue(lead.status)}</Badge>
                    </TableCell>
                  )}

                  {visibleColumns.priority && (
                    <TableCell>
                      <Badge variant={getPriorityVariant(lead.priority)}>{getSafeValue(lead.priority)}</Badge>
                    </TableCell>
                  )}

                  {visibleColumns.created && (
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(lead.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                  )}

                  {visibleColumns.lastContacted && (
                    <TableCell className="text-sm text-gray-500">
                      {lead.last_contacted ? format(new Date(lead.last_contacted), 'MMM dd, yyyy') : 'Never'}
                    </TableCell>
                  )}

                  {/* New Column: Follow-Up Date */}
                  {visibleColumns.followUpDate && (
                    <TableCell className="text-sm">
                      {lead.follow_up_date ? (
                          <span className={`flex items-center ${isOverdue ? 'text-red-600 font-semibold' : 'text-purple-600'}`}>
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(parseISO(lead.follow_up_date), 'MMM dd, yyyy')}
                              {isOverdue && <span className="text-xs ml-1">(Overdue)</span>}
                          </span>
                      ) : (
                          <span className="text-gray-400 italic">None Set</span>
                      )}
                    </TableCell>
                  )}

                  {visibleColumns.loanAmount && (
                    <TableCell className="font-medium">
                      {lead.loan_amount ? `₹${lead.loan_amount.toLocaleString()}` : 'N/A'}
                    </TableCell>
                  )}

                  {visibleColumns.loanType && <TableCell>{getSafeValue(lead.loan_type)}</TableCell>}
                  {visibleColumns.source && <TableCell>{getSafeValue(lead.source)}</TableCell>}

                  {visibleColumns.assignedTo && (
                    <TableCell>
                      {lead.assigned_user ? (
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-500'} ring-2 ring-offset-1 ${isAvailable ? 'ring-green-300' : 'ring-red-300'} transition-all`} title={isAvailable ? 'Online' : 'Offline'} />
                          {lead.assigned_user.full_name}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Unassigned</span>
                      )}
                    </TableCell>
                  )}

                  {visibleColumns.actions && (
                    <TableCell className="w-20">
                      <QuickActions
                        lead={lead}
                        onCallInitiate={() => handleCallInitiated(lead)}
                        onAssign={handleAssignLead}
                        onStatusChange={handleStatusChange}
                        telecallers={telecallers}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sortedLeads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between py-4">
          <div className="text-sm text-gray-600 mb-2 sm:mb-0">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedLeads.length)} of {sortedLeads.length} leads (Total in system: {leads.length})
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex space-x-1">
              {getPaginationPages().map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow-md mt-4">
          No leads found in the system.
        </div>
      )}

      {/* Lead Status Dialog / Quick Update */}
      {selectedLead && (
        <LeadStatusDialog
          leadId={selectedLead.id}
          currentStatus={selectedLead.status}
          open={isStatusDialogOpen}
          onOpenChange={(open) => {
            setIsStatusDialogOpen(open)
            if (!open) setIsCallInitiated(false)
          }}
          onStatusUpdate={handleStatusUpdate}
          isCallInitiated={isCallInitiated}
          onCallLogged={handleCallLogged}
        />
      )}
    </div>
  )
}
