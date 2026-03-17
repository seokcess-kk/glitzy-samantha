'use client'

import { useState } from 'react'
import { format, subDays, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
}

const PRESETS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '14일', days: 14 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
]

export function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const handlePreset = (days: number) => {
    const to = startOfDay(new Date())
    const from = days === 0 ? to : subDays(to, days)
    onDateRangeChange({ from, to })
    setOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onDateRangeChange({ from: range.from, to: range.to || range.from })
    }
  }

  const displayLabel = () => {
    if (!dateRange.from) return '기간 선택'
    const from = dateRange.from
    const to = dateRange.to || from

    // 같은 날이면 "당일" 표시
    if (from.getTime() === to.getTime()) {
      return format(from, 'M월 d일 (eee)', { locale: ko })
    }
    return `${format(from, 'M/d')} - ${format(to, 'M/d')}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 px-3 bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 gap-2"
        >
          <CalendarIcon size={14} className="text-slate-400" />
          <span className="tabular-nums">{displayLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="end">
        {/* 프리셋 버튼 */}
        <div className="flex gap-1 p-3 pb-0">
          {PRESETS.map(p => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/10"
              onClick={() => handlePreset(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleCalendarSelect}
          numberOfMonths={1}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  )
}
