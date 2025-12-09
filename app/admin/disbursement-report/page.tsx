"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, DollarSign, BarChart3, TrendingUp, Filter, Users, Calendar } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
// IMPORT THE NEW MODAL
import { DisbursementModal } from "@/components/admin/disbursement-modal"

// --- TYPES ---
interface LeadDisbursement {
    id: string;
    assigned_to: string; 
    disbursed_amount: number;
    disbursed_at: string; 
}

interface UserMap {
    [id: string]: string; 
}

interface MonthlyDisbursement {
    telecallerId: string;
    telecallerName: string;
    monthKey: string; 
    totalAmount: number;
}

// --- UTILITIES ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
};

const getMonthName = (monthKey: string) => {
    if (!monthKey || monthKey.length !== 7) return "Invalid Date";
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
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
    const [error, setError] = useState<string | null>(null);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    // Refresh Trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // 1. Fetch Users
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

    // 2. Fetch Leads (Disbursements)
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
        const endOfYear = `${Number(selectedYear) + 1}-01-01T00:00:00.000Z`;

        const { data, error } = await supabase
            .from('leads')
            .select('id, assigned_to, disbursed_amount, disbursed_at')
            .eq('status', 'DISBURSED')
            .gte('disbursed_at', startOfYear)
            .lt('disbursed_at', endOfYear);

        if (error) {
            console.error('Error fetching leads:', error);
            setError(`Failed to load data.`);
            setLoading(false);
            return;
        }

        setDisbursements((data || []) as LeadDisbursement[]);
        setLoading(false);
    }, [supabase, selectedYear]);

    // Initial Load & Refresh
    useEffect(() => {
        fetchUsers().then(() => fetchLeads());
    }, [fetchUsers, fetchLeads, refreshKey]); // dependency on refreshKey allows re-fetching

    // --- AGGREGATION LOGIC ---
    const { aggregatedData, grandTotal, uniqueMonths } = useMemo(() => {
        const aggregates: { [key: string]: MonthlyDisbursement } = {};
        const monthsSet = new Set<string>();
        let total = 0;

        disbursements.forEach(d => {
            if (!d.disbursed_at || !d.assigned_to) return;

            const monthKey = d.disbursed_at.substring(0, 7); // YYYY-MM
            monthsSet.add(monthKey);
            
            const key = `${d.assigned_to}-${monthKey}`;

            if (!aggregates[key]) {
                aggregates[key] = {
                    telecallerId: d.assigned_to,
                    telecallerName: userMap[d.assigned_to] || 'Unknown',
                    monthKey: monthKey,
                    totalAmount: 0,
                };
            }
            aggregates[key].totalAmount += d.disbursed_amount || 0;
            total += d.disbursed_amount || 0;
        });

        const sortedData = Object.values(aggregates).sort((a, b) => {
            if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
            return a.telecallerName.localeCompare(b.telecallerName);
        });

        return {
            aggregatedData: sortedData,
            grandTotal: total,
            uniqueMonths: Array.from(monthsSet).sort()
        };
    }, [disbursements, userMap]);

    // Filter Logic
    const filteredData = useMemo(() => {
        if (selectedMonth === 'all') return aggregatedData;
        return aggregatedData.filter(d => d.monthKey === selectedMonth);
    }, [aggregatedData, selectedMonth]);

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
                    Telecaller Disbursement Report
                </h1>
                
                {/* NEW CREATE BUTTON COMPONENT */}
                <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>

            {/* Summary Card */}
            <Card className="shadow-lg">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1 border-r md:border-r-2 border-green-200 pr-6">
                        <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Grand Total ({selectedYear})
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
                                <Filter className="h-4 w-4" /> Month
                            </label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading || uniqueMonths.length === 0}>
                                <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {uniqueMonths.map(m => <SelectItem key={m} value={m}>{getMonthName(m)}</SelectItem>)}
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
                        Monthly Performance Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                            Loading data...
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            <p className="text-lg font-semibold">No Data Found</p>
                            <p className="text-sm">No disbursements recorded for this period.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead className="w-[60px] text-gray-600">S.No</TableHead>
                                        <TableHead className="text-gray-600">Telecaller Name</TableHead>
                                        <TableHead className="text-gray-600">Month</TableHead>
                                        <TableHead className="text-right text-gray-600">Disbursed Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.telecallerId + item.monthKey} className="hover:bg-green-50">
                                            <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                                            <TableCell className="font-semibold text-gray-800">{item.telecallerName}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{getMonthName(item.monthKey)}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">
                                                {formatCurrency(item.totalAmount)}
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
