"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  Search, Filter, ChevronDown, ChevronUp, MoreHorizontal, 
  Loader2, RefreshCw, Eye, Hash, Users, Clock, CheckCircle, XCircle, DollarSign, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";

// Updated Lead interface without telecaller information
interface Lead {
  id: string;
  name: string;
  phone: string;
  loan_amount: number | null;
  status: string;
  created_at: string;
  assigned_to?: string;
}

interface KycLeadsTableProps {
    currentUserId: string;
    initialStatus: string;
}

// Define the available statuses for consistency
const STATUSES = {
    LOGIN_DONE: "Login Done",
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "Disbursed",
} as const;

// Utility function to get the appropriate badge based on status
const getStatusBadge = (status: string) => {
    switch (status) {
        case STATUSES.LOGIN_DONE:
            return <Badge className="bg-blue-400 text-white hover:bg-blue-500">Login Done</Badge>;
        case STATUSES.UNDERWRITING:
            return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Underwriting</Badge>;
        case STATUSES.REJECTED:
            return <Badge className="bg-red-600 text-white hover:bg-red-700">Rejected</Badge>;
        case STATUSES.APPROVED:
            return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
        case STATUSES.DISBURSED:
            return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Disbursed</Badge>;
        default:
            return <Badge variant="secondary">Unknown</Badge>;
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

export default function KycLeadsTable({ currentUserId, initialStatus }: KycLeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "all");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Enhanced Data Fetching function with comprehensive debugging
  const fetchLeads = async (setLoading = false) => {
    if (setLoading) {
      setIsLoading(true);
      setError(null);
    }
    
    console.log("=== DEBUG: Starting fetchLeads ===");
    console.log("Current User ID:", currentUserId);
    console.log("Status Filter:", statusFilter);
    console.log("Supabase client:", supabase ? "Initialized" : "Not initialized");

    let debugMessage = `Fetching leads for user: ${currentUserId}\nStatus filter: ${statusFilter}\n`;

    try {
      // TEST 1: Check if leads table has any data at all
      console.log("=== TEST 1: Checking if leads table exists and has data ===");
      const { data: testData, error: testError } = await supabase
        .from("leads")
        .select("id, name")
        .limit(5);

      console.log("Test query result:", testData);
      console.log("Test query error:", testError);
      
      debugMessage += `Test query - Found ${testData?.length || 0} leads total\n`;
      if (testError) {
        debugMessage += `Test query error: ${testError.message}\n`;
      }

      // TEST 2: Check schema of leads table
      console.log("=== TEST 2: Checking leads table schema ===");
      const { data: sampleLead, error: sampleError } = await supabase
        .from("leads")
        .select("*")
        .limit(1)
        .single();

      console.log("Sample lead structure:", sampleLead);
      debugMessage += `Sample lead: ${JSON.stringify(sampleLead)}\n`;

      // TEST 3: Try different filter approaches
      console.log("=== TEST 3: Trying different filter approaches ===");
      
      // Approach A: Original query with kyc_member_id
      let query = supabase
        .from("leads")
        .select(`
          id, 
          name, 
          phone, 
          loan_amount, 
          status, 
          created_at,
          assigned_to
        `)
        .eq("kyc_member_id", currentUserId)
        .order("created_at", { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      console.log("Main query result:", data);
      console.log("Main query error:", error);
      
      debugMessage += `Main query - Found ${data?.length || 0} leads with kyc_member_id filter\n`;
      if (error) {
        debugMessage += `Main query error: ${error.message}\n`;
      }

      // Approach B: Try without user filter to see all leads
      if (!data || data.length === 0) {
        console.log("=== TEST 4: Trying without user filter ===");
        const { data: allLeads, error: allError } = await supabase
          .from("leads")
          .select("id, name, kyc_member_id, assigned_to, status")
          .limit(10);

        console.log("All leads (no filter):", allLeads);
        debugMessage += `Without filter - Found ${allLeads?.length || 0} total leads\n`;
        
        if (allLeads && allLeads.length > 0) {
          debugMessage += `Sample leads: ${allLeads.map(lead => `${lead.name} (kyc_member_id: ${lead.kyc_member_id})`).join(', ')}\n`;
        }
      }

      // Approach C: Try alternative column names
      if (!data || data.length === 0) {
        console.log("=== TEST 5: Trying alternative column names ===");
        const alternativeColumns = ['user_id', 'assigned_to', 'owner_id', 'created_by'];
        
        for (const column of alternativeColumns) {
          const { data: altData, error: altError } = await supabase
            .from("leads")
            .select("id, name")
            .eq(column, currentUserId)
            .limit(5);

          console.log(`Trying column ${column}:`, altData);
          if (altData && altData.length > 0) {
            debugMessage += `FOUND LEADS using column '${column}': ${altData.length} leads\n`;
            debugMessage += `Leads found: ${altData.map(lead => lead.name).join(', ')}\n`;
          }
        }
      }

      // Set final results
      if (error) {
        console.error("Error fetching leads:", error);
        setError(`Database error: ${error.message}`);
        setLeads([]);
      } else {
        console.log("Final leads to display:", data);
        setLeads(data as Lead[]);
        if (data.length === 0) {
          setError("No leads found assigned to you. This could be because:\n- No leads are assigned to your user ID\n- The 'kyc_member_id' column might have different values\n- There might be no leads in the database yet");
        }
      }

      setDebugInfo(debugMessage);
      console.log("=== DEBUG: Finished fetchLeads ===");

    } catch (catchError) {
      console.error("Unexpected error in fetchLeads:", catchError);
      setError(`Unexpected error: ${catchError}`);
      setDebugInfo(debugMessage + `\nUnexpected error: ${catchError}`);
    }

    if (setLoading) setIsLoading(false);
  };

  // Real-time Listener and Initial Load
  useEffect(() => {
    console.log("=== DEBUG: useEffect triggered ===");
    console.log("currentUserId:", currentUserId);
    console.log("statusFilter:", statusFilter);
    
    fetchLeads(true);

    const channel = supabase.channel(`kyc_leads_user_${currentUserId}`);

    const subscription = channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log("Real-time update received:", payload);
          const changedLead = payload.new as Lead | null;
          const oldLead = payload.old as Lead | null;
          
          const isRelevant = 
             changedLead?.kyc_member_id === currentUserId || 
             oldLead?.kyc_member_id === currentUserId; 

          if (isRelevant) {
             console.log("Relevant lead change detected. Refetching leads...");
             fetchLeads(false); 
          }
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to KYC leads changes for user: ${currentUserId}`);
        }
      });

    return () => {
        console.log("Cleaning up real-time subscription");
        supabase.removeChannel(channel);
    };
  }, [currentUserId, statusFilter]); 

  // Filtering Logic (Client-side search)
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    
    const lowerCaseSearch = searchTerm.toLowerCase();
    
    return leads.filter(
        (lead) => 
            lead.name.toLowerCase().includes(lowerCaseSearch) ||
            lead.phone.includes(lowerCaseSearch) ||
            lead.id.toLowerCase().includes(lowerCaseSearch)
    );
  }, [leads, searchTerm]);

  // Function to display assigned to information
  const getAssignedInfo = (lead: Lead) => {
    if (lead.assigned_to) {
      return `Assigned to: ${lead.assigned_to}`;
    }
    return "Unassigned";
  };

  return (
    <div className="space-y-4">
      {/* Debug Information - Visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="bg-yellow-50 border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-yellow-800">Debug Information</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log("Debug info:", debugInfo);
                navigator.clipboard.writeText(debugInfo);
              }}
            >
              Copy Debug Info
            </Button>
          </div>
          <pre className="text-xs text-yellow-700 mt-2 whitespace-pre-wrap max-h-32 overflow-auto">
            {debugInfo || "No debug information yet..."}
          </pre>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-400 mr-2" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Unable to load leads</h3>
              <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => {
              console.log("Current state:", {
                currentUserId,
                statusFilter,
                leads,
                debugInfo
              });
            }}
          >
            Log Current State
          </Button>
        </Card>
      )}

      {/* Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center space-x-2 w-full sm:w-1/2">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by Name, Phone, or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="w-full"
          />
        </div>
        <div className="flex gap-4 items-center">
            {/* Status Filter Select */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px] text-sm">
                    <Filter className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.values(STATUSES).map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

          <Button onClick={() => fetchLeads(true)} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="min-w-[150px]">Lead Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden sm:table-cell">Loan Amount</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead className="min-w-[140px]">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
                    <p className="mt-2 text-gray-600">Loading leads...</p>
                    <p className="text-xs text-gray-500 mt-1">Checking database...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    <Users className="w-6 h-6 mx-auto mb-2"/>
                    No assigned leads found matching your filters.
                    <p className="text-xs mt-2">User ID: {currentUserId}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-purple-50 transition-colors">
                    <TableCell className="font-medium text-purple-700 hover:underline">
                      <Link href={`/kyc-team/${lead.id}`}>{lead.name}</Link>
                      <p className="text-xs text-gray-500 mt-0.5">ID: {lead.id.substring(0, 8)}</p>
                    </TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell className="hidden sm:table-cell font-semibold">
                        {formatCurrency(lead.loan_amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          {getAssignedInfo(lead)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(lead.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/kyc-team/${lead.id}`} className="flex items-center">
                                <Eye className="h-4 w-4 mr-2" />
                                View KYC/Details
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      <div className="text-center py-2 text-sm text-gray-600">
        Displaying {filteredLeads.length} leads.
        {process.env.NODE_ENV === 'development' && (
          <span className="text-xs text-gray-400 ml-2">User: {currentUserId}</span>
        )}
      </div>
    </div>
  );
}
