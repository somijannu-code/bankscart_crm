"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react"
import { DrillDownSheet } from "@/components/admin/drill-down-sheet"

// --- Helper for Heatmap ---
const getCellColor = (value: number, max: number) => {
  if (value === 0) return "";
  const intensity = Math.min((value / max) * 100, 100); 
  return `rgba(16, 185, 129, ${intensity * 0.005 + 0.05})`; 
};

interface TelecallerTableProps {
  data: any[];
  grandTotals: any;
  statuses: string[];
}

export function TelecallerTable({ data, grandTotals, statuses }: TelecallerTableProps) {
  // State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'totalLeads', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(new Set(statuses));

  // 1. Filter Logic
  const filteredData = useMemo(() => {
    return data.filter(agent => 
      agent.telecallerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // 2. Sort Logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue, bValue;

      // Handle specific columns
      if (sortConfig.key === 'name') {
        aValue = a.telecallerName;
        bValue = b.telecallerName;
      } else if (sortConfig.key === 'totalLeads') {
        aValue = a.totalLeads;
        bValue = b.totalLeads;
      } else if (sortConfig.key === 'conversion') {
        aValue = a.conversionRate;
        bValue = b.conversionRate;
      } else {
        // Handle Status Columns dynamically
        aValue = a.statusCounts[sortConfig.key] || 0;
        bValue = b.statusCounts[sortConfig.key] || 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Handler for sorting
  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Handler for toggle columns
  const toggleColumn = (status: string) => {
    const next = new Set(visibleStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setVisibleStatuses(next);
  };

  const maxCellValue = Math.max(...data.map(t => Math.max(...Object.values(t.statusCounts as Record<string, number>))));

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex justify-between items-center bg-white p-2 rounded-md border border-gray-100 shadow-sm">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search agent name..." 
            className="pl-9 h-9 bg-gray-50 border-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {statuses.map((status) => (
              <DropdownMenuCheckboxItem 
                key={status} 
                checked={visibleStatuses.has(status)}
                onCheckedChange={() => toggleColumn(status)}
                className="capitalize"
              >
                {status.replace(/_/g, " ")}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* TABLE */}
      <div className="rounded-md border overflow-x-auto bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[180px]">
                <Button variant="ghost" onClick={() => handleSort('name')} className="h-8 -ml-4 font-bold text-gray-700">
                  Telecaller <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('totalLeads')} className="h-8 font-bold text-gray-900">
                  Total <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('conversion')} className="h-8 font-bold text-blue-700">
                  Conv. % <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {statuses.map((status) => {
                if (!visibleStatuses.has(status)) return null;
                return (
                  <TableHead key={status} className="text-right">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort(status)}
                      className={`h-8 font-bold capitalize ${status === 'Disbursed' ? 'text-green-700' : 'text-gray-600'}`}
                    >
                      {status.replace(/_/g, " ")} <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((telecaller) => (
              <TableRow key={telecaller.telecallerId} className="hover:bg-gray-50 transition-colors">
                <TableCell className="font-medium text-gray-900 sticky left-0 bg-white shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                  {telecaller.telecallerName}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 bg-gray-50/50">
                  {telecaller.totalLeads}
                </TableCell>
                <TableCell className="text-right font-bold text-blue-600 bg-blue-50/20">
                  {telecaller.conversionRate.toFixed(1)}%
                </TableCell>
                {statuses.map((status) => {
                  if (!visibleStatuses.has(status)) return null;
                  const count = telecaller.statusCounts[status] || 0;
                  const isKeyMetric = status === 'Disbursed' || status === 'Login';
                  return (
                    <TableCell 
                      key={status} 
                      className="text-right text-gray-700 p-2"
                      style={{ 
                        backgroundColor: isKeyMetric && count > 0 
                          ? (status === 'Disbursed' ? '#dcfce7' : '#dbeafe')
                          : getCellColor(count, maxCellValue)
                      }}
                    >
                      <DrillDownSheet 
                        agentId={telecaller.telecallerId}
                        agentName={telecaller.telecallerName}
                        status={status}
                        count={count}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {sortedData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={statuses.length + 3} className="h-24 text-center text-gray-500">
                        No agents found matching &quot;{searchTerm}&quot;
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white hover:bg-slate-900">
            <TableRow>
              <TableCell className="font-bold">Grand Total</TableCell>
              <TableCell className="text-right font-bold">{grandTotals['total'].toLocaleString()}</TableCell>
              <TableCell className="text-right font-bold text-blue-300">
                {grandTotals['total'] > 0 
                  ? ((grandTotals['Disbursed'] / grandTotals['total']) * 100).toFixed(1) + "%" 
                  : "0%"}
              </TableCell>
              {statuses.map(status => {
                if (!visibleStatuses.has(status)) return null;
                return (
                  <TableCell key={status} className={`text-right font-bold ${status === 'Disbursed' ? 'text-green-300' : 'text-slate-300'}`}>
                    {grandTotals[status].toLocaleString()}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
