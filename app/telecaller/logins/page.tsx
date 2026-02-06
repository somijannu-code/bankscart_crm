"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/l
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, FileText, CheckCircle2, AlertCircle, RefreshCcw, Search } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

// Simple Debounce Hook for Phone Search
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function TelecallerLoginsPage() {
    const supabase = createClient()
    const { toast } = useToast()
    
    const [loading, setLoading] = useState(false)
    const [checkingPhone, setCheckingPhone] = useState(false)
    
    // Form & Data State
    const [formData, setFormData] = useState({
        id: null as string | null, // Track ID for editing
        name: "",
        phone: "",
        bank_name: "",
        notes: ""
    })
    
    const [logins, setLogins] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState("today")
    const [existingWarning, setExistingWarning] = useState<string | null>(null)

    const debouncedPhone = useDebounce(formData.phone, 500)

    // 1. AUTO-CHECK PHONE NUMBER (Updated to check 'logins' table)
    useEffect(() => {
        const checkPhone = async () => {
            if (debouncedPhone.length < 10) return
            setCheckingPhone(true)
            setExistingWarning(null)

            // CHANGED: Checking 'logins' table
            const { data } = await supabase
                .from('logins')
                .select('*')
                .eq('phone', debouncedPhone)
                .order('updated_at', { ascending: false }) // Get most recent
                .limit(1)
                .single()

            if (data) {
                // Auto-fill name if found in previous logins
                setFormData(prev => ({ ...prev, name: data.name }))
                
                // Warn if already logged in TODAY
                const lastUpdate = new Date(data.updated_at).toDateString()
                const today = new Date().toDateString()
                if (lastUpdate === today) {
                    setExistingWarning("⚠️ You have already logged this file today!")
                    // Also set ID to enable edit mode for today's entry
                    setFormData(prev => ({ 
                        ...prev, 
                        id: data.id, 
                        bank_name: data.bank_name || "",
                        notes: data.notes || ""
                    }))
                } else {
                    toast({ description: "Previous login found. Name auto-filled.", className: "bg-blue-50" })
                }
            }
            setCheckingPhone(false)
        }
        checkPhone()
    }, [debouncedPhone, supabase, toast])

    // 2. FETCH DATA (Updated to fetch from 'logins')
    const fetchLogins = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // CHANGED: Fetching from 'logins' table
        let query = supabase
            .from('logins')
            .select('*')
            .eq('assigned_to', user.id)
            .order('updated_at', { ascending: false })

        // Date Filters
        const today = new Date()
        if (activeTab === 'today') {
            query = query.gte('updated_at', new Date(today.setHours(0,0,0,0)).toISOString())
        } else {
            query = query.gte('updated_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
        }

        const { data } = await query
        if (data) setLogins(data)
    }, [supabase, activeTab])

    useEffect(() => { fetchLogins() }, [fetchLogins])

    // 3. SUBMIT HANDLER (Updated to write to 'logins')
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                bank_name: formData.bank_name,
                notes: formData.notes,
                status: 'Login Done',
                assigned_to: user?.id,
                updated_at: new Date().toISOString()
            }

            // CHANGED: Operations on 'logins' table
            if (formData.id) {
                const { error } = await supabase.from('logins').update(payload).eq('id', formData.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('logins').insert([payload])
                if (error) throw error
            }

            toast({ 
                title: "Success! 🎉", 
                description: `Login for ${formData.name} recorded.`, 
                className: "bg-green-50 border-green-200" 
            })
            
            // Reset
            setFormData({ id: null, name: "", phone: "", bank_name: "", notes: "" })
            setExistingWarning(null)
            fetchLogins()

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    // Filtered List for Search
    const filteredLogins = logins.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.phone.includes(searchTerm) ||
        l.bank_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-gray-50/50 min-h-screen">
            
            {/* Header Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="h-7 w-7 text-indigo-600" />
                        Login Entry
                    </h1>
                    <p className="text-gray-500 text-sm">Track your daily file submissions</p>
                </div>
                
                <Card className="bg-white border-l-4 border-indigo-500 shadow-sm min-w-[200px]">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-full text-indigo-600">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Logins Today</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {logins.filter(l => new Date(l.updated_at).toDateString() === new Date().toDateString()).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT: FORM (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                    <Card className="shadow-lg border-t-4 border-indigo-600">
                        <CardHeader className="bg-gray-50/50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center justify-between">
                                {formData.id ? "Edit Entry" : "New Entry"}
                                {formData.id && (
                                    <Button variant="ghost" size="sm" onClick={() => setFormData({ id: null, name: "", phone: "", bank_name: "", notes: "" })}>
                                        Cancel Edit
                                    </Button>
                                )}
                            </CardTitle>
                            <CardDescription>Enter customer details accurately</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                
                                {/* Phone Input with Live Check */}
                                <div className="space-y-2 relative">
                                    <Label>Mobile Number <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Input 
                                            placeholder="9876543210" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})}
                                            maxLength={10}
                                            className={existingWarning ? "border-red-300 bg-red-50" : ""}
                                        />
                                        {checkingPhone && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
                                    </div>
                                    {existingWarning && (
                                        <p className="text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> {existingWarning}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Customer Name <span className="text-red-500">*</span></Label>
                                    <Input 
                                        placeholder="Enter full name" 
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Bank Name <span className="text-red-500">*</span></Label>
                                    <Select 
                                        value={formData.bank_name} 
                                        onValueChange={(val) => setFormData({...formData, bank_name: val})}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                                            <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                                            <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                                            <SelectItem value="Incred">Incred</SelectItem>
                                            <SelectItem value="IDFC First">IDFC First</SelectItem>
                                            <SelectItem value="FINNABLE">FINNABLE</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Notes / Remarks</Label>
                                    <Textarea 
                                        placeholder="E.g., Docs collected, login id..." 
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        rows={3}
                                    />
                                </div>

                                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11" disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : formData.id ? "Update Entry" : "Submit Login"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: LIST (8 cols) */}
                <div className="lg:col-span-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                            <TabsList className="grid w-full sm:w-[300px] grid-cols-2">
                                <TabsTrigger value="today">Today</TabsTrigger>
                                <TabsTrigger value="month">This Month</TabsTrigger>
                            </TabsList>
                            
                            <div className="relative w-full sm:w-[250px]">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                                <Input 
                                    placeholder="Search name or bank..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <Card className="shadow-sm border-gray-200">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogins.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-32 text-gray-500">
                                                No records found for "{searchTerm}" in this period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLogins.map((login) => (
                                            <TableRow key={login.id} className="hover:bg-gray-50 group">
                                                <TableCell>
                                                    <div className="font-medium text-gray-900">{login.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono mt-0.5">{login.phone}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">
                                                            {login.bank_name}
                                                        </Badge>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(login.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    {login.notes && <div className="text-xs text-gray-500 truncate max-w-[200px]">{login.notes}</div>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            setFormData({
                                                                id: login.id,
                                                                name: login.name,
                                                                phone: login.phone,
                                                                bank_name: login.bank_name,
                                                                notes: login.notes
                                                            })
                                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                                        }}
                                                    >
                                                        <RefreshCcw className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
