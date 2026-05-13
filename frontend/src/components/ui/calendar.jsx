import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:        "flex flex-col",
        month:         "space-y-3",
        caption:       "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold text-foreground",
        nav:           "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 text-muted-foreground hover:text-foreground",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next:     "absolute right-1",
        table:    "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground flex-1 font-medium text-[10px] text-center py-1",
        row:  "flex w-full mt-0.5",
        cell: cn(
          "relative flex h-9 flex-1 items-center justify-center p-0 text-sm focus-within:relative focus-within:z-20",
          // range stripe on the cell background
          "[&:has([aria-selected])]:bg-primary/10",
          "[&:has([aria-selected].day-outside)]:bg-primary/5",
          // round the leftmost / rightmost edge of the range stripe
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          // range-end rounds only the right side
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          // range-start rounds only the left side
          "[&:has([aria-selected].day-range-start)]:rounded-l-full",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground hover:!bg-primary hover:!text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground hover:!bg-primary hover:!text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today:    "font-bold text-primary ring-1 ring-primary/30 ring-offset-0",
        day_outside:
          "day-outside text-muted-foreground/30 aria-selected:bg-primary/5 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground/30 pointer-events-none",
        day_range_middle:
          "aria-selected:bg-transparent aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft:  () => <ChevronLeft  className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
