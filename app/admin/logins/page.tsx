"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, FileCheck, Download, Search, Building2, Trophy, Calendar, ArrowRightLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminLoginsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [logins, setLogins] = useState<any[]>([])
    // New State for Transfers
    const [transfers, setTransfers] = useState<any[]>([])
    
    // Filters
    const [dateFilter, setDateFilter] = useState("month")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedBank, setSelectedBank] = useState("all")

    // 1. DATA FETCHING
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // A. Fetch Logins (Existing Logic)
            let loginsQuery = supabase
                .from('logins') 
                .select(`
                    id, name, phone, bank_name, updated_at, notes, status,
                    assigned_to,
                    users:assigned_to ( full_name, email )
                `)
                .order('updated_at', { ascending: false })

            // Date Logic for Logins
            const todayDate = new Date()
            const startOfToday = new Date(todayDate.setHours(0,0,0,0)).toISOString()

            if (dateFilter === 'today') {
                loginsQuery = loginsQuery.gte('updated_at', startOfToday)
            } else if (dateFilter === 'month') {
                loginsQuery = loginsQuery.gte('updated_at', new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString())
            }

            // B. Fetch Today's KYC Transfers (New Logic)
            // We fetch from 'leads' table where status is 'Transferred to KYC' and updated TODAY
            const transfersQuery = supabase
                .from('leads')
                .select(`
                    id, name, updated_at,
                    users:assigned_to ( full_name )
                `)
                .eq('status', 'Transferred to KYC')
                .gte('updated_at', startOfToday) // Always fetch ONLY today's transfers
                .order('updated_at', { ascending: false })

            // Execute both queries in parallel
            const [loginsRes, transfersRes] = await Promise.all([loginsQuery, transfersQuery])
            
            if (loginsRes.error) console.error("Error fetching logins:", loginsRes.error)
            else if (loginsRes.data) setLogins(loginsRes.data)

            if (transfersRes.error) console.error("Error fetching transfers:", transfersRes.error)
            else if (transfersRes.data) setTransfers(transfersRes.data)

            setLoading(false)
        }
        fetchData()
    }, [dateFilter, supabase])

    // 2. CLIENT-SIDE FILTERING & AGGREGATION
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

    // Bank Stats Calculation
    const bankStats = useMemo(() => {
        const stats: Record<string, number> = {}
        filteredLogins.forEach(l => {
            const bank = l.bank_name || 'Other'
            stats[bank] = (stats[bank] || 0) + 1
        })
        return stats
    }, [filteredLogins])

    // 3. TOP PERFORMERS LOGIC
    const topTelecallers = useMemo(() => {
        const counts: Record<string, number> = {}
        
        filteredLogins.forEach(l => {
            // Use email if name is missing
            const name = l.users?.full_name || l.users?.email || 'Unknown User'
            counts[name] = (counts[name] || 0) + 1
        })

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
    }, [filteredLogins])

    // 4. EXPORT TO CSV
    const downloadCSV = () => {
        const headers = ["Telecaller", "Customer Name", "Phone", "Bank", "Date", "Notes"]
        const rows = filteredLogins.map(l => [
            l.users?.full_name || "Unknown",
            l.name || "-",
            l.phone || "-",
            l.bank_name || "-",
            new Date(l.updated_at).toLocaleDateString(),
            `"${l.notes || ''}"`
        ])
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `logins_report_${dateFilter}_${new Date().toISOString().slice(0,10)}.csv`)
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
                    <p className="text-gray-500 mt-1">Monitor daily submissions and bank distribution</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[140px] bg-white">
                            <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Button variant="outline" className="bg-white" onClick={downloadCSV} disabled={filteredLogins.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Card 1: Total Logins */}
                <Card className="shadow-sm border-l-4 border-indigo-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <FileCheck className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Total Logins</span>
                        </div>
                        <h2 className="text-3xl font-bold">{filteredLogins.length}</h2>
                    </CardContent>
                </Card>

                {/* Card 2: Top Performers */}
                <Card className="shadow-sm border-l-4 border-amber-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <Trophy className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Top Performers</span>
                        </div>
                        <div className="space-y-2">
                            {topTelecallers.length > 0 ? (
                                topTelecallers.map(([name, count], i) => (
                                    <div key={name} className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-gray-700 truncate max-w-[120px]" title={name}>
                                            {i + 1}. {name}
                                        </span>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold">
                                            {count}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400">No data available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Card 3 & 4: Top Banks */}
                {Object.entries(bankStats).sort(([,a], [,b]) => b - a).slice(0, 2).map(([bank, count]) => (
                    <Card key={bank} className="shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-medium text-gray-500 truncate" title={bank}>{bank}</span>
                            </div>
                            <h2 className="text-2xl font-bold">{count}</h2>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Data Section */}
            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-white border-b px-6 py-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <CardTitle className="text-lg">Detailed Records</CardTitle>
                        
                        <div className="flex gap-3 w-full md:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 md:w-[250px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input 
                                    placeholder="Search name, phone, user..." 
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            
                            {/* Bank Filter */}
                            <Select value={selectedBank} onValueChange={setSelectedBank}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Filter Bank" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {Array.from(new Set(logins.map(l => l.bank_name))).map((b: any) => (
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
                                <TableHead className="w-[200px]">Telecaller</TableHead>
                                <TableHead>Customer Details</TableHead>
                                <TableHead>Bank</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="hidden md:table-cell">Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-40">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
                                        <p className="text-sm text-gray-500">Loading records...</p>
                                    </TableCell>
                                </TableRow>
                            ) : filteredLogins.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-40 text-gray-500">
                                        No login records found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogins.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{item.users?.full_name || item.users?.email || 'Unknown'}</div>
                                            <div className="text-xs text-gray-400">ID: {item.assigned_to?.slice(0,6)}...</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-xs font-mono text-gray-500">{item.phone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-normal">
                                                {item.bank_name || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">
                                            {new Date(item.updated_at).toLocaleDateString()}
                                            <div className="text-xs text-gray-400">
                                                {new Date(item.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-xs text-gray-500 max-w-[200px] truncate" title={item.notes}>
                                            {item.notes || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* --- NEW SECTION: KYC TRANSFERS --- */}
            <Card className="shadow-lg border-2 border-indigo-50 bg-indigo-50/20">
                <CardHeader className="border-b border-indigo-100 pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                        <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                        Today's KYC Handover Report
                        <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-700">
                            {transfers.length} Leads
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-indigo-50/50 sticky top-0">
                                <TableRow>
                                    <TableHead className="font-semibold text-indigo-800">Telecaller Name</TableHead>
                                    <TableHead className="font-semibold text-indigo-800">Lead Name</TableHead>
                                    <TableHead className="font-semibold text-indigo-800 text-right">Time Transferred</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-gray-500 italic">
                                            No leads marked as 'Transferred to KYC' today.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transfers.map((t) => (
                                        <TableRow key={t.id} className="hover:bg-indigo-50/60 transition-colors border-b border-indigo-100">
                                            <TableCell className="font-medium text-gray-800">
                                                {t.users?.full_name || 'Unknown Telecaller'}
                                            </TableCell>
                                            <TableCell className="text-gray-700">
                                                {t.name}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-500 text-sm font-mono">
                                                {new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
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
