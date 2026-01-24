"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, TrendingUp, Filter, Calendar, Trash2, 
  MapPin, Search, RefreshCw, X, Users, Trophy, Medal,
  Calculator, Building2, MousePointerClick
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// REMOVED react-csv
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts'

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

// --- MAIN COMPONENT ---
export default function TelecallerDisbursementReport() {
    const supabase = createClient();
    const { toast } = useToast();
    
    // --- STATE ---
    const [filterMode, setFilterMode] = useState<'monthly' | 'custom'>('monthly');
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    
    // Custom Date State
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [disbursements, setDisbursements] = useState<LeadDisbursement[]>([]);
    const [userMap, setUserMap] = useState<UserMap>({});
    
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // --- QUICK FILTER HANDLERS ---
    const setQuickFilter = (type: 'today' | 'yesterday' | 'week') => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        
        let start = "";
        let end = `${y}-${m}-${d}`; // Default end is today

        if (type === 'today') {
            start = `${y}-${m}-${d}`;
        } else if (type === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(today.getDate() - 1);
            const yY = yest.getFullYear();
            const yM = String(yest.getMonth() + 1).padStart(2, '0');
            const yD = String(yest.getDate()).padStart(2, '0');
            start = `${yY}-${yM}-${yD}`;
            end = `${yY}-${yM}-${yD}`;
        } else if (type === 'week') {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            const wY = lastWeek.getFullYear();
            const wM = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const wD = String(lastWeek.getDate()).padStart(2, '0');
            start = `${wY}-${wM}-${wD}`;
        }

        setFilterMode('custom');
        setCustomStart(start);
        setCustomEnd(end);
        // We set a small timeout to allow state to update before fetching, or use useEffect. 
        // For simplicity in this patterns, user clicks "Apply" or we trigger fetch immediately if we move logic to useEffect.
        // Here we will just set state, and the user can click Apply, OR we can auto-trigger. 
        // Let's Auto-Trigger via a specialized effect or just let the user click apply? 
        // Better UX: Trigger fetch immediately.
        // Since fetchLeads depends on state, we can't call it immediately here with *new* state.
        // We will just let the user click "Apply" to keep it simple, or use a specific useEffect.
    };

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
        setSelectedAgentId(null);
        
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
    const { filteredData, grandTotal, displayLabel, bankChartData, avgTicketSize, topBank } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        
        // 1. Filter by Search Term AND Drill-down Agent
        const searched = disbursements.filter(item => {
            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;

            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term);
        });

        searched.forEach(d => { 
            total += d.disbursed_amount; 
            const bank = d.bank_name || 'Others';
            bankMap[bank] = (bankMap[bank] || 0) + d.disbursed_amount;
        });

        // Metrics
        const avg = searched.length > 0 ? total / searched.length : 0;
        
        // Find Top Bank
        let maxBankName = "N/A";
        let maxBankVal = 0;
        Object.entries(bankMap).forEach(([b, val]) => {
            if(val > maxBankVal) {
                maxBankVal = val;
                maxBankName = b;
            }
        });

        // Label Logic
        let label = "Total Disbursed";
        if (selectedAgentId) label = `${userMap[selectedAgentId]}'s Sales`;

        // Chart Data Format
        const bChartData = Object.entries(bankMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value) // Sort desc
            .slice(0, 8); // Top 8 banks only to keep chart clean

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label,
            bankChartData: bChartData,
            avgTicketSize: avg,
            topBank: maxBankName
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId]);

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
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-1 mb-1">
                                        <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('today')}>Today</Badge>
                                        <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('yesterday')}>Yesterday</Badge>
                                        <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setQuickFilter('week')}>Last 7 Days</Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input type="date" className="w-[140px]" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                        <Input type="date" className="w-[140px]" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                        <Button onClick={() => fetchLeads()} variant="secondary" size="icon"><RefreshCw className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* --- TABS --- */}
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="dashboard">Dashboard View</TabsTrigger>
                    <TabsTrigger value="data">Data List</TabsTrigger>
                </TabsList>

                {/* --- DASHBOARD --- */}
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    {/* STATS ROW */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. Total Card */}
                        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 shadow-sm">
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

                        {/* 2. Avg Ticket Size */}
                        <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-slate-500 font-medium text-sm">Avg. Ticket Size</p>
                                        <h2 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(avgTicketSize)}</h2>
                                    </div>
                                    <div className="p-2 bg-blue-50 rounded-full">
                                        <Calculator className="h-6 w-6 text-blue-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Top Bank */}
                        <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-slate-500 font-medium text-sm">Top Performing Bank</p>
                                        <h2 className="text-2xl font-bold text-slate-900 mt-2 truncate max-w-[200px]" title={topBank}>
                                            {topBank}
                                        </h2>
                                    </div>
                                    <div className="p-2 bg-purple-50 rounded-full">
                                        <Building2 className="h-6 w-6 text-purple-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Leaderboard */}
                        <div className="md:col-span-4">
                            <Card className="h-[450px] flex flex-col shadow-sm">
                                <CardHeader className="py-4 bg-slate-50 border-b">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-600" /> Top Performers
                                    </CardTitle>
                                    <CardDescription className="text-xs">Click a name to filter dashboard</CardDescription>
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

                        {/* Charts */}
                        <div className="md:col-span-8">
                            <Card className="h-[450px] shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base">Bank-wise Disbursement Volume</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[380px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bankChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60}/>
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

                {/* --- DATA LIST --- */}
                <TabsContent value="data" className="mt-4">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex justify-between items-center">
                                <span>Detailed Transactions ({filteredData.length})</span>
                                {selectedAgentId && <Button variant="ghost" size="sm" onClick={() => setSelectedAgentId(null)} className="text-red-500 h-8">Clear Agent Filter</Button>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>App No</TableHead>
                                        <TableHead>Telecaller</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Bank</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-center w-[60px]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item, index) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50">
                                            <TableCell className="text-xs text-slate-500">{index+1}</TableCell>
                                            <TableCell className="text-xs font-mono">{item.application_number}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-normal text-xs">{userMap[item.assigned_to]}</Badge></TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                    {item.city && <span className="text-[10px] text-slate-400">{item.city}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">{formatDate(item.disbursed_at)}</TableCell>
                                            <TableCell className="text-sm">{item.bank_name}</TableCell>
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

            {/* DELETE ALERT */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the disbursement status. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
