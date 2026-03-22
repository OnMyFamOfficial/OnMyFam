import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isAfter,
  isBefore,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarPickerProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
}

export function CalendarPicker({ selected, onSelect, rangeStart, rangeEnd }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function isInRange(day: Date) {
    if (!rangeStart || !rangeEnd) return false;
    return isAfter(day, rangeStart) && isBefore(day, rangeEnd);
  }

  function isRangeStart(day: Date) {
    return rangeStart ? isSameDay(day, rangeStart) : false;
  }

  function isRangeEnd(day: Date) {
    return rangeEnd ? isSameDay(day, rangeEnd) : false;
  }

  return (
    <div className="w-64">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] text-[var(--muted-foreground)] font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isSelected = selected && isSameDay(day, selected);
          const today = isToday(day);
          const inRange = isInRange(day);
          const rStart = isRangeStart(day);
          const rEnd = isRangeEnd(day);
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={cn(
                "w-8 h-8 rounded-md text-xs flex items-center justify-center transition-colors cursor-pointer",
                !inMonth && "text-[var(--muted-foreground)] opacity-40",
                inMonth && !isSelected && !inRange && "hover:bg-[var(--accent)]",
                inRange && !isSelected && "bg-gold-500/20 text-gold-400 rounded-none",
                rStart && !rEnd && "rounded-l-md rounded-r-none",
                rEnd && !rStart && "rounded-r-md rounded-l-none",
                isSelected && "bg-gold-500 text-white font-bold",
                today && !isSelected && !inRange && "border border-gold-500/50 text-gold-500 font-medium"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
