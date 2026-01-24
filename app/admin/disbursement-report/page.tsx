"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, TrendingUp, Filter, Calendar, Trash2, 
  MapPin, Search, RefreshCw, X, Users, Download, Trophy, Medal 
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CSVLink } from "react-csv" // NEW: For Export
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts' // NEW: For Charts

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

import { DisbursementModal } from "@/components/admin/disbursement-modal"

// --- TYPES ---
interface LeadDisbursement {
    id: string;
    assigned_to: string; 
    disbursed_amount: number;
    disbursed_at: string;
    application_number: string;
    name: string;
    bank_name: string;
    city: string;
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- MAIN COMPONENT ---
export default function TelecallerDisbursementReport() {
    const supabase = createClient();
    const { toast } = useToast();
    
    // --- STATE ---
    const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null); // NEW: For Drill-down

    const [loading, setLoading] = useState(true);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // 1. Fetch Users
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

    // 2. Fetch Leads
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setSelectedAgentId(null); // Reset drill-down on new fetch
        
        let startQuery: string, endQuery: string;

        if (filterMode === 'custom' && customStart && customEnd) {
            startQuery = `${customStart}T00:00:00.000Z`;
            endQuery = `${customEnd}T23:59:59.999Z`;
        } else {
            if (selectedMonth !== 'all') {
                const monthIndex = parseInt(selectedMonth) - 1;
                const startDate = new Date(Number(selectedYear), monthIndex, 1);
                const endDate = new Date(Number(selectedYear), monthIndex + 1, 0);
                
                const y = startDate.getFullYear();
                const m = String(startDate.getMonth() + 1).padStart(2, '0');
                const lastDay = endDate.getDate();
                
                startQuery = `${y}-${m}-01T00:00:00.000Z`;
                endQuery = `${y}-${m}-${lastDay}T23:59:59.999Z`;
            } else {
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

    useEffect(() => {
        fetchUsers().then(() => fetchLeads());
        // Real-time subscription logic (same as before)
        const channel = supabase.channel('disbursement-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                const newData = payload.new as any;
                if (newData.status === 'DISBURSED' || (payload.old as any)?.status === 'DISBURSED') {
                    setTimeout(() => fetchLeads(), 500);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchUsers, fetchLeads, refreshKey, supabase]);

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

    // --- AGGREGATION & ANALYTICS ---
    const { filteredData, grandTotal, displayLabel, bankChartData } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        
        // 1. Filter by Search Term AND Drill-down Agent
        const searched = disbursements.filter(item => {
            // Drill down check
            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;

            // Search Check
            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term);
        });

        searched.forEach(d => { 
            total += d.disbursed_amount; 
            // Bank Stats
            const bank = d.bank_name || 'Others';
            bankMap[bank] = (bankMap[bank] || 0) + d.disbursed_amount;
        });

        // Label Logic
        let label = "Total Disbursed";
        if (selectedAgentId) label = `${userMap[selectedAgentId]}'s Sales`; // Update label on drill-down

        // Chart Data Format
        const bChartData = Object.entries(bankMap).map(([name, value]) => ({ name, value }));

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label,
            bankChartData: bChartData
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId]);

    // Telecaller Stats (Ranked) - Calculated on FULL data set (independent of drill-down)
    const telecallerStats = useMemo(() => {
        const stats: Record<string, number> = {};
        disbursements.forEach(d => {
            const id = d.assigned_to;
            stats[id] = (stats[id] || 0) + (d.disbursed_amount || 0);
        });
        return Object.entries(stats)
            .map(([id, amount]) => ({ id, name: userMap[id] || 'Unknown', amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [disbursements, userMap]);

    // Export Data Preparation
    const csvData = useMemo(() => {
        return filteredData.map(item => ({
            "App No": item.application_number,
            "Date": formatDate(item.disbursed_at),
            "Customer": item.name,
            "Telecaller": userMap[item.assigned_to] || 'Unknown',
            "Bank": item.bank_name,
            "Amount": item.disbursed_amount,
            "City": item.city
        }));
    }, [filteredData, userMap]);

    // --- RENDER HELPERS ---
    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-100" />;
        if (index === 1) return <Medal className="h-4 w-4 text-gray-400 fill-gray-100" />;
        if (index === 2) return <Medal className="h-4 w-4 text-orange-600 fill-orange-100" />;
        return <span className="text-gray-400 text-xs">#{index + 1}</span>;
    };

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-8 w-8 text-green-600" />
                        Disbursement Report
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Analytics & Performance Tracking</p>
                </div>
                <div className="flex gap-2">
                    {/* CSV EXPORT BUTTON */}
                    {csvData.length > 0 && (
                        <CSVLink 
                            data={csvData} 
                            filename={`disbursement_report_${new Date().toISOString().slice(0,10)}.csv`}
                            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                        >
                            <Download className="h-4 w-4" /> Export CSV
                        </CSVLink>
                    )}
                    <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
                </div>
            </div>

            {/* --- CONTROLS --- */}
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
                        <div className="w-full lg:w-1/3 relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Search Name, App No..." 
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {/* Filters (Simplified for brevity, logic remains same) */}
                        <div className="flex flex-wrap gap-2 items-end">
                            <Select value={filterMode} onValueChange={(v:any) => setFilterMode(v)}>
                                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent>
                            </Select>

                            {filterMode === 'monthly' ? (
                                <>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[currentYear-1, currentYear, currentYear+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Full Year</SelectItem>
                                            {Array.from({length: 12}, (_, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')}>{new Date(0,i).toLocaleString('default',{month:'long'})}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <Input type="date" className="w-[140px]" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <Input type="date" className="w-[140px]" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                    <Button onClick={() => fetchLeads()} variant="secondary" size="icon"><RefreshCw className="h-4 w-4"/></Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- TABS FOR VIEWS --- */}
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="dashboard">Dashboard View</TabsTrigger>
                    <TabsTrigger value="data">Data List</TabsTrigger>
                </TabsList>

                {/* --- VIEW 1: DASHBOARD --- */}
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        
                        {/* LEFT COL: Total & Leaderboard */}
                        <div className="md:col-span-4 space-y-6">
                            {/* Total Card */}
                            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-green-700 font-medium text-sm flex items-center gap-1">
                                                {selectedAgentId && <Badge variant="outline" className="mr-2 bg-white text-black cursor-pointer hover:bg-slate-100" onClick={() => setSelectedAgentId(null)}>Clear Filter</Badge>}
                                                {displayLabel}
                                            </p>
                                            <h2 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(grandTotal)}</h2>
                                        </div>
                                        <div className="p-2 bg-green-100 rounded-full">
                                            <TrendingUp className="h-6 w-6 text-green-700" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Leaderboard */}
                            <Card className="h-[400px] flex flex-col">
                                <CardHeader className="py-4 bg-slate-50 border-b">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-600" /> Top Performers
                                    </CardTitle>
                                    <CardDescription>Click a name to filter dashboard</CardDescription>
                                </CardHeader>
                                <div className="flex-1 overflow-y-auto p-2">
                                    {telecallerStats.map((stat, idx) => (
                                        <div 
                                            key={stat.id} 
                                            onClick={() => setSelectedAgentId(stat.id === selectedAgentId ? null : stat.id)}
                                            className={`flex items-center justify-between p-3 rounded-lg mb-1 cursor-pointer transition-all ${selectedAgentId === stat.id ? 'bg-green-100 border border-green-200' : 'hover:bg-slate-50 border border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 flex justify-center">{getRankIcon(idx)}</div>
                                                <div className="text-sm font-medium text-slate-700">{stat.name}</div>
                                            </div>
                                            <div className="text-sm font-bold text-slate-900">{formatCurrency(stat.amount)}</div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* RIGHT COL: Charts */}
                        <div className="md:col-span-8 space-y-6">
                            {/* Bank Distribution Chart */}
                            <Card className="h-[520px]">
                                <CardHeader>
                                    <CardTitle>Bank-wise Disbursement</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[450px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bankChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                                            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]}>
                                                {bankChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#16a34a' : '#15803d'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- VIEW 2: DATA LIST --- */}
                <TabsContent value="data" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex justify-between">
                                <span>Detailed Transactions ({filteredData.length})</span>
                                {selectedAgentId && <Button variant="ghost" size="sm" onClick={() => setSelectedAgentId(null)} className="text-red-500">Clear Agent Filter</Button>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>App No</TableHead>
                                        <TableHead>Telecaller</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Bank</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs text-slate-500">{index+1}</TableCell>
                                            <TableCell className="text-xs font-mono">{item.application_number}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-normal">{userMap[item.assigned_to]}</Badge></TableCell>
                                            <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                            <TableCell className="text-sm text-slate-500">{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell>{item.bank_name}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(item.disbursed_amount)}</TableCell>
                                            <TableCell className="text-center">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredData.length === 0 && <TableRow><TableCell colSpan={8} className="text-center p-8 text-slate-500">No records found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* DELETE ALERT (Same as before) */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the disbursement status. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
