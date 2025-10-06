"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target } from "lucide-react"
import { Progress } from "@/components/ui/progress"

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

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Daily Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calls Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Calls Made</span>
            <span className="text-gray-600">
              {currentCalls} / {targets.daily_calls}
            </span>
          </div>
          <Progress value={callProgress} className={getProgressColor(callProgress)} />
        </div>

        {/* Completed Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Tasks Completed</span>
            <span className="text-gray-600">
              {currentCompleted} / {targets.daily_completed}
            </span>
          </div>
          <Progress value={completedProgress} className={getProgressColor(completedProgress)} />
        </div>
      </CardContent>
    </Card>
  )
}
