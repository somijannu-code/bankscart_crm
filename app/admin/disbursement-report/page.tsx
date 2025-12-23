"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, IndianRupee, BarChart3, TrendingUp, Filter, Calendar, Trash2, MapPin } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
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
    
    // State
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState('all');
    
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

    // 2. Fetch Leads (Transactions)
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        
        const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
        const endOfYear = `${Number(selectedYear) + 1}-01-01T00:00:00.000Z`;

        const { data, error } = await supabase
            .from('leads')
            .select('id, assigned_to, disbursed_amount, disbursed_at, application_number, name, bank_name, city')
            .eq('status', 'DISBURSED') // Only fetch if status is DISBURSED
            .gte('disbursed_at', startOfYear)
            .lt('disbursed_at', endOfYear)
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
    }, [supabase, selectedYear, toast]);

    // 3. INITIAL LOAD & REAL-TIME SUBSCRIPTION
    useEffect(() => {
        // Initial Fetch
        fetchUsers().then(() => fetchLeads());

        // --- REAL-TIME LISTENER START ---
        const channel = supabase
            .channel('disbursement-updates')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT and UPDATE
                    schema: 'public',
                    table: 'leads'
                },
                (payload) => {
                    const newData = payload.new as any;
                    
                    // Logic: Only refresh if the lead is 'DISBURSED' or if a 'DISBURSED' lead was changed
                    if (newData.status === 'DISBURSED' || (payload.old as any)?.status === 'DISBURSED') {
                        console.log("⚡ Real-time update detected:", payload);
                        
                        // Add a small delay to ensure DB write is fully committed before re-fetching
                        setTimeout(() => {
                            fetchLeads();
                            toast({
                                title: "New Update",
                                description: "Disbursement data refreshed automatically.",
                                className: "bg-blue-50 text-blue-700 border-blue-200"
                            });
                        }, 500);
                    }
                }
            )
            .subscribe();

        // Cleanup listener on unmount
        return () => {
            supabase.removeChannel(channel);
        };
        // --- REAL-TIME LISTENER END ---

    }, [fetchUsers, fetchLeads, refreshKey, supabase, toast]);

    // 4. Delete Handler
    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('leads')
                .update({ 
                    status: 'Interested', // Revert to previous status
                    disbursed_amount: null,
                    disbursed_at: null 
                })
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

    // --- AGGREGATION & FILTERING ---
    const { filteredData, grandTotal, uniqueMonths, displayLabel } = useMemo(() => {
        const monthsSet = new Set<string>();
        let total = 0;

        disbursements.forEach(d => {
            if (d.disbursed_at) {
                const monthKey = d.disbursed_at.substring(0, 7); 
                monthsSet.add(monthKey);
            }
        });
        
        const filtered = disbursements.filter(d => {
            if (selectedMonth === 'all') return true;
            return d.disbursed_at && d.disbursed_at.startsWith(selectedMonth);
        });

        filtered.forEach(d => { total += d.disbursed_amount; });

        let label = `Total Disbursed (${selectedYear})`;
        if (selectedMonth !== 'all') {
            const [y, m] = selectedMonth.split('-');
            const date = new Date(Number(y), Number(m)-1, 1);
            label = `Total Disbursed (${date.toLocaleString('default', { month: 'long' })})`;
        }

        return {
            filteredData: filtered,
            grandTotal: total,
            uniqueMonths: Array.from(monthsSet).sort().reverse(),
            displayLabel: label
        };
    }, [disbursements, selectedMonth, selectedYear]);

    const availableYears = useMemo(() => {
        const years = [];
        for (let i = currentYear - 2; i <= currentYear + 1; i++) years.push(String(i));
        return years;
    }, [currentYear]);

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <IndianRupee className="h-7 w-7 text-green-600" />
                    Disbursement Report
                </h1>
                
                <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>

            {/* Summary Card */}
            <Card className="shadow-lg bg-white border-l-4 border-l-green-600">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1 border-r md:border-r-2 border-green-100 pr-6">
                        <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            {displayLabel}
                        </p>
                        <p className="text-4xl font-extrabold text-green-700 mt-2 break-words">
                            {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : formatCurrency(grandTotal)}
                        </p>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Year
                            </label>
                            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={loading}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Filter Month
                            </label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading || uniqueMonths.length === 0}>
                                <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {uniqueMonths.map(m => {
                                        const [y, mon] = m.split('-');
                                        const date = new Date(Number(y), Number(mon)-1, 1);
                                        return <SelectItem key={m} value={m}>{date.toLocaleString('default', { month: 'long' })}</SelectItem>
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <BarChart3 className="h-5 w-5 text-gray-700" />
                        Transactions List ({filteredData.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                            Loading transactions...
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            <p className="text-lg font-semibold">No Data Found</p>
                            <p className="text-sm text-gray-500">No disbursements found for the selected period.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[600px]">
                            <Table>
                                <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-[50px] font-bold text-gray-700">#</TableHead>
                                        <TableHead className="font-bold text-gray-700">App No.</TableHead>
                                        <TableHead className="font-bold text-gray-700">Telecaller</TableHead>
                                        <TableHead className="font-bold text-gray-700">Customer</TableHead>
                                        <TableHead className="font-bold text-gray-700">Disbursed Date</TableHead>
                                        <TableHead className="font-bold text-gray-700">Bank</TableHead>
                                        <TableHead className="text-right font-bold text-gray-700">Amount</TableHead>
                                        <TableHead className="w-[50px] text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-green-50 transition-colors">
                                            <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                                            <TableCell className="font-medium text-xs font-mono">{item.application_number || '-'}</TableCell>
                                            <TableCell className="font-semibold text-blue-700">
                                                {userMap[item.assigned_to] || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{item.name}</span>
                                                    {item.city && (
                                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" /> {item.city}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    {item.bank_name || 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-green-700 text-base">
                                                {formatCurrency(item.disbursed_amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
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
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the disbursement record. This action can be undone by re-adding the disbursement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
