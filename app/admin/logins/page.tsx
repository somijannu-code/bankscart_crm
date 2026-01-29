"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
    Loader2, FileCheck, Download, Search, Building2, Trophy, 
    ArrowRightLeft, Edit, Plus, X, Save, Users, CheckCircle2, XCircle, Clock, Trash2
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { EmptyState } from "@/components/empty-state" // Ensure you have this

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
    
    // Filters
    const [dateFilter, setDateFilter] = useState("today")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedBank, setSelectedBank] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")

    // Edit Modal State
    const [editingLogin, setEditingLogin] = useState<any>(null)

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
            const startOfToday = new Date(todayDate.setHours(0,0,0,0)).toISOString()

            if (dateFilter === 'today') {
                loginsQuery = loginsQuery.gte('updated_at', startOfToday)
            } else if (dateFilter === 'month') {
                loginsQuery = loginsQuery.gte('updated_at', new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString())
            }

            const transfersQuery = supabase
                .from('leads')
                .select(`id, name, updated_at, users:assigned_to ( full_name )`)
                .eq('status', 'Transferred to KYC')
                .gte('updated_at', startOfToday)
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

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // 2. ACTIONS
    const handleSave = (updatedLogin: any) => {
        setLogins(logins.map(l => l.id === updatedLogin.id ? updatedLogin : l))
        setEditingLogin(null)
    }

    // 3. FILTERING & STATS
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

    return (
        <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <FileCheck className="h-7 w-7 md:h-8 md:w-8 text-indigo-600" />
                        Login Reporting
                    </h1>
                    <p className="text-gray-500 text-sm md:text-base mt-1">Monitor submissions, statuses, and performance.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[130px] bg-white h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="bg-white h-9 text-sm" onClick={() => toast.success("Export started")}>
                        <Download className="w-3.5 h-3.5 mr-2" /> Export
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <Card className="shadow-sm border-l-4 border-indigo-500">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileCheck className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-gray-500">Total Logins</span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">{filteredLogins.length}</h2>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-amber-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Trophy className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-gray-500">Top Performers</span>
                        </div>
                        <div className="space-y-2">
                            {allTelecallerStats.slice(0, 3).map((agent, i) => (
                                <div key={agent.name} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-700 truncate max-w-[120px]">{i + 1}. {agent.name}</span>
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">{agent.count}</Badge>
                                </div>
                            ))}
                            {allTelecallerStats.length === 0 && <p className="text-xs text-gray-400">No data available.</p>}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-l-4 border-blue-500 flex flex-col">
                    <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center gap-3 mb-2 shrink-0">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-gray-500">Leaderboard</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 min-h-[100px] max-h-[120px] custom-scrollbar">
                            <table className="w-full text-sm">
                                <tbody>
                                    {allTelecallerStats.map((agent) => (
                                        <tr key={agent.name} className="border-b border-gray-100 last:border-0">
                                            <td className="py-1.5 text-gray-600 truncate max-w-[140px]">{agent.name}</td>
                                            <td className="py-1.5 text-right font-bold text-gray-900">{agent.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table Card */}
            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-white border-b px-4 py-4 md:px-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <CardTitle className="text-lg">Detailed Records</CardTitle>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-[220px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search..." className="pl-9 h-9 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm"><SelectValue placeholder="Bank" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {uniqueBanks.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="w-[200px]">Telecaller & Customer</TableHead>
                                <TableHead className="hidden md:table-cell">Bank Applications</TableHead>
                                <TableHead className="md:hidden">Status Summary</TableHead>
                                <TableHead className="hidden md:table-cell w-[150px]">Date</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                            ) : filteredLogins.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center"><EmptyState icon={Search} title="No Records" description="Try adjusting filters." /></TableCell></TableRow>
                            ) : (
                                filteredLogins.map((item) => (
                                    <TableRow key={item.id} className="group hover:bg-slate-50 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900 text-sm">{item.users?.full_name || 'Unknown Agent'}</span>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">{item.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">{item.phone?.slice(-4).padStart(10, '*')}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        
                                        <TableCell className="hidden md:table-cell">
                                            <div className="flex flex-wrap gap-2">
                                                {Array.isArray(item.bank_attempts) && item.bank_attempts.length > 0 ? (
                                                    item.bank_attempts.map((att: BankAttempt, idx: number) => (
                                                        <Badge key={idx} variant="outline" className={`gap-1 pr-2 ${getStatusColor(att.status)}`}>
                                                            {getStatusIcon(att.status)}
                                                            {att.bank}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="bg-slate-50 text-slate-500">{item.bank_name || 'No Bank'}</Badge>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="md:hidden">
                                            <div className="flex flex-col gap-1 text-xs">
                                                <span className="text-gray-600 font-medium">
                                                    {Array.isArray(item.bank_attempts) ? item.bank_attempts.length : 1} Applications
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="hidden md:table-cell text-xs text-gray-500">
                                            {format(new Date(item.updated_at), "MMM dd, yyyy")}
                                            <div className="text-[10px] text-gray-400">{format(new Date(item.updated_at), "hh:mm a")}</div>
                                        </TableCell>

                                        <TableCell>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => setEditingLogin(item)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* KYC Handover Report */}
            <Card className="shadow-md border-2 border-indigo-50/50 bg-gradient-to-br from-white to-indigo-50/30">
                <CardHeader className="border-b border-indigo-100 pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-indigo-900">
                            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                            Daily KYC Handover
                        </CardTitle>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-0">{transfers.length} Leads</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-indigo-50/50 sticky top-0 backdrop-blur-sm">
                                <TableRow className="hover:bg-transparent border-b border-indigo-100">
                                    <TableHead className="font-semibold text-indigo-800 text-xs uppercase tracking-wider h-9">Agent</TableHead>
                                    <TableHead className="font-semibold text-indigo-800 text-xs uppercase tracking-wider h-9">Lead Name</TableHead>
                                    <TableHead className="font-semibold text-indigo-800 text-xs uppercase tracking-wider text-right h-9">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-20 text-gray-400 text-sm">No handovers recorded today.</TableCell></TableRow>
                                ) : (
                                    transfers.map((t) => (
                                        <TableRow key={t.id} className="hover:bg-indigo-50/40 border-b border-indigo-50 last:border-0 transition-colors">
                                            <TableCell className="font-medium text-gray-700 py-2">{t.users?.full_name || 'Unknown'}</TableCell>
                                            <TableCell className="text-gray-600 py-2">{t.name}</TableCell>
                                            <TableCell className="text-right text-gray-400 font-mono text-xs py-2">{format(new Date(t.updated_at), "hh:mm a")}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* EDIT DIALOG (Separated Component for Performance) */}
            <EditLoginDialog 
                login={editingLogin} 
                open={!!editingLogin} 
                onClose={() => setEditingLogin(null)}
                onSave={handleSave} 
            />
        </div>
    )
}

// --- SUB-COMPONENT: EDIT DIALOG ---
function EditLoginDialog({ login, open, onClose, onSave }: { login: any, open: boolean, onClose: () => void, onSave: (l: any) => void }) {
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
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Application</DialogTitle>
                    <DialogDescription>{login?.name} • {login?.phone}</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center">
                        <Label>Bank Applications</Label>
                        <Button size="sm" variant="outline" onClick={handleAdd}><Plus className="h-3 w-3 mr-1"/> Add Bank</Button>
                    </div>
                    
                    {attempts.length === 0 && <div className="text-center text-sm text-gray-500 py-4 border border-dashed rounded">No applications yet.</div>}

                    {attempts.map((att, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border relative group">
                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => handleRemove(idx)}><X className="h-3 w-3"/></Button>
                            <div className="grid grid-cols-2 gap-3 pr-6">
                                <div className="space-y-1">
                                    <Label className="text-xs">Bank Name</Label>
                                    <Input value={att.bank} onChange={e => handleChange(idx, 'bank', e.target.value)} placeholder="Bank Name" className="h-8 bg-white"/>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={att.status} onValueChange={v => handleChange(idx, 'status', v)}>
                                        <SelectTrigger className="h-8 bg-white"><SelectValue/></SelectTrigger>
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
                                <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                                    <Input placeholder="Rejection Reason" value={att.reason || ''} onChange={e => handleChange(idx, 'reason', e.target.value)} className="h-7 text-xs bg-red-50 border-red-100 placeholder:text-red-300"/>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={save} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save Changes"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- HELPERS ---
function getStatusIcon(status: string) {
    switch(status) {
        case 'Approved': case 'Disbursed': return <CheckCircle2 className="h-3 w-3 text-green-600" />
        case 'Rejected': return <XCircle className="h-3 w-3 text-red-600" />
        default: return <Clock className="h-3 w-3 text-orange-600" />
    }
}

function getStatusColor(status: string) {
    switch(status) {
        case 'Approved': return "bg-green-100 text-green-800 border-green-200"
        case 'Disbursed': return "bg-emerald-100 text-emerald-800 border-emerald-200"
        case 'Rejected': return "bg-red-50 text-red-800 border-red-200"
        default: return "bg-orange-50 text-orange-800 border-orange-200"
    }
}
