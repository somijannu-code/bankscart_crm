"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter 
} from "@/components/ui/sheet" // Assuming you have Shadcn Sheet
import { Label } from "@/components/ui/label"
import { 
  Loader2, FileCheck, Download, Search, Trophy, 
  ArrowRightLeft, Edit, Plus, X, Save, Users, 
  CheckCircle2, XCircle, Clock, Trash2, Calendar, 
  TrendingUp, TrendingDown, Filter, ChevronLeft, ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { format, subDays, isSameDay, startOfMonth, endOfMonth, subMonths } from "date-fns" 
import { EmptyState } from "@/components/empty-state" 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- TYPES ---
type BankAttempt = {
  bank: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Disbursed';
  reason?: string;
  date: string;
}

export default function AdminLoginsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [logins, setLogins] = useState<any[]>([])
    const [transfers, setTransfers] = useState<any[]>([])
    
    // Filters & Pagination
    const [dateFilter, setDateFilter] = useState("this_month")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedBank, setSelectedBank] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Edit/Delete State
    const [editingLogin, setEditingLogin] = useState<any>(null)
    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null)

    // 1. DATA FETCHING
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            let loginsQuery = supabase
                .from('logins') 
                .select(`
                    id, name, phone, bank_name, updated_at, notes, status, bank_attempts,
                    assigned_to,
                    users:assigned_to ( full_name, email )
                `)
                .order('updated_at', { ascending: false })

            const todayDate = new Date()
            
            // Enhanced Date Logic
            if (dateFilter === 'today') {
                const startOfToday = new Date(todayDate.setHours(0,0,0,0)).toISOString()
                loginsQuery = loginsQuery.gte('updated_at', startOfToday)
            } else if (dateFilter === 'this_month') {
                const start = startOfMonth(new Date()).toISOString()
                loginsQuery = loginsQuery.gte('updated_at', start)
            } else if (dateFilter === 'last_month') {
                const lastMonth = subMonths(new Date(), 1)
                const start = startOfMonth(lastMonth).toISOString()
                const end = endOfMonth(lastMonth).toISOString()
                loginsQuery = loginsQuery.gte('updated_at', start).lte('updated_at', end)
            }

            const transfersQuery = supabase
                .from('leads')
                .select(`id, name, updated_at, users:assigned_to ( full_name )`)
                .eq('status', 'Transferred to KYC')
                .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()) 
                .order('updated_at', { ascending: false })

            const [loginsRes, transfersRes] = await Promise.all([loginsQuery, transfersQuery])
            
            if (loginsRes.data) setLogins(loginsRes.data)
            if (transfersRes.data) setTransfers(transfersRes.data)
        } catch (e) {
            console.error(e)
            toast.error("Failed to load data")
        } finally {
            setLoading(false)
        }
    }, [dateFilter, supabase])

    useEffect(() => { fetchData() }, [fetchData])

    // 2. COMPUTED STATS & FILTERING
    const filteredLogins = useMemo(() => {
        return logins.filter(l => {
            const matchesSearch = 
                (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (l.phone && l.phone.includes(searchQuery)) ||
                (l.users?.full_name && l.users.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesBank = selectedBank === 'all' || 
                (Array.isArray(l.bank_attempts) ? l.bank_attempts.some((a:any) => a.bank === selectedBank) : l.bank_name === selectedBank);
            
            const matchesStatus = statusFilter === 'all' || 
                (Array.isArray(l.bank_attempts) ? l.bank_attempts.some((a:any) => a.status === statusFilter) : l.status === statusFilter);

            return matchesSearch && matchesBank && matchesStatus;
        })
    }, [logins, searchQuery, selectedBank, statusFilter])

    // Pagination Logic
    const paginatedLogins = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredLogins.slice(start, start + itemsPerPage)
    }, [filteredLogins, currentPage])

    const totalPages = Math.ceil(filteredLogins.length / itemsPerPage)

    // Analytics Calculation
    const stats = useMemo(() => {
        const total = filteredLogins.length
        const approved = filteredLogins.filter(l => l.status === 'Approved' || l.status === 'Disbursed').length
        const rejected = filteredLogins.filter(l => l.status === 'Rejected').length
        const pending = total - approved - rejected
        const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

        // Daily Trend for Chart
        const trendMap: Record<string, number> = {}
        filteredLogins.forEach(l => {
            const date = format(new Date(l.updated_at), 'MMM dd')
            trendMap[date] = (trendMap[date] || 0) + 1
        })
        const chartData = Object.entries(trendMap)
            .map(([date, count]) => ({ date, count }))
            .slice(-7) // Last 7 days in view

        return { total, approved, rejected, pending, approvalRate, chartData }
    }, [filteredLogins])

    const allTelecallerStats = useMemo(() => {
        const counts: Record<string, number> = {}
        logins.forEach(l => {
            const name = l.users?.full_name || 'Unknown'
            counts[name] = (counts[name] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
    }, [logins])

    const uniqueBanks = Array.from(new Set(logins.flatMap(l => Array.isArray(l.bank_attempts) ? l.bank_attempts.map((a:any) => a.bank) : [l.bank_name]))).filter(Boolean)

    // 3. ACTIONS
    const handleSave = (updatedLogin: any) => {
        setLogins(logins.map(l => l.id === updatedLogin.id ? updatedLogin : l))
        setEditingLogin(null)
    }

    const handleDelete = async () => {
        if(!deleteConfirmation) return
        const { error } = await supabase.from('logins').delete().eq('id', deleteConfirmation)
        if(error) {
            toast.error("Failed to delete record")
        } else {
            setLogins(logins.filter(l => l.id !== deleteConfirmation))
            toast.success("Record deleted")
        }
        setDeleteConfirmation(null)
    }

    const handleExport = () => {
        if (filteredLogins.length === 0) return toast.error("No data to export");
        
        const csvRows = [
            ["Agent Name", "Customer Name", "Phone", "Status", "Bank Details", "Updated At"],
            ...filteredLogins.map(l => [
                l.users?.full_name || 'Unknown',
                l.name,
                l.phone,
                l.status,
                Array.isArray(l.bank_attempts) ? l.bank_attempts.map((a:any) => `${a.bank}(${a.status})`).join('; ') : l.bank_name,
                format(new Date(l.updated_at), "yyyy-MM-dd HH:mm:ss")
            ])
        ]

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Logins_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
    }

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50/50 min-h-screen pb-20 font-sans">
            
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        Login Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time insights and file tracking.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border">
                        <Button 
                            variant={dateFilter === 'today' ? 'white' : 'ghost'} 
                            size="sm" onClick={() => setDateFilter('today')}
                            className={dateFilter === 'today' ? 'shadow-sm text-indigo-600' : 'text-slate-500'}
                        >Today</Button>
                        <Button 
                            variant={dateFilter === 'this_month' ? 'white' : 'ghost'} 
                            size="sm" onClick={() => setDateFilter('this_month')}
                            className={dateFilter === 'this_month' ? 'shadow-sm text-indigo-600' : 'text-slate-500'}
                        >This Month</Button>
                         <Button 
                            variant={dateFilter === 'last_month' ? 'white' : 'ghost'} 
                            size="sm" onClick={() => setDateFilter('last_month')}
                            className={dateFilter === 'last_month' ? 'shadow-sm text-indigo-600' : 'text-slate-500'}
                        >Last Month</Button>
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                        <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-indigo-500 shadow-sm relative overflow-hidden">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Logins</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
                        <div className="h-10 w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData}>
                                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{fontSize: '12px'}} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-green-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Approvals</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{stats.approved}</div>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                            <TrendingUp className="h-3 w-3 mr-1" /> {stats.approvalRate}% Rate
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-red-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Rejections</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{stats.rejected}</div>
                        <p className="text-xs text-slate-400 mt-1">Requires attention</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-amber-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{stats.pending}</div>
                        <p className="text-xs text-amber-600 flex items-center mt-1">
                            <Clock className="h-3 w-3 mr-1" /> In Process
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Main Table Section (9 cols) */}
                <div className="lg:col-span-9 space-y-4">
                    <Card className="shadow-lg border-0 ring-1 ring-slate-200">
                        <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between items-center bg-white rounded-t-xl">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input placeholder="Search files..." className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <Select value={selectedBank} onValueChange={setSelectedBank}>
                                    <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Bank" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Banks</SelectItem>
                                        {uniqueBanks.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        <SelectItem value="Rejected">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Customer Details</TableHead>
                                    <TableHead className="hidden md:table-cell">Bank Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Agent</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                                ) : paginatedLogins.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center"><EmptyState icon={Search} title="No Records Found" description="Try adjusting your filters." /></TableCell></TableRow>
                                ) : (
                                    paginatedLogins.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-slate-50/80 transition-colors">
                                            <TableCell>
                                                <div>
                                                    <span className="font-semibold text-slate-900 block">{item.name}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{item.phone}</span>
                                                </div>
                                            </TableCell>
                                            
                                            <TableCell className="hidden md:table-cell">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {Array.isArray(item.bank_attempts) && item.bank_attempts.length > 0 ? (
                                                        item.bank_attempts.map((att: BankAttempt, idx: number) => (
                                                            <Badge key={idx} variant="outline" className={`gap-1.5 py-1 px-2 ${getStatusColor(att.status)}`}>
                                                                {getStatusIcon(att.status)}
                                                                <span className="font-medium">{att.bank}</span>
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <Badge variant="outline" className="bg-slate-100 text-slate-500">{item.bank_name || 'No Bank'}</Badge>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="hidden md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                        {(item.users?.full_name || 'U')[0]}
                                                    </div>
                                                    <span className="text-sm text-slate-600">{item.users?.full_name?.split(' ')[0] || 'Unknown'}</span>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="text-sm text-slate-600">{format(new Date(item.updated_at), "MMM dd")}</div>
                                                <div className="text-[10px] text-slate-400">{format(new Date(item.updated_at), "hh:mm a")}</div>
                                            </TableCell>

                                            <TableCell>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setEditingLogin(item)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        
                        {/* Pagination */}
                        <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogins.length)} of {filteredLogins.length}
                            </span>
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4"/></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Sidebar (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Leaderboard */}
                    <Card className="shadow-md border-0 ring-1 ring-slate-200">
                        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 pb-3 border-b border-amber-100">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-500" />
                                <CardTitle className="text-base text-amber-900">Top Performers</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[300px] overflow-y-auto">
                                {allTelecallerStats.map((agent, i) => (
                                    <div key={agent.name} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${i<3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                                            <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]" title={agent.name}>{agent.name}</span>
                                        </div>
                                        <Badge variant="secondary" className="font-mono">{agent.count}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* KYC Handover */}
                    <Card className="shadow-md border-0 ring-1 ring-slate-200">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-3 border-b border-indigo-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                                    <CardTitle className="text-sm text-indigo-900">Live Handover</CardTitle>
                                </div>
                                <span className="text-xs font-bold bg-white text-indigo-600 px-2 py-0.5 rounded-full shadow-sm">{transfers.length}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[250px] overflow-y-auto">
                                {transfers.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">No handovers yet.</div>
                                ) : (
                                    transfers.map((t) => (
                                        <div key={t.id} className="p-3 border-b last:border-0 hover:bg-indigo-50/30 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-semibold text-slate-700">{t.users?.full_name || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-400">{format(new Date(t.updated_at), "hh:mm a")}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 truncate">{t.name}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* EDIT SHEET (Better than Modal) */}
            <EditLoginSheet 
                login={editingLogin} 
                open={!!editingLogin} 
                onClose={() => setEditingLogin(null)}
                onSave={handleSave} 
                onDelete={(id) => setDeleteConfirmation(id)}
            />

            {/* DELETE CONFIRMATION */}
            <Dialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Record?</DialogTitle>
                        <DialogDescription>This action cannot be undone. This will permanently remove this login from the server.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete Permanently</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function EditLoginSheet({ login, open, onClose, onSave, onDelete }: { login: any, open: boolean, onClose: () => void, onSave: (l: any) => void, onDelete: (id: string) => void }) {
    const supabase = createClient()
    const [attempts, setAttempts] = useState<BankAttempt[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (login) {
            const existing = Array.isArray(login.bank_attempts) ? login.bank_attempts : []
            if (existing.length === 0 && login.bank_name) {
                existing.push({ 
                    bank: login.bank_name, 
                    status: login.status === 'Logged In' ? 'Pending' : login.status, 
                    date: login.updated_at 
                })
            }
            setAttempts(existing)
        }
    }, [login])

    const handleAdd = () => setAttempts([...attempts, { bank: '', status: 'Pending', date: new Date().toISOString() }])
    
    const handleChange = (idx: number, field: keyof BankAttempt, val: string) => {
        const next = [...attempts]
        next[idx] = { ...next[idx], [field]: val }
        setAttempts(next)
    }
    
    const handleRemove = (idx: number) => setAttempts(attempts.filter((_, i) => i !== idx))

    const save = async () => {
        setLoading(true)
        const hasSuccess = attempts.some(a => ['Approved', 'Disbursed'].includes(a.status))
        const overallStatus = hasSuccess ? 'Approved' : 'Pending' 
        const updated = { ...login, bank_attempts: attempts, status: overallStatus, bank_name: attempts[attempts.length-1]?.bank || login.bank_name }

        const { error } = await supabase.from('logins').update({ 
            bank_attempts: attempts,
            status: overallStatus,
            bank_name: updated.bank_name
        }).eq('id', login.id)

        if (error) {
            toast.error("Failed to save")
        } else {
            toast.success("Saved successfully")
            onSave(updated)
            onClose()
        }
        setLoading(false)
    }

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>Manage Application</SheetTitle>
                    <SheetDescription>
                        Customer: <span className="font-semibold text-indigo-600">{login?.name}</span> • {login?.phone}
                    </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-2">
                        <Label className="text-base font-semibold">Bank Applications</Label>
                        <Button size="sm" onClick={handleAdd} className="h-8 gap-1"><Plus className="h-3 w-3"/> Add Bank</Button>
                    </div>
                    
                    {attempts.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50">
                            <p className="text-sm text-slate-500">No applications recorded.</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {attempts.map((att, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm relative group hover:border-indigo-300 transition-colors">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50" onClick={() => handleRemove(idx)}><X className="h-3 w-3"/></Button>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Bank Name</Label>
                                        <Input value={att.bank} onChange={e => handleChange(idx, 'bank', e.target.value)} placeholder="e.g. HDFC" className="h-9"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Status</Label>
                                        <Select value={att.status} onValueChange={v => handleChange(idx, 'status', v)}>
                                            <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pending">Pending</SelectItem>
                                                <SelectItem value="Approved">Approved</SelectItem>
                                                <SelectItem value="Disbursed">Disbursed</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {att.status === 'Rejected' && (
                                    <div className="mt-3 pt-3 border-t border-dashed">
                                        <Input placeholder="Rejection Reason (Optional)" value={att.reason || ''} onChange={e => handleChange(idx, 'reason', e.target.value)} className="h-8 text-xs bg-red-50 border-red-100 placeholder:text-red-300 text-red-700"/>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <SheetFooter className="mt-8 flex-col sm:flex-row gap-3 border-t pt-4">
                    <Button variant="destructive" variant="outline" className="w-full sm:w-auto text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 mr-auto" onClick={() => onDelete(login.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
                        <Button onClick={save} disabled={loading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save Changes"}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

function getStatusIcon(status: string) {
    switch(status) {
        case 'Approved': case 'Disbursed': return <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        case 'Rejected': return <XCircle className="h-3 w-3 text-red-600" />
        default: return <Clock className="h-3 w-3 text-amber-600" />
    }
}

function getStatusColor(status: string) {
    switch(status) {
        case 'Approved': return "bg-emerald-100 text-emerald-800 border-emerald-200"
        case 'Disbursed': return "bg-green-100 text-green-800 border-green-200 ring-1 ring-green-300"
        case 'Rejected': return "bg-red-50 text-red-800 border-red-200"
        default: return "bg-amber-50 text-amber-800 border-amber-200"
    }
}
