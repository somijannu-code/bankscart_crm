"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  Phone, Search, Filter, ChevronDown, ChevronUp, MoreHorizontal, 
  Clock, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Calendar, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";

// Define the structure for a Lead specific to KYC view
interface Lead {
  id: string;
  full_name: string;
  phone: string;
  loan_amount: number | null;
  status: string;
  created_at: string;
  kyc_member_id: string; // Include for real-time check
}

interface KycLeadsTableProps {
    currentUserId: string;
}

// Function to determine badge style based on status
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'KYC Approved':
      return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
    case 'KYC Rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'Awaiting KYC':
      return <Badge variant="secondary" className="bg-orange-400 text-white hover:bg-orange-500">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const PAGE_SIZE = 10;
const ALL_STATUSES = ["All", "Awaiting KYC", "KYC Approved", "KYC Rejected"];

export default function KycLeadsTable({ currentUserId }: KycLeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead | null; direction: 'ascending' | 'descending' }>({
    key: 'created_at',
    direction: 'descending',
  });

  const supabase = createClient();

  // 1. Data Fetching function
  const fetchLeads = async (setLoading = false) => {
    if (setLoading) setIsLoading(true);
    
    // Fetch leads assigned to the current KYC member
    const { data, error } = await supabase
      .from("leads")
      // Ensure all necessary columns are selected, including kyc_member_id for data check
      .select("id, full_name, phone, loan_amount, status, created_at, kyc_member_id")
      .eq("kyc_member_id", currentUserId)
      .limit(1000); 

    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data as Lead[]);
    }
    if (setLoading) setIsLoading(false);
  };

  // 2. Real-time Listener and Initial Load
  useEffect(() => {
    // Initial fetch to populate the table
    fetchLeads(true); 

    // Setup Real-time Listener for the 'leads' table
    const channel = supabase.channel(`kyc_leads_user_${currentUserId}`);

    const subscription = channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          // Determine if the change (insert, update, delete) is relevant to the current user
          const changedLead = payload.new as Lead | null;
          const oldLead = payload.old as Lead | null;
          
          // The lead is relevant if it is assigned to the current user either before or after the change
          const isRelevant = 
             changedLead?.kyc_member_id === currentUserId || 
             oldLead?.kyc_member_id === currentUserId; 

          if (isRelevant) {
             console.log("Relevant lead change detected. Refetching leads...");
             // Refetch all leads to maintain current filters, sorting, and pagination
             fetchLeads(false); 
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to KYC leads changes for user: ${currentUserId}`);
        }
      });

    // Cleanup function: remove the channel when the component unmounts or userId changes
    return () => {
        supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]); // currentUserId is the dependency

  // 3. Filtering, Sorting, and Pagination Logic
  const sortedLeads = useMemo(() => {
    let filtered = leads;

    // A. Filtering by Search Term
    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.full_name.toLowerCase().includes(lowerCaseSearch) ||
          lead.phone.includes(searchTerm)
      );
    }

    // B. Filtering by Status
    if (statusFilter !== "All") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // C. Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [leads, searchTerm, statusFilter, sortConfig]);

  // D. Pagination calculation
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedLeads.slice(start, end);
  }, [sortedLeads, currentPage]);

  const totalPages = Math.ceil(sortedLeads.length / PAGE_SIZE);

  // 4. UI Handlers
  const requestSort = (key: keyof Lead) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Lead) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
    }
  };


  return (
    <div className="space-y-4">
      {/* Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center space-x-2 w-full sm:w-1/2">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by Name or Phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="w-full"
          />
        </div>
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1); // Reset to first page on filter change
          }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map(status => (
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
                <TableHead onClick={() => requestSort('full_name')} className="cursor-pointer hover:bg-gray-100 transition-colors w-1/4">
                  Lead Name {getSortIcon('full_name')}
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Loan Amount</TableHead>
                <TableHead onClick={() => requestSort('created_at')} className="cursor-pointer hover:bg-gray-100 transition-colors hidden lg:table-cell">
                  Assigned Date {getSortIcon('created_at')}
                </TableHead>
                <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:bg-gray-100 transition-colors">
                  Status {getSortIcon('status')}
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-gray-600">Loading leads...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    No KYC leads found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium text-primary hover:underline w-1/4">
                      <Link href={`/kyc-team/${lead.id}`}>{lead.full_name}</Link>
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-500" />
                        {lead.phone}
                    </TableCell>
                    <TableCell className="hidden md:table-cell flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {lead.loan_amount ? `₹${lead.loan_amount.toLocaleString()}` : "N/A"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                        <Calendar className="h-3 w-3 mr-1 inline text-gray-500" />
                        {new Date(lead.created_at).toLocaleDateString()}
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
                                View Details
                            </Link>
                          </DropdownMenuItem>
                          {lead.status === 'Awaiting KYC' && (
                            <DropdownMenuItem 
                                onClick={() => { /* Placeholder for quick action dialog */ }}
                                className="text-purple-600 focus:bg-purple-50"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Quick Approve
                            </DropdownMenuItem>
                          )}
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
      
      {/* Pagination */}
      <div className="flex justify-between items-center py-4">
          <p className="text-sm text-gray-600">
              Showing page {currentPage} of {totalPages} ({sortedLeads.length} leads)
          </p>
          <div className="flex space-x-2">
              <Button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1 || isLoading}
                  variant="outline"
              >
                  Previous
              </Button>
              <Button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages || isLoading}
                  variant="outline"
              >
                  Next
              </Button>
          </div>
      </div>
    </div>
  );
}
