"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, FileCheck, Users, Calendar } from "lucide-react"

export default function AdminLoginsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [logins, setLogins] = useState<any[]>([])
    const [filter, setFilter] = useState("today") // today, month, all

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // 1. Fetch Logins
            let query = supabase
                .from('leads')
                .select(`
                    id, name, phone, bank_name, updated_at, notes,
                    assigned_to,
                    users:assigned_to ( full_name )
                `)
                .eq('status', 'Login Done')
                .order('updated_at', { ascending: false })

            // 2. Apply Filters
            const today = new Date()
            if (filter === 'today') {
                const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString()
                query = query.gte('updated_at', startOfDay)
            } else if (filter === 'month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
                query = query.gte('updated_at', startOfMonth)
            }

            const { data, error } = await query
            if (data) setLogins(data)
            setLoading(false)
        }

        fetchData()
    }, [filter, supabase])

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <FileCheck className="h-8 w-8 text-indigo-600" />
                        All Login Details
                    </h1>
                    <p className="text-gray-500 mt-1">Tracking all files marked as 'Login Done'</p>
                </div>
                
                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Calendar className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                            <FileCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Logins ({filter})</p>
                            <h2 className="text-3xl font-bold">{logins.length}</h2>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full text-green-600">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Telecallers</p>
                            <h2 className="text-3xl font-bold">
                                {new Set(logins.map(l => l.assigned_to)).size}
                            </h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Login Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead>Telecaller</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Bank</TableHead>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                                    </TableCell>
                                </TableRow>
                            ) : logins.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-gray-500">
                                        No login records found for this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logins.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-gray-50">
                                        <TableCell className="font-semibold text-indigo-700">
                                            {item.users?.full_name || 'Unknown'}
                                        </TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{item.phone}</TableCell>
                                        <TableCell>
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                                                {item.bank_name || 'N/A'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {new Date(item.updated_at).toLocaleDateString()} 
                                            <span className="text-xs ml-2 text-gray-400">
                                                {new Date(item.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-xs max-w-[200px] truncate" title={item.notes}>
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
