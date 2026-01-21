"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Upload, CheckCircle, AlertCircle, Download, 
  Zap, ArrowRight, History, PieChart 
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// --- Interfaces ---

interface Telecaller {
  id: string
  full_name: string
  email: string
}

interface DBField {
  key: string
  label: string
  required: boolean
}

const DB_FIELDS: DBField[] = [
  { key: 'name', label: 'Full Name', required: true },
  { key: 'phone', label: 'Phone Number', required: true },
  { key: 'email', label: 'Email Address', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'designation', label: 'Designation', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'loan_amount', label: 'Loan Amount', required: false },
]

// --- Helper Functions ---

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const cleanPhoneNumber = (phone: string) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    return cleaned.substring(2);
  }
  return cleaned;
}

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  // --- State: General ---
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [telecallers, setTelecallers] = useState<Telecaller[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // --- State: Step 1 (File) ---
  const [file, setFile] = useState<File | null>(null)
  const [rawFileContent, setRawFileContent] = useState<string>("")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  
  // --- State: Step 2 (Mapping) ---
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}) 
  
  // --- State: Step 3 (Configuration & Preview) ---
  const [previewData, setPreviewData] = useState<any[]>([])
  const [selectedTelecaller, setSelectedTelecaller] = useState<string | null>(null)
  const [autoDistribute, setAutoDistribute] = useState(false)
  const [activeCount, setActiveCount] = useState<number>(0)
  const [globalSource, setGlobalSource] = useState("other") 
  const [globalTags, setGlobalTags] = useState("")
  
  // --- State: Step 4 (Upload & Progress) ---
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStats, setUploadStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0, updated: 0 })
  const [failedRows, setFailedRows] = useState<any[]>([])
  
  // --- NEW STATE: Assignment Summary ---
  const [assignmentSummary, setAssignmentSummary] = useState<Record<string, number>>({})
  const [showSummaryDialog, setShowSummaryDialog] = useState(false)

  // --- Effects ---
  useEffect(() => {
    fetchTelecallers()
    getCurrentUser()
    checkActiveTelecallersCount()
  }, [])

  // --- Data Fetching ---
  const fetchTelecallers = async () => {
    const { data } = await supabase.from("users").select("id, full_name, email").eq("role", "telecaller").eq("is_active", true)
    if (data) setTelecallers(data)
  }

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  const checkActiveTelecallersCount = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase.from("attendance").select("user_id", { count: 'exact', head: true }).eq("date", today).not("check_in", "is", null)
    if (count !== null) setActiveCount(count)
  }

  // --- Handlers: Step 1 (File Selection) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile)
      const text = await selectedFile.text()
      setRawFileContent(text)
      
      const lines = text.split("\n").filter(line => line.trim())
      if (lines.length > 0) {
        const headers = lines[0].split(",").map(h => h.trim())
        setCsvHeaders(headers)
        
        const initialMapping: Record<string, string> = {}
        DB_FIELDS.forEach(dbField => {
            const match = headers.find(h => h.toLowerCase().includes(dbField.key) || h.toLowerCase() === dbField.label.toLowerCase())
            if (match) initialMapping[dbField.key] = match
        })
        setColumnMapping(initialMapping)
      }
    } else {
      alert("Please select a valid CSV file")
    }
  }

  const goToStep2 = () => {
    if (!file) return;
    setStep(2)
  }

  // --- Handlers: Step 2 (Mapping) ---
  const goToStep3 = () => {
    const missingRequired = DB_FIELDS.filter(f => f.required && !columnMapping[f.key])
    if (missingRequired.length > 0) {
        alert(`Please map the following required fields: ${missingRequired.map(f => f.label).join(', ')}`)
        return
    }

    const lines = rawFileContent.split("\n").filter(line => line.trim()).slice(1) 
    const parsed = lines.slice(0, 50).map((line, idx) => {
        const values = line.split(",").map(v => v.trim())
        const row: any = { _id: idx } 
        
        Object.entries(columnMapping).forEach(([dbKey, csvHeader]) => {
            const headerIndex = csvHeaders.indexOf(csvHeader)
            if (headerIndex !== -1) {
                row[dbKey] = values[headerIndex]
            }
        })
        return row
    })
    setPreviewData(parsed)
    setStep(3)
  }

  // --- Handlers: Step 3 (Preview & Logic) ---
  const handleCellEdit = (rowId: number, field: string, value: string) => {
    setPreviewData(prev => prev.map(row => row._id === rowId ? { ...row, [field]: value } : row))
  }

  // --- MODIFIED: PROCESS UPLOAD WITH SMART DUPLICATE LOGIC ---
  const processUpload = async () => {
    setIsUploading(true)
    setUploadStats({ total: 0, success: 0, failed: 0, skipped: 0, updated: 0 })
    setFailedRows([])
    setAssignmentSummary({})
    
    // 1. Parse ALL Data
    const lines = rawFileContent.split("\n").filter(line => line.trim()).slice(1)
    
    // Statuses that prevent overwriting/uploading
    const RESTRICTED_STATUSES = new Set(['interested', 'login', 'documents_sent', 'disbursed'])

    let tempSkipCount = 0;
    const seenPhonesInFile = new Set<string>();
    
    // Deduplicate within the file immediately
    const uniqueRows = lines.reduce((acc: any[], line, idx) => {
        const values = line.split(",").map(v => v.trim())
        const row: any = {}
        
        Object.entries(columnMapping).forEach(([dbKey, csvHeader]) => {
            const headerIndex = csvHeaders.indexOf(csvHeader)
            if (headerIndex !== -1) {
                let val = values[headerIndex]
                if (dbKey === 'phone') val = cleanPhoneNumber(val)
                row[dbKey] = val
            }
        })

        row._originalIndex = idx + 2; 

        if (row.phone) {
            if (seenPhonesInFile.has(row.phone)) {
                tempSkipCount++;
                return acc;
            } else {
                seenPhonesInFile.add(row.phone);
            }
        }

        acc.push(row);
        return acc;
    }, []);

    const BATCH_SIZE = 50
    let successCount = 0
    let updatedCount = 0
    let skipCount = tempSkipCount;
    let failCount = 0
    const errors: any[] = []

    // 2. Prepare Auto-Assign List
    let distributionList: string[] = []
    if (autoDistribute) {
        const today = new Date().toISOString().split('T')[0]
        const { data: activeUsers } = await supabase.from("attendance").select("user_id").eq("date", today).not("check_in", "is", null)
        if (activeUsers) distributionList = shuffleArray(activeUsers.map(u => u.user_id))
    }

    // 3. Batch Process
    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
        const batch = uniqueRows.slice(i, i + BATCH_SIZE)
        const phones = batch.map(r => r.phone).filter(Boolean)
        
        // Fetch existing leads to check status
        const { data: existingDBLeads } = await supabase
            .from("leads")
            .select("id, phone, status")
            .in("phone", phones)
        
        const existingMap = new Map()
        existingDBLeads?.forEach(lead => {
            existingMap.set(lead.phone, { id: lead.id, status: lead.status?.toLowerCase() || '' })
        })

        const leadsToUpsert: any[] = []

        batch.forEach(row => {
            const existing = existingMap.get(row.phone)
            
            if (existing) {
                // Check if restricted
                if (RESTRICTED_STATUSES.has(existing.status)) {
                    // SKIP: Status is in the protected list
                    skipCount++
                } else {
                    // UPDATE: Status is NOT protected (e.g. New, Follow Up, NR)
                    // Attach ID to force update
                    row.id = existing.id 
                    leadsToUpsert.push(row)
                    updatedCount++ 
                }
            } else {
                // INSERT: New Lead
                // Ensure NO 'id' is passed for new leads so DB generates it
                const { id, ...newLead } = row
                leadsToUpsert.push(newLead)
            }
        })

        if (leadsToUpsert.length > 0) {
            const currentBatchAssignments: Record<string, number> = {} 

            const finalLeads = leadsToUpsert.map((lead, idx) => {
                 let assigneeId = null
                 
                 // Logic: If it's an update, we might re-assign or keep old assignment. 
                 // The prompt implies "update these new leads" which usually means treating them as fresh input.
                 // So we apply assignment logic to updates as well.
                 if (autoDistribute && distributionList.length > 0) {
                     assigneeId = distributionList[(successCount + idx) % distributionList.length]
                 } else if (selectedTelecaller && selectedTelecaller !== "unassigned") {
                     assigneeId = selectedTelecaller
                 }

                 if (assigneeId) {
                    currentBatchAssignments[assigneeId] = (currentBatchAssignments[assigneeId] || 0) + 1
                 }

                 // CLEANUP: Remove ANY UI-specific fields or undefined IDs before sending to DB
                 const { _originalIndex, _id, ...cleanLeadData } = lead;

                 return {
                    ...cleanLeadData,
                    source: (globalSource || lead.source || "other").toLowerCase(),
                    tags: globalTags ? globalTags.split(",").map(t => t.trim()) : [],
                    assigned_to: assigneeId,
                    assigned_by: currentUserId,
                    assigned_at: assigneeId ? new Date().toISOString() : null,
                    email: lead.email || null,
                    company: lead.company || null,
                    priority: 'medium',
                    status: 'new', // Reset status to new for imported leads (even updates)
                    last_contacted: new Date().toISOString() // Mark as fresh
                 }
            })

            // Use upsert to handle both inserts and updates (based on ID presence)
            // Explicitly excluding 'id' for new rows ensures Postgres generates UUID
            const { error } = await supabase.from("leads").upsert(finalLeads)
            
            if (error) {
                console.error("Batch Upload Error:", error)
                failCount += leadsToUpsert.length
                leadsToUpsert.forEach(l => errors.push({ ...l, error: error.message }))
                // If failed, revert the updated count guess
                updatedCount -= leadsToUpsert.filter(l => l.id).length
            } else {
                successCount += leadsToUpsert.length
                
                setAssignmentSummary(prev => {
                    const next = { ...prev }
                    Object.entries(currentBatchAssignments).forEach(([id, count]) => {
                        next[id] = (next[id] || 0) + count
                    })
                    return next
                })
            }
        }
    }

    const processed = Math.min(uniqueRows.length, uniqueRows.length)
    setProgress(100)

    setUploadStats({
        total: uniqueRows.length + (lines.length - uniqueRows.length),
        success: successCount - updatedCount, // Fresh inserts
        updated: updatedCount, // Overwritten leads
        skipped: skipCount,
        failed: failCount
    })
    setFailedRows(errors)
    setIsUploading(false)
    setStep(4)
    
    if (autoDistribute || (selectedTelecaller && selectedTelecaller !== 'unassigned')) {
        setShowSummaryDialog(true)
    }
  }

  // --- Handlers: Step 4 (Results) ---
  const downloadErrorCSV = () => {
    if (failedRows.length === 0) return
    const headers = ["Row", "Name", "Phone", "Error Message"]
    const csvContent = [headers.join(","), ...failedRows.map(row => `${row._originalIndex || '-'},"${row.name || ''}","${row.phone || ''}","${row.error}"`)].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `upload-errors-${new Date().toISOString()}.csv`
    a.click()
  }

  const downloadTemplate = () => {
    const template = `Name,Phone,Email,Company,Designation,Address,City,Loan Amount,Notes\nJohn Doe,9876543210,john@example.com,Acme Corp,Manager,123 Main St,Mumbai,500000,Interested in PL`
    const blob = new Blob([template], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "leads_template.csv"
    a.click()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header & Steps Indicator */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import Leads</h1>
          <p className="text-gray-600">Bulk upload wizard with duplicate checking and auto-assignment.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className={step >= 1 ? "text-blue-600 font-bold" : ""}>1. File</span> &rarr;
            <span className={step >= 2 ? "text-blue-600 font-bold" : ""}>2. Map</span> &rarr;
            <span className={step >= 3 ? "text-blue-600 font-bold" : ""}>3. Config</span> &rarr;
            <span className={step >= 4 ? "text-blue-600 font-bold" : ""}>4. Finish</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* STEP 1: FILE UPLOAD */}
        {step === 1 && (
            <Card>
                <CardHeader>
                    <CardTitle>Select Data File</CardTitle>
                    <CardDescription>Upload a CSV file containing your lead data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors">
                        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                        <div className="space-y-2">
                             <Label htmlFor="csv-file" className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-100 transition">
                                Choose CSV File
                             </Label>
                             <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                             <p className="text-sm text-gray-500">{file ? file.name : "No file selected"}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={downloadTemplate} size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" /> Download Template
                    </Button>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={goToStep2} disabled={!file}>
                        Next: Map Columns <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </CardFooter>
            </Card>
        )}

        {/* STEP 2: COLUMN MAPPING */}
        {step === 2 && (
            <Card>
                <CardHeader>
                    <CardTitle>Map Columns</CardTitle>
                    <CardDescription>Match your CSV headers to the database fields.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {DB_FIELDS.map((field) => (
                            <div key={field.key} className="flex items-center justify-between p-3 border rounded-md bg-white">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm flex items-center gap-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 text-xs">*</span>}
                                    </span>
                                    <span className="text-xs text-gray-500">Database Field</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-gray-300" />
                                <Select 
                                    value={columnMapping[field.key] || "ignore"} 
                                    onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [field.key]: val === "ignore" ? "" : val }))}
                                >
                                    <SelectTrigger className={`w-[180px] ${!columnMapping[field.key] && field.required ? "border-red-300" : ""}`}>
                                        <SelectValue placeholder="Ignore Column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ignore" className="text-gray-400 italic">Ignore Column</SelectItem>
                                        {csvHeaders.map(header => (
                                            <SelectItem key={header} value={header}>{header}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                    <Button onClick={goToStep3}>Next: Preview & Config <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </CardFooter>
            </Card>
        )}

        {/* STEP 3: PREVIEW & CONFIGURATION */}
        {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Data Preview</CardTitle>
                        <CardDescription>Review the first 50 rows. You can edit cells here to fix typos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="border rounded-md overflow-x-auto max-h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {DB_FIELDS.filter(f => columnMapping[f.key]).map(f => (
                                            <TableHead key={f.key} className="whitespace-nowrap">{f.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row) => (
                                        <TableRow key={row._id}>
                                            {DB_FIELDS.filter(f => columnMapping[f.key]).map(f => (
                                                <TableCell key={f.key} className="p-1">
                                                    <input 
                                                        className="w-full bg-transparent text-sm px-2 py-1 focus:outline-none focus:bg-blue-50 rounded"
                                                        value={row[f.key] || ""}
                                                        onChange={(e) => handleCellEdit(row._id, f.key, e.target.value)}
                                                    />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>Import Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        {/* Global Attributes */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label>Global Attributes</Label>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Lead Source</Label>
                                <Select value={globalSource} onValueChange={setGlobalSource}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="campaign">Campaign</SelectItem>
                                        <SelectItem value="cold_call">Cold Call</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Add Tags (comma separated)</Label>
                                <Input value={globalTags} onChange={(e) => setGlobalTags(e.target.value)} placeholder="e.g. Diwali Promo, VIP" />
                            </div>
                        </div>

                        {/* Assignment Logic */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label>Assignment</Label>
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md border">
                                <div className="space-y-0.5">
                                    <Label className="text-sm flex items-center gap-2">
                                        <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                        Auto-Distribute
                                    </Label>
                                    <p className="text-[10px] text-gray-500">{activeCount} agents online</p>
                                </div>
                                <Switch checked={autoDistribute} onCheckedChange={setAutoDistribute} />
                            </div>
                            
                            {!autoDistribute && (
                                <Select value={selectedTelecaller || ""} onValueChange={setSelectedTelecaller}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select specific user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {telecallers.map(tc => (
                                            <SelectItem key={tc.id} value={tc.id}>{tc.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button className="w-full" onClick={processUpload} disabled={isUploading}>
                            {isUploading ? "Uploading..." : "Start Import"}
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(2)} disabled={isUploading}>Back</Button>
                    </CardFooter>
                </Card>
            </div>
        )}

        {/* STEP 3.5: UPLOADING PROGRESS OVERLAY */}
        {isUploading && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-[400px]">
                    <CardHeader>
                        <CardTitle>Importing Leads...</CardTitle>
                        <CardDescription>Please do not close this window.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Progress value={progress} className="h-3" />
                        <p className="text-center text-sm text-gray-500">{progress}% Complete</p>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* STEP 4: RESULTS */}
        {step === 4 && (
            <Card className="max-w-2xl mx-auto text-center">
                <CardHeader>
                    <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <CardTitle>Import Complete</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{uploadStats.total}</div>
                            <div className="text-sm text-gray-500">Total Rows</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-700">{uploadStats.success}</div>
                            <div className="text-sm text-green-600">Added New</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-700">{uploadStats.updated}</div>
                            <div className="text-sm text-blue-600">Updated</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1">
                         <div className="bg-amber-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-amber-700">{uploadStats.skipped}</div>
                            <div className="text-sm text-amber-600">Skipped (Active Leads)</div>
                        </div>
                    </div>

                    {/* ASSIGNMENT REPORT BUTTON */}
                    {(Object.keys(assignmentSummary).length > 0) && (
                        <div className="flex justify-center">
                            <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
                                        <PieChart className="h-4 w-4" />
                                        View Assignment Report
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Lead Distribution Report</DialogTitle>
                                        <DialogDescription>
                                            Breakdown of leads assigned in this upload batch.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto">
                                        {Object.entries(assignmentSummary).map(([id, count]) => {
                                            const agent = telecallers.find(t => t.id === id)
                                            return (
                                                <div key={id} className="flex items-center justify-between p-2 border-b last:border-0">
                                                    <span className="font-medium">{agent?.full_name || "Unknown Agent"}</span>
                                                    <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">{count} leads</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {uploadStats.failed > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">{uploadStats.failed} rows failed</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadErrorCSV} className="border-red-200 text-red-700 hover:bg-red-100">
                                <Download className="h-4 w-4 mr-2" /> Download Error Log
                            </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => window.location.reload()}>Upload Another File</Button>
                    <Button onClick={() => router.push("/admin/leads")}>View Leads</Button>
                </CardFooter>
            </Card>
        )}
      </div>

      {/* RECENT HISTORY SECTION */}
      {step === 1 && (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-gray-500" /> Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-sm text-gray-500 italic">
                    (Session history is cleared on refresh. To view permanent history, ensure 'upload_logs' table is configured in Supabase.)
                </div>
            </CardContent>
         </Card>
      )}
    </div>
  )
}
