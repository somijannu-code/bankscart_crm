"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, DollarSign, BarChart3, TrendingUp, Filter, Calendar } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
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

const getMonthName = (dateString: string) => {
    if(!dateString) return "-";
    return new Date(dateString).toLocaleString('en-US', { month: 'long' });
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
    
    // Refresh Trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // 1. Fetch Users (Telecallers)
    const fetchUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'telecaller'); 

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
            .eq('status', 'DISBURSED')
            .gte('disbursed_at', startOfYear)
            .lt('disbursed_at', endOfYear)
            .order('disbursed_at', { ascending: false })
            .limit(5000); // FIXED: Increased limit from default 1000 to 5000 to prevent data cutoff

        if (error) {
            console.error('Error fetching leads:', error);
            toast({ title: "Error", description: "Failed to fetch transactions", variant: "destructive" });
            setLoading(false);
            return;
        }

        // Ensure disbursed_amount is a number
        const safeData = (data || []).map(d => ({
            ...d,
            disbursed_amount: Number(d.disbursed_amount) || 0
        }));

        setDisbursements(safeData as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, selectedYear, toast]);

    // Initial Load & Refresh
    useEffect(() => {
        fetchUsers().then(() => fetchLeads());
    }, [fetchUsers, fetchLeads, refreshKey]);

    // --- AGGREGATION & FILTERING ---
    const { filteredData, grandTotal, uniqueMonths, displayLabel } = useMemo(() => {
        const monthsSet = new Set<string>();
        let total = 0;

        // 1. Identify all available months in data
        disbursements.forEach(d => {
            if (d.disbursed_at) {
                const monthKey = d.disbursed_at.substring(0, 7); // YYYY-MM
                monthsSet.add(monthKey);
            }
        });
        
        // 2. Filter data
        const filtered = disbursements.filter(d => {
            if (selectedMonth === 'all') return true;
            return d.disbursed_at && d.disbursed_at.startsWith(selectedMonth);
        });

        // 3. Calculate Total
        filtered.forEach(d => {
             total += d.disbursed_amount;
        });

        // 4. Generate Dynamic Label (e.g. "Total (2025)" vs "Total (February)")
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
                    <DollarSign className="h-7 w-7 text-green-600" />
                    Disbursement Report
                </h1>
                
                {/* NEW COMPONENT for Adding Disbursements */}
                <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>

            {/* Summary Card */}
            <Card className="shadow-lg">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1 border-r md:border-r-2 border-green-200 pr-6">
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
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Calendar className="h-4 w-4" /> Year
                            </label>
                            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={loading}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Filter className="h-4 w-4" /> Filter Month
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
                                <TableHeader className="bg-gray-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-[60px]">S.No</TableHead>
                                        <TableHead>App Number</TableHead>
                                        <TableHead>Telecaller Name</TableHead>
                                        <TableHead>Customer Name</TableHead>
                                        <TableHead>Disbursement Date</TableHead>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Bank Name</TableHead>
                                        <TableHead className="text-right">Disbursed Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-gray-50">
                                            <TableCell className="text-gray-500">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{item.application_number || '-'}</TableCell>
                                            <TableCell className="font-semibold text-blue-700">
                                                {userMap[item.assigned_to] || 'Unknown'}
                                            </TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell>{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell className="text-gray-600">{getMonthName(item.disbursed_at)}</TableCell>
                                            <TableCell>{item.bank_name || '-'}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">
                                                {formatCurrency(item.disbursed_amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
