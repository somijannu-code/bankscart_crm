"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle, Search, FileText, Calendar } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function TelecallerLoginsPage() {
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    
    // Form State
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        bank_name: "",
        notes: ""
    })
    
    // Data State
    const [logins, setLogins] = useState<any[]>([])
    const [fetchLoading, setFetchLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("today")

    // 1. FETCH LOGINS (My Logins Only)
    const fetchLogins = useCallback(async () => {
        setFetchLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase
            .from('leads')
            .select('*')
            .eq('assigned_to', user.id) // Only my data
            .eq('status', 'Login Done') // Filter for Logins
            .order('updated_at', { ascending: false })

        // Apply Date Filters based on Tab
        const today = new Date()
        const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

        if (activeTab === 'today') {
            query = query.gte('updated_at', startOfDay)
        } else {
            query = query.gte('updated_at', startOfMonth)
        }

        const { data, error } = await query
        if (data) setLogins(data)
        setFetchLoading(false)
    }, [supabase, activeTab])

    useEffect(() => {
        fetchLogins()
    }, [fetchLogins])

    // 2. HANDLE SUBMISSION
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.phone || !formData.name || !formData.bank_name) {
            toast({ title: "Missing Fields", description: "Name, Phone and Bank are required.", variant: "destructive" })
            return
        }

        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        try {
            // Step A: Check if lead exists
            const { data: existing } = await supabase
                .from('leads').select('id').eq('phone', formData.phone).single()

            let error;
            const payload = {
                name: formData.name,
                phone: formData.phone,
                bank_name: formData.bank_name,
                notes: formData.notes,
                status: 'Login Done', // Force status
                assigned_to: user?.id, // Assign to self
                updated_at: new Date().toISOString()
            }

            if (existing) {
                // Update existing lead to "Login Done"
                const res = await supabase.from('leads').update(payload).eq('id', existing.id)
                error = res.error
            } else {
                // Create new lead as "Login Done"
                const res = await supabase.from('leads').insert([payload])
                error = res.error
            }

            if (error) throw error

            toast({ title: "Login Added", description: "Details saved successfully." })
            setFormData({ name: "", phone: "", bank_name: "", notes: "" }) // Reset
            fetchLogins() // Refresh list

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 space-y-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-8 w-8 text-blue-600" />
                Daily Login Entry
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* LEFT: ENTRY FORM */}
                <Card className="md:col-span-1 shadow-md border-t-4 border-blue-600 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Login</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Mobile Number *</Label>
                                <Input 
                                    placeholder="9876543210" 
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    maxLength={10}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer Name *</Label>
                                <Input 
                                    placeholder="Enter name" 
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Login Bank *</Label>
                                <Select 
                                    value={formData.bank_name} 
                                    onValueChange={(val) => setFormData({...formData, bank_name: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                                        <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                                        <SelectItem value="Fi Money">Fi Money</SelectItem>
                                        <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea 
                                    placeholder="Any remarks..." 
                                    value={formData.notes}
                                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                />
                            </div>
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Login Details"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* RIGHT: VIEW LIST */}
                <div className="md:col-span-2 space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="today">Today's Logins</TabsTrigger>
                            <TabsTrigger value="month">This Month</TabsTrigger>
                        </TabsList>

                        <div className="mt-4 bg-white rounded-md border shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Bank</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead className="text-right">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fetchLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                            </TableCell>
                                        </TableRow>
                                    ) : logins.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24 text-gray-500">
                                                No logins found for this period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logins.map((login) => (
                                            <TableRow key={login.id}>
                                                <TableCell className="font-medium">{login.name}</TableCell>
                                                <TableCell>
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">
                                                        {login.bank_name}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{login.phone}</TableCell>
                                                <TableCell className="text-right text-gray-500 text-xs">
                                                    {new Date(login.updated_at).toLocaleDateString()} <br/>
                                                    {new Date(login.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
