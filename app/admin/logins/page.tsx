"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
    Loader2, FileCheck, Download, Search, Building2, Trophy, 
    Calendar, ArrowRightLeft, Edit, Plus, X, Save, AlertCircle 
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog" // Assuming you have shadcn Dialog, if not use standard modal logic below

// --- TYPE DEFINITIONS ---
type BankAttempt = {
    bank: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Disbursed';
    reason?: string; // Rejection reason
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

    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingLogin, setEditingLogin] = useState<any>(null)
    const [tempAttempts, setTempAttempts] = useState<BankAttempt[]>([])

    // 1. DATA FETCHING
    const fetchData = async () => {
        setLoading(true)
        
        // A. Fetch Logins
        let loginsQuery = supabase
            .from('logins') 
            .select(`
                id, name, phone, bank_name, updated_at, notes, status, bank_attempts,
                assigned_to,
                users:assigned_to ( full_name, email )
            `)
            .order('updated_at', { ascending: false })

        // Date Logic
        const todayDate = new Date()
        const startOfToday = new Date(todayDate.setHours(0,0,0,0)).toISOString()

        if (dateFilter === 'today') {
            loginsQuery = loginsQuery.gte('updated_at', startOfToday)
        } else if (dateFilter === 'month') {
            loginsQuery = loginsQuery.gte('updated_at', new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString())
        }

        // B. Fetch Today's KYC Transfers
        const transfersQuery = supabase
            .from('leads')
            .select(`
                id, name, updated_at,
                users:assigned_to ( full_name )
            `)
            .eq('status', 'Transferred to KYC')
            .gte('updated_at', startOfToday)
            .order('updated_at', { ascending: false })

        const [loginsRes, transfersRes] = await Promise.all([loginsQuery, transfersQuery])
        
        if (loginsRes.data) setLogins(loginsRes.data)
        if (transfersRes.data) setTransfers(transfersRes.data)

        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [dateFilter])

    // 2. EDITING LOGIC
    const handleEditClick = (login: any) => {
        setEditingLogin(login)
        // Ensure bank_attempts is an array
        setTempAttempts(Array.isArray(login.bank_attempts) ? login.bank_attempts : [])
        setIsEditOpen(true)
    }

    const handleAddAttempt = () => {
        setTempAttempts([...tempAttempts, { 
            bank: '', 
            status: 'Pending', 
            reason: '', 
            date: new Date().toISOString() 
        }])
    }

    const handleAttemptChange = (index: number, field: keyof BankAttempt, value: string) => {
        const updated = [...tempAttempts]
        updated[index] = { ...updated[index], [field]: value }
        setTempAttempts(updated)
    }

    const handleRemoveAttempt = (index: number) => {
        const updated = tempAttempts.filter((_, i) => i !== index)
        setTempAttempts(updated)
    }

    const handleSaveChanges = async () => {
        if (!editingLogin) return

        // Calculate overall status based on attempts
        // If any is Approved/Disbursed, overall is Approved. Else if all rejected, Rejected.
        const hasSuccess = tempAttempts.some(a => ['Approved', 'Disbursed'].includes(a.status))
        const overallStatus = hasSuccess ? 'Approved' : 'Pending' // Simple logic, customize as needed

        const { error } = await supabase
            .from('logins')
            .update({ 
                bank_attempts: tempAttempts,
                status: overallStatus,
                // Optional: Update top level bank_name to the latest attempt or approved one
                bank_name: tempAttempts.length > 0 ? tempAttempts[tempAttempts.length - 1].bank : editingLogin.bank_name
            })
            .eq('id', editingLogin.id)

        if (!error) {
            setIsEditOpen(false)
            fetchData() // Refresh list
        } else {
            alert("Failed to update login")
        }
    }

    // 3. FILTERING & STATS
    const filteredLogins = useMemo(() => {
        return logins.filter(l => {
            const matchesSearch = 
                (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (l.phone && l.phone.includes(searchQuery)) ||
                (l.users?.full_name && l.users.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesBank = selectedBank === 'all' || l.bank_name === selectedBank;
            return matchesSearch && matchesBank;
        })
    }, [logins, searchQuery, selectedBank])

    // Top Performers
    const topTelecallers = useMemo(() => {
        const counts: Record<string, number> = {}
        filteredLogins.forEach(l => {
            const name = l.users?.full_name || l.users?.email || 'Unknown User'
            counts[name] = (counts[name] || 0) + 1
        })
        return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5)
    }, [filteredLogins])

    // Bank Attempt Stats Helper
    const getLoginStats = (login: any) => {
        const attempts = Array.isArray(login.bank_attempts) ? login.bank_attempts : [];
        if (attempts.length === 0) return null;
        
        const approved = attempts.filter((a: any) => a.status === 'Approved' || a.status === 'Disbursed').length;
        const rejected = attempts.filter((a: any) => a.status === 'Rejected').length;
        const pending = attempts.filter((a: any) => a.status === 'Pending').length;

        return { total: attempts.length, approved, rejected, pending };
    }

    // Export CSV
    const downloadCSV = () => {
        const headers = ["Telecaller", "Customer Name", "Phone", "Banks Tried", "Status Summary", "Date"]
        const rows = filteredLogins.map(l => {
            const stats = getLoginStats(l);
            const summary = stats ? `${stats.total} Tried (${stats.approved} Appr, ${stats.rejected} Rej)` : "No Data";
            const banks = Array.isArray(l.bank_attempts) ? l.bank_attempts.map((b:any) => b.bank).join(", ") : l.bank_name;

            return [
                l.users?.full_name || "Unknown",
                l.name || "-",
                l.phone || "-",
                banks || "-",
                summary,
                new Date(l.updated_at).toLocaleDateString()
            ]
        })
        
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `logins_report.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <FileCheck className="h-8 w-8 text-indigo-600" />
                        Login Reporting
                    </h1>
                    <p className="text-gray-500 mt-1">Monitor submissions, bank statuses, and rejections</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="bg-white" onClick={downloadCSV} disabled={filteredLogins.length === 0}>
                        <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="shadow-sm border-l-4 border-indigo-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileCheck className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-gray-500">Total Logins</span>
                        </div>
                        <h2 className="text-3xl font-bold">{filteredLogins.length}</h2>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-l-4 border-amber-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Trophy className="h-5 w-5" /></div>
                            <span className="text-sm font-medium text-gray-500">Top Performers</span>
                        </div>
                        <div className="space-y-2">
                            {topTelecallers.map(([name, count], i) => (
                                <div key={name} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-700 truncate max-w-[120px]" title={name}>{i + 1}. {name}</span>
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold">{count}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-white border-b px-6 py-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <CardTitle className="text-lg">Detailed Records</CardTitle>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-[250px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input placeholder="Search..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter Bank" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {Array.from(new Set(logins.map(l => l.bank_name))).filter(b => b).map((b: any) => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead>Telecaller</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Banks Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-40"><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                            ) : filteredLogins.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center h-40 text-gray-500">No records found.</TableCell></TableRow>
                            ) : (
                                filteredLogins.map((item) => {
                                    const stats = getLoginStats(item);
                                    return (
                                        <TableRow key={item.id} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div className="font-semibold text-gray-900">{item.users?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-400">ID: {item.assigned_to?.slice(0,6)}...</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs font-mono text-gray-500">{item.phone}</div>
                                            </TableCell>
                                            <TableCell>
                                                {stats ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex gap-2">
                                                            {stats.approved > 0 && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{stats.approved} Appr</Badge>}
                                                            {stats.rejected > 0 && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{stats.rejected} Rej</Badge>}
                                                            {stats.pending > 0 && <Badge variant="outline" className="text-gray-600">{stats.pending} Pen</Badge>}
                                                        </div>
                                                        <span className="text-xs text-gray-400">{stats.total} banks tried</span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-600">{item.bank_name || 'N/A'}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {new Date(item.updated_at).toLocaleDateString()}
                                                <div className="text-xs text-gray-400">{new Date(item.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => handleEditClick(item)}>
                                                    <Edit className="h-4 w-4 mr-1" /> Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* --- CUSTOM MODAL FOR EDITING LOGIN --- */}
            {isEditOpen && editingLogin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Manage Login: {editingLogin.name}</h3>
                                <p className="text-sm text-gray-500">Phone: {editingLogin.phone}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(false)}><X className="h-5 w-5" /></Button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Bank Attempts Section */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                                        <Building2 className="h-4 w-4" /> Bank Applications
                                    </h4>
                                    <Button size="sm" onClick={handleAddAttempt} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                        <Plus className="h-4 w-4 mr-1" /> Add Bank
                                    </Button>
                                </div>

                                {tempAttempts.length === 0 ? (
                                    <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-400 bg-gray-50">
                                        No banks added yet. Click "Add Bank" to track attempts.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {tempAttempts.map((attempt, idx) => (
                                            <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleRemoveAttempt(idx)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-gray-500">Bank Name</label>
                                                        <Input 
                                                            placeholder="e.g. HDFC, SBI" 
                                                            value={attempt.bank} 
                                                            onChange={(e) => handleAttemptChange(idx, 'bank', e.target.value)}
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-gray-500">Status</label>
                                                        <Select 
                                                            value={attempt.status} 
                                                            onValueChange={(val: any) => handleAttemptChange(idx, 'status', val)}
                                                        >
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Pending">Pending</SelectItem>
                                                                <SelectItem value="Approved">Approved</SelectItem>
                                                                <SelectItem value="Disbursed">Disbursed</SelectItem>
                                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                {attempt.status === 'Rejected' && (
                                                    <div className="mt-3 space-y-1 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-xs font-medium text-red-600 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Rejection Reason
                                                        </label>
                                                        <Textarea 
                                                            placeholder="Why was it rejected? (e.g. Low CIBIL, Doc missing)" 
                                                            value={attempt.reason || ''} 
                                                            onChange={(e) => handleAttemptChange(idx, 'reason', e.target.value)}
                                                            className="bg-white border-red-200 focus:border-red-400 min-h-[60px]"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700 text-white">
                                <Save className="h-4 w-4 mr-2" /> Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* KYC Transfers Section (unchanged) */}
            <Card className="shadow-lg border-2 border-indigo-50 bg-indigo-50/20">
                <CardHeader className="border-b border-indigo-100 pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                        <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                        Today's KYC Handover Report
                        <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-700">{transfers.length} Leads</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-indigo-50/50 sticky top-0">
                                <TableRow>
                                    <TableHead className="font-semibold text-indigo-800">Telecaller Name</TableHead>
                                    <TableHead className="font-semibold text-indigo-800">Lead Name</TableHead>
                                    <TableHead className="font-semibold text-indigo-800 text-right">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24 text-gray-500 italic">No leads transferred today.</TableCell></TableRow>
                                ) : (
                                    transfers.map((t) => (
                                        <TableRow key={t.id} className="hover:bg-indigo-50/60 border-b border-indigo-100">
                                            <TableCell className="font-medium text-gray-800">{t.users?.full_name || 'Unknown'}</TableCell>
                                            <TableCell className="text-gray-700">{t.name}</TableCell>
                                            <TableCell className="text-right text-gray-500 font-mono text-sm">{new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
