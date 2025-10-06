"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, TrendingUp, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface DailyTargetProgressProps {
  userId: string
  targets: {
    daily_calls: number
    daily_completed: number
    monthly_target: number
  }
  currentCalls: number
  currentCompleted: number
}

export function DailyTargetProgress({ targets, currentCalls, currentCompleted }: DailyTargetProgressProps) {
  const callProgress = targets.daily_calls > 0 ? (currentCalls / targets.daily_calls) * 100 : 0
  const completedProgress = targets.daily_completed > 0 ? (currentCompleted / targets.daily_completed) * 100 : 0
  
  const getProgressColor = (progress: number) => {
    if (progress >= 90) return "bg-green-600"
    if (progress >= 70) return "bg-blue-600"
    if (progress >= 50) return "bg-yellow-600"
    return "bg-red-600"
  }

  const getStatus = (progress: number) => {
    if (progress >= 100) return "exceeded"
    if (progress >= 90) return "almost"
    if (progress >= 50) return "on-track"
    return "behind"
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Daily Targets
          <Badge variant={callProgress >= 100 ? "default" : "secondary"} className="ml-auto">
            {getStatus(callProgress)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calls Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Calls Target</span>
            <span className="text-gray-600">
              {currentCalls} / {targets.daily_calls}
            </span>
          </div>
          <Progress value={callProgress} className={getProgressColor(callProgress)} />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="h-3 w-3" />
            {callProgress >= 100 
              ? "Target exceeded! 🎉" 
              : `${Math.round(targets.daily_calls - currentCalls)} more calls to go`
            }
          </div>
        </div>

        {/* Completed Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completed Tasks</span>
            <span className="text-gray-600">
              {currentCompleted} / {targets.daily_completed}
            </span>
          </div>
          <Progress value={completedProgress} className={getProgressColor(completedProgress)} />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="h-3 w-3" />
            {completedProgress >= 100 
              ? "All tasks completed! ✅" 
              : `${Math.round(targets.daily_completed - currentCompleted)} tasks remaining`
            }
          </div>
        </div>

        {/* Monthly Target */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly Target</span>
            <span className="text-gray-600">{targets.monthly_target} leads</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
