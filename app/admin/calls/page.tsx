// ... (Your existing imports)
import { DrillDownSheet } from "@/components/admin/drill-down-sheet"; // <--- IMPORT THIS

// ... (Your existing getTelecallerLeadSummary function remains the same)

export default async function TelecallerLeadSummaryPage({ searchParams }: { searchParams: any }) {
  const { data: summaryData, grandTotals } = await getTelecallerLeadSummary(searchParams);
  
  // (Your existing maxCellValue logic)
  const maxCellValue = Math.max(...summaryData.map(t => Math.max(...Object.values(t.statusCounts))));

  return (
    <div className="space-y-6 p-8 bg-gray-50/50 min-h-screen">
      {/* ... Header ... */}
      
      <Card>
        {/* ... CardHeader ... */}
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              {/* ... TableHeader ... */}
              <TableBody>
                {summaryData.map((telecaller) => (
                  <TableRow key={telecaller.telecallerId}>
                    {/* Name Cell */}
                    <TableCell className="font-medium text-gray-900 sticky left-0 bg-white shadow-sm">
                      {telecaller.telecallerName}
                    </TableCell>
                    
                    {/* Total Cell */}
                    <TableCell className="text-right font-bold text-gray-900 bg-gray-50">
                      {telecaller.totalLeads}
                    </TableCell>

                    {/* Conversion Cell */}
                    <TableCell className="text-right font-bold text-blue-600 bg-blue-50/30">
                      {telecaller.conversionRate.toFixed(1)}%
                    </TableCell>

                    {/* Status Columns with DRILL DOWN */}
                    {LEAD_STATUSES.map((status) => {
                      const count = telecaller.statusCounts[status] || 0;
                      const isKeyMetric = status === 'Disbursed' || status === 'Login';
                      
                      return (
                        <TableCell 
                          key={status} 
                          className="text-right text-gray-700"
                          style={{ 
                            backgroundColor: isKeyMetric && count > 0 
                              ? (status === 'Disbursed' ? '#dcfce7' : '#dbeafe')
                              : getCellColor(count, maxCellValue)
                          }}
                        >
                          {/* REPLACED PLAIN TEXT WITH COMPONENT */}
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
              </TableBody>
              {/* ... TableFooter ... */}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
