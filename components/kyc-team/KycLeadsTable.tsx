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

interface Lead {
  id: string;
  name: string;
  phone: string;
  loan_amount: number | null;
  status: string;
  created_at: string;
  kyc_assigned_to?: string;
}

interface KycLeadsTableProps {
    currentUserId: string;
    initialStatus: string;
}

const STATUSES = {
    LOGIN_DONE: "Login Done",
    UNDERWRITING: "Underwriting",
    REJECTED: "Rejected",
    APPROVED: "Approved",
    DISBURSED: "Disbursed",
} as const;

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
            return <Badge variant="secondary">{status}</Badge>;
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
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  const supabase = createClient();

  // Direct data fetching with minimal processing
  const fetchLeads = async (setLoading = false) => {
    if (setLoading) setIsLoading(true);
    
    console.log("🔍 Starting fetchLeads with:", { currentUserId, statusFilter });

    try {
      // Simple direct query
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("kyc_member_id", currentUserId)
        .order("created_at", { ascending: false });

      console.log("📊 Raw query response:", { data, error, dataLength: data?.length });

      if (error) {
        console.error("❌ Query error:", error);
        setDebugInfo(`Error: ${error.message}`);
        setLeads([]);
      } else {
        console.log("✅ Data received:", data);
        
        // Check if data is an array and has items
        if (Array.isArray(data) && data.length > 0) {
          console.log("🎯 Setting leads state with:", data.length, "items");
          setLeads(data);
          setDebugInfo(`Success! Found ${data.length} leads:\n${data.map(lead => `• ${lead.name} (${lead.status})`).join('\n')}`);
        } else {
          console.log("⚠️ No data or empty array");
          setLeads([]);
          setDebugInfo("No leads found in the response array");
        }
      }
    } catch (error) {
      console.error("💥 Unexpected error:", error);
      setDebugInfo(`Unexpected error: ${error}`);
      setLeads([]);
    } finally {
      if (setLoading) setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    console.log("🚀 Component mounted, fetching leads...");
    fetchLeads(true);
  }, [currentUserId, statusFilter]);

  // Filtering Logic
  const filteredLeads = useMemo(() => {
    console.log("🔍 Filtering leads:", { total: leads.length, searchTerm });
    
    if (!searchTerm) return leads;
    
    const lowerCaseSearch = searchTerm.toLowerCase();
    const filtered = leads.filter(
      (lead) => 
        lead.name.toLowerCase().includes(lowerCaseSearch) ||
        lead.phone.includes(lowerCaseSearch) ||
        lead.id.toLowerCase().includes(lowerCaseSearch)
    );
    
    console.log("📋 Filtered results:", filtered.length);
    return filtered;
  }, [leads, searchTerm]);

  // Function to display assigned to information
  const getAssignedInfo = (lead: Lead) => {
    if (lead.kyc_assigned_to) {
      return `Assigned to: ${lead.kyc_assigned_to.substring(0, 8)}...`;
    }
    return "Unassigned";
  };

  return (
    <div className="space-y-4">
      {/* Debug Information */}
      <Card className="bg-yellow-50 border-yellow-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-yellow-800">Debug Information</h3>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log("Current state:", { leads, filteredLeads, isLoading, currentUserId });
                fetchLeads(true);
              }}
            >
              Refresh & Log
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                // Test direct query
                supabase
                  .from("leads")
                  .select("*")
                  .eq("kyc_member_id", currentUserId)
                  .then(({ data, error }) => {
                    console.log("Direct test query:", { data, error });
                    alert(`Direct query result: ${data?.length || 0} leads, error: ${error?.message || 'none'}`);
                  });
              }}
            >
              Test Query
            </Button>
          </div>
        </div>
        <div className="text-sm text-yellow-700 space-y-1">
          <div><strong>User ID:</strong> {currentUserId}</div>
          <div><strong>Status Filter:</strong> {statusFilter}</div>
          <div><strong>Leads in state:</strong> {leads.length}</div>
          <div><strong>Filtered leads:</strong> {filteredLeads.length}</div>
        </div>
        <pre className="text-xs text-yellow-600 mt-2 whitespace-pre-wrap overflow-auto max-h-20">
          {debugInfo}
        </pre>
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center space-x-2 w-full sm:w-1/2">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by Name, Phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-4 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
                    <p className="mt-2 text-gray-600">Loading leads...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    <Users className="w-6 h-6 mx-auto mb-2"/>
                    {leads.length === 0 
                      ? "No leads found in database for your account." 
                      : "No leads match your search criteria."}
                    <p className="text-xs mt-2">User ID: {currentUserId}</p>
                    <p className="text-xs">Leads in state: {leads.length} | After search: {filteredLeads.length}</p>
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
        Displaying {filteredLeads.length} of {leads.length} leads.
        {leads.length > 0 && (
          <span className="text-xs text-green-600 ml-2">✓ Data loaded successfully</span>
        )}
      </div>
    </div>
  );
}
