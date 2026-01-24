"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, IndianRupee, TrendingUp, Filter, Calendar, Trash2, 
  MapPin, Search, RefreshCw, X, Users, Trophy, Medal,
  Calculator, Building2, Target, PieChart as PieIcon, BarChart3, 
  ArrowUpRight, Wallet, Pencil, Zap, Printer, Gauge, Crown, CalendarCheck
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
    
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedBank, setSelectedBank] = useState<string>("all");
    const [selectedCity, setSelectedCity] = useState<string>("all"); // NEW: City Filter

    const [targetAmount, setTargetAmount] = useState<number>(5000000); 
    const [isTargetEditing, setIsTargetEditing] = useState(false);
    const [commissionRate, setCommissionRate] = useState<number[]>([1.0]); 

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

        if (error) { console.error('Error fetching users:', error); return; }
        const map: UserMap = {};
        (data || []).forEach(user => { map[user.id] = user.full_name || `ID: ${user.id.substring(0, 5)}`; });
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
                startQuery = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;
                endQuery = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${endDate.getDate()}T23:59:59.999Z`;
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
            setLoading(false); return;
        }

        const safeData = (data || []).map(d => ({ ...d, disbursed_amount: Number(d.disbursed_amount) || 0 }));
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
            setIsDeleting(false); setDeleteId(null);
        }
    };

    // --- AGGREGATION & ANALYTICS ---
    const { 
        filteredData, grandTotal, displayLabel, bankChartData, trendData, 
        pieData, avgTicketSize, cityStats, availableBanks, availableCities,
        projectedRevenue, dailyVelocity, bestDay
    } = useMemo(() => {
        let total = 0;
        const bankMap: Record<string, number> = {};
        const dailyMap: Record<string, number> = {};
        const cityMap: Record<string, number> = {};
        const uniqueBanks = new Set<string>();
        const uniqueCities = new Set<string>();
        
        // 1. Filter
        const searched = disbursements.filter(item => {
            if(item.bank_name) uniqueBanks.add(item.bank_name);
            if(item.city) uniqueCities.add(item.city);

            if (selectedAgentId && item.assigned_to !== selectedAgentId) return false;
            if (selectedBank !== 'all' && item.bank_name !== selectedBank) return false;
            if (selectedCity !== 'all' && item.city !== selectedCity) return false; // NEW

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
            bankMap[d.bank_name || 'Others'] = (bankMap[d.bank_name || 'Others'] || 0) + amt;
            cityMap[d.city || 'Unknown'] = (cityMap[d.city || 'Unknown'] || 0) + amt;
            if(d.disbursed_at) {
                const iso = d.disbursed_at.split('T')[0];
                dailyMap[iso] = (dailyMap[iso] || 0) + amt;
            }
        });

        const avg = searched.length > 0 ? total / searched.length : 0;
        
        // 3. Projections & Best Day
        let velocity = 0;
        let projection = total;
        let maxDayVal = 0;
        let maxDayDate = "-";

        Object.entries(dailyMap).forEach(([date, val]) => {
            if(val > maxDayVal) { maxDayVal = val; maxDayDate = date; }
        });

        if (filterMode === 'monthly' && selectedMonth !== 'all') {
            const now = new Date();
            const selYear = Number(selectedYear);
            const selMonthIdx = Number(selectedMonth) - 1;
            const daysInMonth = new Date(selYear, selMonthIdx + 1, 0).getDate();
            if (selYear === now.getFullYear() && selMonthIdx === now.getMonth()) {
                const daysPassed = now.getDate();
                velocity = total / daysPassed;
                projection = velocity * daysInMonth;
            } else {
                velocity = total / daysInMonth;
                projection = total;
            }
        }

        let label = "Total Revenue";
        if (selectedAgentId) label = `${userMap[selectedAgentId]}'s Revenue`;

        return {
            filteredData: searched,
            grandTotal: total,
            displayLabel: label,
            bankChartData: Object.entries(bankMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8),
            pieData: Object.entries(bankMap).sort((a,b) => b[1] - a[1]).slice(0,5).map(([name,value])=>({name,value})),
            trendData: Object.keys(dailyMap).sort().map(iso => ({ date: new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), value: dailyMap[iso] })),
            avgTicketSize: avg,
            cityStats: Object.entries(cityMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
            availableBanks: Array.from(uniqueBanks).sort(),
            availableCities: Array.from(uniqueCities).sort(),
            projectedRevenue: projection,
            dailyVelocity: velocity,
            bestDay: { date: maxDayDate !== '-' ? new Date(maxDayDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-', amount: maxDayVal }
        };
    }, [disbursements, searchTerm, userMap, selectedAgentId, selectedBank, selectedCity, filterMode, selectedYear, selectedMonth]);

    const telecallerStats = useMemo(() => {
        const stats: Record<string, { amount: number, count: number }> = {};
        const leaderboardData = disbursements.filter(item => {
            if (selectedBank !== 'all' && item.bank_name !== selectedBank) return false;
            if (selectedCity !== 'all' && item.city !== selectedCity) return false;
            return true; 
        });
        leaderboardData.forEach(d => {
            const id = d.assigned_to;
            if(!stats[id]) stats[id] = { amount: 0, count: 0 };
            stats[id].amount += (d.disbursed_amount || 0);
            stats[id].count += 1;
        });
        return Object.entries(stats)
            .map(([id, data]) => ({ 
                id, name: userMap[id] || 'Unknown', amount: data.amount, count: data.count,
                avg: data.count > 0 ? data.amount / data.count : 0
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [disbursements, userMap, selectedBank, selectedCity]);

    const targetProgress = Math.min((grandTotal / targetAmount) * 100, 100);
    const estimatedCommission = grandTotal * (commissionRate[0] / 100);
    const handlePrint = () => { window.print(); };

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen print:p-0 print:bg-white">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-8 w-8 text-green-600" /> Disbursement Intelligence
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time financial tracking and commission analysis</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Print</Button>
                    <DisbursementModal onSuccess={() => setRefreshKey(prev => prev + 1)} />
                </div>
            </div>

            {/* CONTROLS */}
            <Card className="border-slate-200 shadow-sm print:hidden">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
                        <div className="w-full lg:w-1/4 relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-2 items-end">
                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Banks" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Banks</SelectItem>{availableBanks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                            </Select>
                            
                            {/* NEW: CITY FILTER */}
                            <Select value={selectedCity} onValueChange={setSelectedCity}>
                                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Cities" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Cities</SelectItem>{availableCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>

                            <Select value={filterMode} onValueChange={(v:any) => setFilterMode(v)}>
                                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent>
                            </Select>

                            {filterMode === 'monthly' ? (
                                <>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[currentYear-1, currentYear, currentYear+1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="all">Full Year</SelectItem>{Array.from({length: 12}, (_, i) => <SelectItem key={i} value={String(i+1).padStart(2,'0')}>{new Date(0,i).toLocaleString('default',{month:'long'})}</SelectItem>)}</SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <Input type="date" className="w-[130px]" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    <Input type="date" className="w-[130px]" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                    <Button onClick={() => fetchLeads()} variant="secondary" size="icon"><RefreshCw className="h-4 w-4"/></Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2 print:hidden"><TabsTrigger value="dashboard">Analytics Board</TabsTrigger><TabsTrigger value="data">Data List</TabsTrigger></TabsList>
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    
                    {/* STATS STRIP */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-green-600 to-emerald-800 text-white shadow-md border-0">
                            <CardContent className="p-4 pt-6">
                                <p className="text-emerald-100 text-xs font-medium uppercase">Actual Revenue</p>
                                <h2 className="text-2xl font-bold mt-1">{formatCurrency(grandTotal)}</h2>
                                <div className="mt-2 text-[10px] bg-white/10 w-fit px-2 py-0.5 rounded-full">Avg: {formatCurrency(avgTicketSize)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1"><p className="text-slate-500 text-xs font-medium uppercase">Projected End</p><Gauge className="h-4 w-4 text-blue-500"/></div>
                                <h2 className="text-2xl font-bold text-blue-600">{formatCurrency(projectedRevenue)}</h2>
                                <p className="text-[10px] text-slate-400 mt-1">Speed: {formatCurrency(dailyVelocity)} / day</p>
                            </CardContent>
                        </Card>
                        {/* NEW: BEST DAY CARD */}
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1"><p className="text-slate-500 text-xs font-medium uppercase">Best Day</p><CalendarCheck className="h-4 w-4 text-purple-500"/></div>
                                <h2 className="text-2xl font-bold text-purple-700">{bestDay.date}</h2>
                                <p className="text-[10px] text-slate-400 mt-1">High of {formatCurrency(bestDay.amount)}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 pt-6">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-slate-500 text-xs font-medium uppercase">Goal Progress</p>
                                    {!isTargetEditing ? <Pencil className="h-3 w-3 text-slate-300 cursor-pointer" onClick={() => setIsTargetEditing(true)}/> : <div className="flex gap-1"><Input type="number" className="h-5 w-16 text-[10px]" value={targetAmount} onChange={e=>setTargetAmount(Number(e.target.value))} /><Button size="sm" className="h-5 text-[10px] px-1" onClick={()=>setIsTargetEditing(false)}>OK</Button></div>}
                                </div>
                                <div className="flex justify-between items-end"><h2 className="text-xl font-bold text-slate-800">{targetProgress.toFixed(0)}%</h2><span className="text-xs text-slate-400 mb-1">of {formatCurrency(targetAmount)}</span></div>
                                <Progress value={targetProgress} className="h-1.5 mt-2 bg-slate-100" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* NEW: WINNERS PODIUM */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {/* PODIUM */}
                         <Card className="md:col-span-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg border-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy className="h-32 w-32" /></div>
                            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2 text-amber-400"><Crown className="h-5 w-5"/> Top Performers</CardTitle></CardHeader>
                            <CardContent className="flex justify-center items-end h-[200px] pb-6 gap-4 md:gap-12">
                                {/* 2ND PLACE */}
                                {telecallerStats[1] && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="text-center"><span className="text-xs font-bold text-slate-300">{telecallerStats[1].name}</span><div className="text-[10px] text-slate-400">{formatCurrency(telecallerStats[1].amount)}</div></div>
                                        <div className="w-16 md:w-24 bg-slate-400/20 h-24 rounded-t-lg border-t-4 border-slate-400 flex items-center justify-center text-2xl font-bold text-slate-400">2</div>
                                    </div>
                                )}
                                {/* 1ST PLACE */}
                                {telecallerStats[0] && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="text-center relative"><Crown className="h-4 w-4 text-amber-400 absolute -top-5 left-1/2 -translate-x-1/2"/><span className="text-sm font-bold text-amber-400">{telecallerStats[0].name}</span><div className="text-xs text-amber-200 font-mono">{formatCurrency(telecallerStats[0].amount)}</div></div>
                                        <div className="w-20 md:w-32 bg-amber-500/20 h-36 rounded-t-lg border-t-4 border-amber-500 flex items-center justify-center text-4xl font-bold text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]">1</div>
                                    </div>
                                )}
                                {/* 3RD PLACE */}
                                {telecallerStats[2] && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="text-center"><span className="text-xs font-bold text-orange-300">{telecallerStats[2].name}</span><div className="text-[10px] text-orange-400/80">{formatCurrency(telecallerStats[2].amount)}</div></div>
                                        <div className="w-16 md:w-24 bg-orange-700/20 h-16 rounded-t-lg border-t-4 border-orange-700 flex items-center justify-center text-2xl font-bold text-orange-700">3</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* MAIN CHARTS */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-8 space-y-6">
                             <Card className="shadow-sm border-slate-200">
                                <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-indigo-500"/> Daily Trend</CardTitle></CardHeader>
                                <CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} /><YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} /><RechartsTooltip formatter={(value: number) => formatCurrency(value)} /><Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} /></AreaChart></ResponsiveContainer></CardContent>
                            </Card>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><PieIcon className="h-4 w-4 text-purple-500"/> Bank Share</CardTitle></CardHeader>
                                    <CardContent className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">{pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><RechartsTooltip formatter={(value: number) => formatCurrency(value)} /></PieChart></ResponsiveContainer></CardContent>
                                </Card>
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader className="py-4"><CardTitle className="text-sm font-semibold flex gap-2"><MapPin className="h-4 w-4 text-rose-500"/> Top Cities</CardTitle></CardHeader>
                                    <CardContent className="h-[200px] overflow-y-auto pr-1"><div className="space-y-3">{cityStats.map((city, idx) => (<div key={idx} className="flex justify-between border-b border-slate-50 pb-2 last:border-0"><span className="text-xs font-medium text-slate-600">{city.name}</span><span className="text-xs font-bold text-slate-800">{formatCurrency(city.value)}</span></div>))}</div></CardContent>
                                </Card>
                            </div>
                        </div>
                        <div className="md:col-span-4 space-y-6">
                            <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                                <CardHeader className="py-4 pb-2"><CardTitle className="text-xs font-medium text-blue-600 flex gap-2"><Wallet className="h-3 w-3"/> Payout ({commissionRate[0]}%)</CardTitle></CardHeader>
                                <CardContent><h2 className="text-xl font-bold text-blue-700">{formatCurrency(estimatedCommission)}</h2><Slider defaultValue={[1]} max={5} step={0.1} value={commissionRate} onValueChange={setCommissionRate} className="mt-4 py-1" /></CardContent>
                            </Card>
                            <Card className="flex flex-col shadow-sm border-slate-200 h-[450px]">
                                <CardHeader className="py-4 bg-slate-50 border-b"><CardTitle className="text-sm font-semibold flex gap-2"><Users className="h-4 w-4 text-slate-600" /> Full Rankings</CardTitle></CardHeader>
                                <div className="p-0 overflow-y-auto flex-1">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="w-[40px] text-xs">#</TableHead><TableHead className="text-xs">Agent</TableHead><TableHead className="text-right text-xs">Total</TableHead></TableRow></TableHeader>
                                        <TableBody>{telecallerStats.map((stat, idx) => (<TableRow key={stat.id} className={`cursor-pointer ${selectedAgentId === stat.id ? 'bg-green-50' : 'hover:bg-slate-50'}`} onClick={() => setSelectedAgentId(stat.id === selectedAgentId ? null : stat.id)}><TableCell className="text-xs text-slate-400">{idx+1}</TableCell><TableCell className="text-xs font-medium">{stat.name}</TableCell><TableCell className="text-right text-xs font-bold text-emerald-700">{formatCurrency(stat.amount)}</TableCell></TableRow>))}</TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="data" className="mt-4">
                    <Card className="shadow-sm">
                        <CardHeader><CardTitle className="text-base flex justify-between"><span>Transactions ({filteredData.length})</span>{selectedAgentId && <Button variant="ghost" size="sm" onClick={() => setSelectedAgentId(null)} className="text-red-500 h-8">Clear Filter</Button>}</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50"><TableRow><TableHead>#</TableHead><TableHead>App No</TableHead><TableHead>Agent</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Bank</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-center">Action</TableHead></TableRow></TableHeader>
                                <TableBody>{filteredData.map((item, index) => (<TableRow key={item.id} className="hover:bg-slate-50"><TableCell className="text-xs text-slate-500">{index+1}</TableCell><TableCell className="text-xs font-mono">{item.application_number}</TableCell><TableCell><Badge variant="outline" className="font-normal text-xs">{userMap[item.assigned_to]}</Badge></TableCell><TableCell><div className="flex flex-col"><span className="text-sm font-medium">{item.name}</span><span className="text-[10px] text-slate-400">{item.city}</span></div></TableCell><TableCell className="text-sm text-slate-500">{formatDate(item.disbursed_at)}</TableCell><TableCell className="text-sm">{item.bank_name}</TableCell><TableCell className="text-right font-bold text-green-700">{formatCurrency(item.disbursed_amount)}</TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>This removes the disbursement status.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
