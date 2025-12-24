"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, FileCheck, Download, Search, Building2, Trophy, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminLoginsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [logins, setLogins] = useState<any[]>([])
    
    // Filters
    const [dateFilter, setDateFilter] = useState("today")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedBank, setSelectedBank] = useState("all")

    // 1. DATA FETCHING
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // CHANGED: Fetching from 'logins' table instead of 'leads'
            let query = supabase
                .from('logins') 
                .select(`
                    id, name, phone, bank_name, updated_at, notes, status,
                    assigned_to,
                    users:assigned_to ( full_name )
                `)
                .order('updated_at', { ascending: false })

            // Date Logic
            const today = new Date()
            if (dateFilter === 'today') {
                query = query.gte('updated_at', new Date(today.setHours(0,0,0,0)).toISOString())
            } else if (dateFilter === 'month') {
                query = query.gte('updated_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
            }

            const { data, error } = await query
            
            if (error) {
                console.error("Error fetching logins:", error)
            } else if (data) {
                setLogins(data)
            }
            setLoading(false)
        }
        fetchData()
    }, [dateFilter, supabase])

    // 2. CLIENT-SIDE FILTERING & AGGREGATION
    const filteredLogins = useMemo(() => {
        return logins.filter(l => {
            const matchesSearch = 
                l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                l.phone?.includes(searchQuery) ||
                l.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
            
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

    // --- NEW LOGIC: Today's Top Performers ---
    const todayTopTelecallers = useMemo(() => {
        const todayStr = new Date().toDateString()
        
        // 1. Filter only today's logins
        const todayLogins = logins.filter(l => new Date(l.updated_at).toDateString() === todayStr)

        // 2. Count per user
        const counts: Record<string, number> = {}
        todayLogins.forEach(l => {
            const name = l.users?.full_name || 'Unknown'
            counts[name] = (counts[name] || 0) + 1
        })

        // 3. Sort Descending and take top 3
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
    }, [logins]) 

    // 3. EXPORT TO CSV
    const downloadCSV = () => {
        const headers = ["Telecaller", "Customer Name", "Phone", "Bank", "Date", "Notes"]
        const rows = filteredLogins.map(l => [
            l.users?.full_name || "Unknown",
            l.name,
            l.phone,
            l.bank_name,
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

                {/* Card 2: Today's Top Performers */}
                <Card className="shadow-sm border-l-4 border-amber-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <Trophy className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-500">Today's Top Logins</span>
                        </div>
                        <div className="space-y-2">
                            {todayTopTelecallers.length > 0 ? (
                                todayTopTelecallers.map(([name, count], i) => (
                                    <div key={name} className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-gray-700">
                                            {i + 1}. {name}
                                        </span>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold">
                                            {count}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400">No logins recorded today</p>
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
                                            <div className="font-semibold text-gray-900">{item.users?.full_name || 'Unknown'}</div>
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
        </div>
    )
}
