"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, TrendingUp, Filter, Calendar, Trash2, 
  MapPin, Search, RefreshCw, X, Users, Trophy, Medal,
  Calculator, Building2, Target, PieChart as PieIcon, BarChart3, 
  ArrowUpRight, Wallet, Pencil, GripHorizontal
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie
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

const PIE_COLORS = ['#16a34a', '#2563eb', '#db2777', '#ea580c', '#ca8a04', '#0891b2', '#4b5563'];

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

    // Target State (Default 50 Lakhs)
    const [targetAmount, setTargetAmount] = useState<number>(5000000); 
    const [isTargetEditing, setIsTargetEditing] = useState(false);

    // Commission State
    const [commissionRate, setCommissionRate] = useState<number[]>([1.0]); // Default 1%

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
    const { filteredData, grandTotal, displayLabel, bankChartData, trendData, pieData, avgTicketSize, cityStats } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        
        // 1. Filter
        const searched = disbursements.filter(item => {
            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;

            const term = searchTerm.toLowerCase();
            const telecallerName = userMap[item.assigned_to]?.toLowerCase() || "";
            const customerName = item.name?.toLowerCase() || "";
            const appNo = item.application_number?.toLowerCase() || "";
            
            return telecallerName.includes(term) || customerName.includes(term) || appNo.includes(term);
        });

        // 2. Aggregate
        searched.forEach(d => { 
            const amt = d.disbursed_amount;
            total += amt; 
            
            // Bank Stats
            const bank = d.bank_name || 'Others';
            bankMap[bank] = (bankMap[bank] || 0) + amt;

            // City Stats
            const city = d.city || 'Unknown';
            cityMap[city] = (cityMap[city] || 0) + amt;

            // Trend Stats
            if(d.disbursed_at) {
                // ISO Key for sorting
                const iso = d.disbursed_at.split('T')[0];
                dailyMap[iso] = (dailyMap[iso] || 0) + amt;
            }
        });

        const avg = searched.length > 0 ? total / searched.length : 0;
        
        // Label Logic
        let label = "Total Revenue";
        if (selectedAgentId) label = `${userMap[selectedAgentId]}'s Revenue`;

        // Chart Data - Banks
        const bChartData = Object.entries(bankMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);

        // Chart Data - Pie
        const sortedBanks = Object.entries(bankMap).sort((a,b) => b[1] - a[1]);
        const top5 = sortedBanks.slice(0, 5).map(([name, value]) => ({ name, value }));
        const othersVal = sortedBanks.slice(5).reduce((acc, curr) => acc + curr[1], 0);
        if(othersVal > 0) top5.push({ name: 'Others', value: othersVal });
        
        // Chart Data - Trend
        const trendFinal = Object.keys(dailyMap).sort().map(iso => ({
            date: new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            value: dailyMap[iso]
        }));

        // City Data (Top 5)
        const cityFinal = Object.entries(cityMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label,
            bankChartData: bChartData,
            pieData: top5,
            trendData: trendFinal,
            avgTicketSize: avg,
            cityStats: cityFinal
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

    const targetProgress = Math.min((grandTotal / targetAmount) * 100, 100);
    const estimatedCommission = grandTotal * (commissionRate[0] / 100);

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-8 w-8 text-green-600" />
                        Disbursement Intelligence
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time financial tracking and commission analysis</p>
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

            {/* --- DASHBOARD VIEW --- */}
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="dashboard">Analytics Board</TabsTrigger>
                    <TabsTrigger value="data">Data List</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    
                    {/* TOP ROW: Stats & Target & Commission */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* MAIN STAT */}
                        <Card className="md:col-span-4 bg-gradient-to-br from-green-600 to-emerald-800 text-white shadow-md border-0">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-emerald-100 font-medium text-sm flex items-center gap-1">
                                            {selectedAgentId && <Badge variant="secondary" className="mr-2 cursor-pointer bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setSelectedAgentId(null)}>Clear</Badge>}
                                            {displayLabel}
                                        </p>
                                        <h2 className="text-3xl font-bold mt-2">{formatCurrency(grandTotal)}</h2>
                                        <div className="flex items-center gap-2 mt-4 text-emerald-100 text-sm">
                                            <Calculator className="h-4 w-4 opacity-70" /> Ticket: {formatCurrency(avgTicketSize)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                                        <TrendingUp className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* TARGET TRACKER */}
                        <Card className="md:col-span-4 bg-white shadow-sm border-slate-200 flex flex-col justify-center">
                            <CardHeader className="pb-2 pt-4">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <Target className="h-4 w-4 text-red-500"/> Monthly Goal
                                    </CardTitle>
                                    {!isTargetEditing ? (
                                        <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400" onClick={() => setIsTargetEditing(true)}>Edit</Button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Input type="number" className="h-6 w-24 text-xs" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} />
                                            <Button size="sm" className="h-6 text-xs" onClick={() => setIsTargetEditing(false)}>Save</Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between text-sm font-medium mb-2">
                                    <span>{targetProgress.toFixed(1)}%</span>
                                    <span className="text-slate-400">Target: {formatCurrency(targetAmount)}</span>
                                </div>
                                <Progress value={targetProgress} className="h-2" />
                            </CardContent>
                        </Card>

                        {/* COMMISSION CALCULATOR */}
                        <Card className="md:col-span-4 bg-blue-50/50 border-blue-100 shadow-sm flex flex-col justify-center">
                            <CardHeader className="pb-2 pt-4">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                                        <Wallet className="h-4 w-4"/> Est. Commission ({commissionRate[0]}%)
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <h2 className="text-2xl font-bold text-blue-700">{formatCurrency(estimatedCommission)}</h2>
                                <div className="mt-3">
                                    <Slider 
                                        defaultValue={[1]} 
                                        max={5} 
                                        step={0.1} 
                                        value={commissionRate} 
                                        onValueChange={setCommissionRate}
                                        className="py-1"
                                    />
                                    <p className="text-[10px] text-blue-400 mt-1 text-right">Adjust payout percentage</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* MIDDLE ROW: Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. TREND LINE CHART */}
                        <Card className="md:col-span-2 shadow-sm border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ArrowUpRight className="h-4 w-4 text-indigo-500"/> Daily Trend
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                                        <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                        <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* 2. CITY STATS */}
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-rose-500"/> Top Cities
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {cityStats.map((city, idx) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                                <span className="text-sm font-medium text-slate-700">{city.name}</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900">{formatCurrency(city.value)}</span>
                                        </div>
                                    ))}
                                    {cityStats.length === 0 && <div className="text-xs text-slate-400">No location data available</div>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* BOTTOM ROW: Detailed Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        
                        {/* Leaderboard */}
                        <div className="md:col-span-4">
                            <Card className="h-[450px] flex flex-col shadow-sm border-slate-200">
                                <CardHeader className="py-4 bg-slate-50 border-b">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-600" /> Leaderboard
                                    </CardTitle>
                                    <CardDescription className="text-xs">Click to drill-down</CardDescription>
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

                        {/* Pie & Bar Mixed */}
                        <div className="md:col-span-8 flex flex-col gap-6">
                             {/* Bank Market Share */}
                             <Card className="flex-1 shadow-sm border-slate-200">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <PieIcon className="h-4 w-4 text-purple-500"/> Bank Distribution
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[200px] flex items-center justify-around">
                                    <div className="h-full w-1/2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={70}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="w-1/2 space-y-1">
                                         {pieData.map((entry, index) => (
                                            <div key={index} className="flex items-center gap-2 text-xs text-slate-600">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                                <span className="font-medium">{entry.name}:</span> {formatCurrency(entry.value)}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bank Volume Bar */}
                            <Card className="flex-1 shadow-sm border-slate-200">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-blue-500"/> Volume by Bank
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bankChartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                                            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40}>
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

                {/* --- DATA LIST VIEW --- */}
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
                                        <TableHead className="text-center w-[100px]">Actions</TableHead>
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
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => toast({ title: "Edit Feature", description: "This opens the edit modal."})}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
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
