"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, DollarSign, BarChart3, TrendingUp, Filter, 
  Users, Calendar, Plus, Search, CheckCircle2 
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

// --- TYPES ---

interface LeadDisbursement {
    id: string;
    name: string;
    phone: string;
    assigned_to: string;
    assigned_name?: string; // Telecaller Name
    loan_amount: number;
    disbursed_amount: number;
    disbursed_at: string;
    bank_name: string;
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
    }).format(value || 0);
};

const getMonthName = (monthKey: string) => {
    if (!monthKey || monthKey.length !== 7) return "Invalid Date";
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
};

// --- COMPONENT: ADD DISBURSEMENT DIALOG ---

function AddDisbursementDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [phoneSearch, setPhoneSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [foundLead, setFoundLead] = useState<any>(null);
    const [formData, setFormData] = useState({
        disbursed_amount: "",
        bank_name: "",
        notes: ""
    });
    const [saving, setSaving] = useState(false);
    const supabase = createClient();
    const { toast } = useToast();

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setFoundLead(null);
            setPhoneSearch("");
            setFormData({ disbursed_amount: "", bank_name: "", notes: "" });
        }
    }, [open]);

    const handleSearch = async () => {
        if (!phoneSearch) return;
        setSearching(true);
        setFoundLead(null);

        try {
            // Fetch lead and join with users table to get telecaller name
            const { data, error } = await supabase
                .from('leads')
                .select(`
                    id, name, phone, loan_amount, assigned_to, 
                    users:assigned_to (full_name)
                `)
                .eq('phone', phoneSearch)
                .single();

            if (error) throw error;

            if (data) {
                setFoundLead(data);
                // Pre-fill amount if loan_amount exists
                if(data.loan_amount) {
                    setFormData(prev => ({...prev, disbursed_amount: data.loan_amount.toString()}));
                }
            }
        } catch (error) {
            toast({
                title: "Lead not found",
                description: "No lead found with this phone number.",
                variant: "destructive"
            });
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async () => {
        if (!foundLead || !formData.disbursed_amount || !formData.bank_name) {
            toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    status: 'DISBURSED',
                    disbursed_amount: parseFloat(formData.disbursed_amount),
                    bank_name: formData.bank_name,
                    disbursed_at: new Date().toISOString(), // Mark time of disbursement
                    notes: formData.notes ? formData.notes : undefined // Optional update notes
                })
                .eq('id', foundLead.id);

            if (error) throw error;

            toast({ title: "Success", description: "Disbursement recorded successfully!" });
            setOpen(false);
            onSuccess(); // Refresh parent data
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4" /> Add Disbursement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Record New Disbursement</DialogTitle>
                    <DialogDescription>
                        Search for a lead by phone number to mark it as disbursed.
                    </DialogDescription>
                </DialogHeader>

                {!foundLead ? (
                    <div className="flex gap-2 py-4">
                        <Input 
                            placeholder="Enter Customer Phone Number" 
                            value={phoneSearch}
                            onChange={(e) => setPhoneSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={searching}>
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        {/* Read Only Lead Details */}
                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">Customer:</span>
                                <span className="text-sm">{foundLead.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">Phone:</span>
                                <span className="text-sm">{foundLead.phone}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">Assigned Telecaller:</span>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {/* @ts-ignore - Supabase join returns object or array */}
                                    {foundLead.users?.full_name || "Unassigned"}
                                </Badge>
                            </div>
                        </div>

                        {/* Input Fields */}
                        <div className="grid gap-2">
                            <Label>Disbursed Amount (₹) <span className="text-red-500">*</span></Label>
                            <Input 
                                type="number" 
                                value={formData.disbursed_amount}
                                onChange={(e) => setFormData({...formData, disbursed_amount: e.target.value})}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Bank Name <span className="text-red-500">*</span></Label>
                            <Select 
                                value={formData.bank_name} 
                                onValueChange={(val) => setFormData({...formData, bank_name: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Bank" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                                    <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                                    <SelectItem value="Fi Money">Fi Money</SelectItem>
                                    <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                                    <SelectItem value="Kotak Bank">Kotak Bank</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid gap-2">
                            <Label>Notes (Optional)</Label>
                            <Input 
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                placeholder="Any reference number or notes"
                            />
                        </div>

                        <Button 
                            className="w-full bg-green-600 hover:bg-green-700 mt-2" 
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Confirm Disbursement
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-gray-500" 
                            onClick={() => setFoundLead(null)}
                        >
                            Search Different Number
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// --- MAIN PAGE COMPONENT ---

export default function TelecallerDisbursementReport() {
    
    // --- STATE ---
    const [currentYear] = useState(() => new Date().getFullYear());
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState('all'); 
    
    const [loading, setLoading] = useState(true);
    const [rawDisbursements, setRawDisbursements] = useState<LeadDisbursement[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // To reload data after create

    const supabase = createClient();
    const { toast } = useToast();

    // --- DATA FETCHING ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        const startOfYear = `${selectedYear}-01-01T00:00:00.000Z`;
        const endOfYear = `${parseInt(selectedYear) + 1}-01-01T00:00:00.000Z`;

        const { data, error } = await supabase
            .from('leads')
            .select(`
                id, name, phone, assigned_to, loan_amount, disbursed_amount, disbursed_at, bank_name,
                users:assigned_to (full_name)
            `)
            .eq('status', 'DISBURSED')
            .gte('disbursed_at', startOfYear)
            .lt('disbursed_at', endOfYear)
            .order('disbursed_at', { ascending: false }); // Newest first

        if (error) {
            console.error('Error fetching leads:', error);
            toast({ title: "Error", description: "Failed to load report data", variant: "destructive" });
        } else {
            // Transform data to flatten the joined user name
            const formatted: LeadDisbursement[] = (data || []).map((d: any) => ({
                ...d,
                assigned_name: d.users?.full_name || 'Unknown'
            }));
            setRawDisbursements(formatted);
        }
        setLoading(false);
    }, [selectedYear, supabase, toast, refreshTrigger]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- AGGREGATION LOGIC (For the summary table) ---
    const { aggregatedData, grandTotal, uniqueMonths } = useMemo(() => {
        const aggregates: { [key: string]: MonthlyDisbursement } = {};
        let total = 0;
        const monthsSet = new Set<string>();

        rawDisbursements.forEach(d => {
            if (!d.disbursed_at) return;
            
            total += (d.disbursed_amount || 0);
            const monthKey = d.disbursed_at.substring(0, 7); // YYYY-MM
            monthsSet.add(monthKey);

            // Filter logic for summary table if month is selected
            if (selectedMonth !== 'all' && monthKey !== selectedMonth) return;

            const key = `${d.assigned_to}-${monthKey}`;

            if (!aggregates[key]) {
                aggregates[key] = {
                    telecallerId: d.assigned_to || 'unassigned',
                    telecallerName: d.assigned_name || 'Unassigned',
                    monthKey: monthKey,
                    totalAmount: 0,
                };
            }
            aggregates[key].totalAmount += (d.disbursed_amount || 0);
        });

        // Convert Map to Array and Sort
        const aggArray = Object.values(aggregates).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        const monthsArray = Array.from(monthsSet).sort().reverse();

        return { aggregatedData: aggArray, grandTotal: total, uniqueMonths: monthsArray };
    }, [rawDisbursements, selectedMonth]);


    // --- FILTER LOGIC (For the detailed list view) ---
    const filteredList = useMemo(() => {
        if (selectedMonth === 'all') return rawDisbursements;
        return rawDisbursements.filter(d => d.disbursed_at && d.disbursed_at.startsWith(selectedMonth));
    }, [rawDisbursements, selectedMonth]);


    // --- RENDER ---
    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <DollarSign className="h-7 w-7 text-green-600" />
                        Disbursement Report
                    </h1>
                    <p className="text-gray-500">Track performance and record new disbursements</p>
                </div>
                
                {/* NEW: Create Disbursement Button */}
                <AddDisbursementDialog onSuccess={() => setRefreshTrigger(p => p + 1)} />
            </div>

            {/* Summary Card & Filters */}
            <Card className="shadow-lg border-green-100 bg-white">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="md:col-span-1 border-r md:border-r-2 border-green-100 pr-6">
                        <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Total Disbursed ({selectedYear})
                        </p>
                        <p className="text-4xl font-extrabold text-green-700 mt-2 break-words">
                            {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : formatCurrency(grandTotal)}
                        </p>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">Select Year</label>
                            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={loading}>
                                <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent>
                                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">Filter Month</label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                                <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {uniqueMonths.map(m => (
                                        <SelectItem key={m} value={m}>{getMonthName(m)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Aggregated Performance Table */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" /> Telecaller Performance
                        </CardTitle>
                        <CardDescription>Aggregated totals by month and agent</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[500px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Telecaller</TableHead>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {aggregatedData.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500">No data available</TableCell></TableRow>
                                ) : (
                                    aggregatedData.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{item.telecallerName}</TableCell>
                                            <TableCell>{getMonthName(item.monthKey)}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(item.totalAmount)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 2. Detailed List View (Serial Wise) */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" /> Detailed Disbursements
                        </CardTitle>
                        <CardDescription>Individual disbursement records</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[500px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Lead Info</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredList.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500">No records found</TableCell></TableRow>
                                ) : (
                                    filteredList.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium text-gray-500">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.assigned_name}</div>
                                                <div className="text-xs text-gray-400">{new Date(item.disbursed_at).toLocaleDateString()}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{item.bank_name || 'N/A'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-gray-700">
                                                {formatCurrency(item.disbursed_amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
