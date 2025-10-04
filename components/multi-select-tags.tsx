// This component implements a reusable multi-select dropdown using Shadcn components
// such as Popover, Command, Checkbox, and Badge.

"use client"

import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { cn } from "@/lib/utils" // Assuming a utility function for conditional classes
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Define the shape for an item in the multi-select
interface SelectItem {
  value: string
  label: string
}

interface MultiSelectTagsProps {
  options: SelectItem[] // All available options
  selected: string[] // Currently selected values (string array of tags)
  onChange: (selectedValues: string[]) => void // Handler for when selection changes
  placeholder?: string
  className?: string
}

export function MultiSelectTags({
  options,
  selected,
  onChange,
  placeholder = "Select tags...",
  className,
}: MultiSelectTagsProps) {
  const [open, setOpen] = React.useState(false)

  // Remove a single value from the selection array
  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value))
  }

  // Toggle selection status for a value
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      handleRemove(value)
    } else {
      onChange([...selected, value])
    }
  }

  // Render the selected tags as badges inside the button trigger
  const renderBadges = () => {
    if (selected.length === 0) {
      return <span className="text-sm text-muted-foreground">{placeholder}</span>
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((value) => {
          const item = options.find((o) => o.value === value)
          return (
            <Badge
              key={value}
              variant="secondary"
              className="py-1 px-2 pr-1 rounded-full text-xs font-normal transition-colors hover:bg-red-100 dark:hover:bg-red-800"
              onClick={(e) => {
                e.stopPropagation() // Prevent the popover from closing
                handleRemove(value)
              }}
            >
              {item ? item.label : value}
              <X className="ml-1 h-3 w-3 cursor-pointer opacity-80" />
            </Badge>
          )
        })}
        {/* Adds a little space if tags are present */}
        <span className="sr-only">{selected.length} tags selected</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[40px] px-3 py-1",
            className
          )}
        >
          <div className="flex-1 overflow-hidden">{renderBadges()}</div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleToggle(option.value)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// NOTE: You must also create a simple utility file at "@/lib/utils.ts" 
// with the following content for the `cn` function to work:
/*
  // utils.ts or lib/utils.ts
  import { type ClassValue, clsx } from "clsx"
  import { twMerge } from "tailwind-merge"

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
*/
