"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, IndianRupee, BarChart3, TrendingUp, Filter, Calendar, Trash2, MapPin, Search, RefreshCw, X, Users } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// IMPORT YOUR MODAL COMPONENT
import { DisbursementModal } from "@/components/admin/disbursement-modal"

// --- TYPES ---
interface LeadDisbursement {
    id: string;
    assigned_to: string; 
    disbursed_amount: number;
    disbursed_at: string; // ISO String
    application_number: string;
    name: string; // Customer Name
    bank_name: string;
    city: string; // Location
}

interface UserMap {
    [id: string]: string; 
}

// --- UTILITIES ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
};

const formatDate = (dateString: string) => {
    if(!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

// --- MAIN COMPONENT ---
export default function TelecallerDisbursementReport() {
    const supabase = createClient();
    const { toast } = useToast();
    
    // --- STATE ---
    
    // Filter Mode: 'monthly' (Dropdowns) or 'custom' (Date Range)
    const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');

    // 1. Monthly Filters
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '01', '02', etc.

    // 2. Custom Date Filters
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    // 3. Search Filter
    const [searchTerm, setSearchTerm] = useState("");

    // Data State
    const [loading, setLoading] = useState(true);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    // Delete State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Refresh Trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // 1. Fetch Users (Telecallers)
    const fetchUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name')
            .in('role', ['telecaller', 'team_leader']); 

        if (error) {
            console.error('Error fetching users:', error);
            return;
        }
        
        const map: UserMap = {};
        (data || []).forEach(user => {
            map[user.id] = user.full_name || `ID: ${user.id.substring(0, 5)}`;
        });
        setUserMap(map);
    }, [supabase]);

    // 2. Fetch Leads (Transactions) based on Filters
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        
        let startQuery: string, endQuery: string;

        // LOGIC: Determine Date Range based on Filter Mode
        if (filterMode === 'custom' && customStart && customEnd) {
            // Custom Range
            startQuery = `${customStart}T00:00:00.000Z`;
            endQuery = `${customEnd}T23:59:59.999Z`;
        } else {
            // Monthly Mode (Default)
            if (selectedMonth !== 'all') {
                // Specific Month Selected
                const monthIndex = parseInt(selectedMonth) - 1; // 0-based
                const startDate = new Date(Number(selectedYear), monthIndex, 1);
                const endDate = new Date(Number(selectedYear), monthIndex + 1, 0); // Last day of month
                
                // Creating simplified ISO strings
                const y = startDate.getFullYear();
                const m = String(startDate.getMonth() + 1).padStart(2, '0');
                const lastDay = endDate.getDate();
                
                startQuery = `${y}-${m}-01T00:00:00.000Z`;
                endQuery = `${y}-${m}-${lastDay}T23:59:59.999Z`;
            } else {
                // Whole Year
                startQuery = `${selectedYear}-01-01T00:00:00.000Z`;
                endQuery = `${Number(selectedYear) + 1}-01-01T00:00:00.000Z`;
            }
        }

        const { data, error } = await supabase
            .from('leads')
            .select('id, assigned_to, disbursed_amount, disbursed_at, application_number, name, bank_name, city')
            .eq('status', 'DISBURSED') 
            .gte('disbursed_at', startQuery)
            .lte('disbursed_at', endQuery)
            .order('disbursed_at', { ascending: false })
            .limit(5000); 

        if (error) {
            console.error('Error fetching leads:', error);
            toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
            setLoading(false);
            return;
        }

        const safeData = (data || []).map(d => ({
            ...d,
            disbursed_amount: Number(d.disbursed_amount) || 0
        }));

        setDisbursements(safeData as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, filterMode, selectedYear, selectedMonth, customStart, customEnd, toast]);

    // 3. INITIAL LOAD & REAL-TIME SUBSCRIPTION
    useEffect(() => {
        fetchUsers().then(() => fetchLeads());

        const channel = supabase
            .channel('disbursement-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                const newData = payload.new as any;
                if (newData.status === 'DISBURSED' || (payload.old as any)?.status === 'DISBURSED') {
                    setTimeout(() => fetchLeads(), 500);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchUsers, fetchLeads, refreshKey, supabase]);

    // 4. Delete Handler
    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('leads')
                .update({ status: 'Interested', disbursed_amount: null, disbursed_at: null })
                .eq('id', deleteId);
            if (error) throw error;
            toast({ title: "Deleted", description: "Transaction removed successfully." });
            setRefreshKey(prev => prev + 1); 
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    // --- CLIENT-SIDE SEARCH & AGGREGATION ---
    const { filteredData, grandTotal, displayLabel } = useMemo(() => {
        let total = 0;
        
        // Apply Text Search (Telecaller Name OR Customer Name)
        const searched = disbursements.filter(item => {
            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term);
        });

        searched.forEach(d => { total += d.disbursed_amount; });

        let label = "Total Disbursed";
        if (filterMode === 'monthly') {
            if (selectedMonth === 'all') label += ` (${selectedYear})`;
            else {
                const date = new Date(Number(selectedYear), parseInt(selectedMonth)-1, 1);
                label += ` (${date.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
            }
        } else {
            if (customStart && customEnd) label += ` (${customStart} to ${customEnd})`;
            else label += " (Custom Range)";
        }

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label
        };
    }, [disbursements, searchTerm, userMap, filterMode, selectedYear, selectedMonth, customStart, customEnd]);

    // --- NEW: TELECALLER AGGREGATION ---
    const telecallerStats = useMemo(() => {
        const stats: Record<string, number> = {};
        
        // We use 'disbursements' (the full date-filtered list) instead of 'filteredData'
        // so the leaderboard remains visible even when searching for a specific customer in the table.
        disbursements.forEach(d => {
            const id = d.assigned_to;
            stats[id] = (stats[id] || 0) + (d.disbursed_amount || 0);
        });

        return Object.entries(stats)
            .map(([id, amount]) => ({
                id,
                name: userMap[id] || 'Unknown',
                amount
            }))
            .sort((a, b) => b.amount - a.amount); // Descending Order
    }, [disbursements, userMap]);

    const availableYears = useMemo(() => {
        const years = [];
        for (let i = currentYear - 2; i <= currentYear + 1; i++) years.push(String(i));
        return years;
    }, [currentYear]);

    return (
        <div className="p-4 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <IndianRupee className="h-7 w-7 text-green-600" />
                        Disbursement Report
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Track and manage processed disbursements</p>
                </div>
                <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>

            {/* --- FILTER SECTION --- */}
            <Card className="shadow-sm border-gray-200">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
                        
                        {/* LEFT: Search Bar */}
                        <div className="w-full lg:w-1/3 relative">
                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Search Records</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input 
                                    placeholder="Search by Telecaller or Customer..." 
                                    className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Date Filters */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            
                            {/* Toggle Mode */}
                            <div className="flex flex-col">
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Filter Type</label>
                                <Select value={filterMode} onValueChange={(val: any) => setFilterMode(val)}>
                                    <SelectTrigger className="w-[140px] bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly View</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* CONDITIONAL INPUTS */}
                            {filterMode === 'monthly' ? (
                                <>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Year</label>
                                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                                            <SelectTrigger className="w-[100px] bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Month</label>
                                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                            <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Whole Year</SelectItem>
                                                {Array.from({length: 12}, (_, i) => {
                                                    const date = new Date(2000, i, 1);
                                                    return <SelectItem key={i} value={String(i+1).padStart(2, '0')}>{date.toLocaleString('default', { month: 'long' })}</SelectItem>
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">From Date</label>
                                        <Input 
                                            type="date" 
                                            className="w-[150px] bg-white" 
                                            value={customStart}
                                            onChange={(e) => setCustomStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">To Date</label>
                                        <Input 
                                            type="date" 
                                            className="w-[150px] bg-white" 
                                            value={customEnd}
                                            onChange={(e) => setCustomEnd(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <Button 
                                            onClick={() => fetchLeads()} 
                                            disabled={!customStart || !customEnd || loading}
                                            variant="secondary"
                                            className="gap-2"
                                        >
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                                            Apply
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- STATS GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Grand Total Card */}
                <Card className="shadow-sm border-l-4 border-l-green-600 bg-white md:col-span-1 flex flex-col justify-center">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                    {displayLabel}
                                </p>
                                <p className="text-3xl font-extrabold text-gray-900 mt-2">
                                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : formatCurrency(grandTotal)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Telecaller Breakdown Card */}
                <Card className="shadow-sm border-gray-200 md:col-span-2">
                    <CardHeader className="py-4 border-b border-gray-100 bg-gray-50/50">
                        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Users className="h-4 w-4 text-indigo-600"/>
                            Telecaller Performance (Ranked)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[150px] overflow-y-auto">
                            {loading ? (
                                <div className="p-4 text-center text-xs text-gray-400">Loading stats...</div>
                            ) : telecallerStats.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400">No data available</div>
                            ) : (
                                <Table>
                                    <TableBody>
                                        {telecallerStats.map((stat, idx) => (
                                            <TableRow key={stat.id} className="border-b-0 hover:bg-gray-50">
                                                <TableCell className="py-2 text-xs font-medium text-gray-500 w-[50px]">
                                                    #{idx + 1}
                                                </TableCell>
                                                <TableCell className="py-2 text-sm font-medium text-gray-800">
                                                    {stat.name}
                                                </TableCell>
                                                <TableCell className="py-2 text-sm font-bold text-green-700 text-right">
                                                    {formatCurrency(stat.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card className="shadow-lg border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Transactions ({filteredData.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                            Loading data...
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-16 text-center text-gray-500">
                            <Filter className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-lg font-medium">No records found</p>
                            <p className="text-sm">Try adjusting your search or date filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead className="w-[50px] font-bold">#</TableHead>
                                        <TableHead className="font-bold">App No.</TableHead>
                                        <TableHead className="font-bold">Telecaller</TableHead>
                                        <TableHead className="font-bold">Customer</TableHead>
                                        <TableHead className="font-bold">Disbursed On</TableHead>
                                        <TableHead className="font-bold">Bank</TableHead>
                                        <TableHead className="text-right font-bold">Amount</TableHead>
                                        <TableHead className="w-[50px] text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-gray-50">
                                            <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs text-gray-600">{item.application_number || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium border-0">
                                                    {userMap[item.assigned_to] || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{item.name}</span>
                                                    {item.city && (
                                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" /> {item.city}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {item.bank_name || 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-green-700">
                                                {formatCurrency(item.disbursed_amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => setDeleteId(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DELETE CONFIRMATION DIALOG */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the disbursement status from this lead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
