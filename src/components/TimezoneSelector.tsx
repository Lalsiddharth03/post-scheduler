"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface TimezoneSelectorProps {
  value: string
  onValueChange: (timezone: string) => void
  label?: string
  className?: string
}

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
  { value: 'America/Mexico_City', label: 'Central Time (Mexico City)' },
  { value: 'America/Sao_Paulo', label: 'Brasília Time (São Paulo)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina Time (Buenos Aires)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)' },
  { value: 'Europe/Rome', label: 'Central European Time (Rome)' },
  { value: 'Europe/Madrid', label: 'Central European Time (Madrid)' },
  { value: 'Europe/Amsterdam', label: 'Central European Time (Amsterdam)' },
  { value: 'Europe/Stockholm', label: 'Central European Time (Stockholm)' },
  { value: 'Europe/Moscow', label: 'Moscow Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time' },
  { value: 'Asia/Singapore', label: 'Singapore Time' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (Seoul)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (Kolkata)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai)' },
  { value: 'Asia/Bangkok', label: 'Indochina Time (Bangkok)' },
  { value: 'Asia/Jakarta', label: 'Western Indonesia Time (Jakarta)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (Melbourne)' },
  { value: 'Australia/Perth', label: 'Australian Western Time (Perth)' },
  { value: 'Pacific/Auckland', label: 'New Zealand Time (Auckland)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Standard Time (Honolulu)' },
  { value: 'Africa/Cairo', label: 'Eastern European Time (Cairo)' },
  { value: 'Africa/Johannesburg', label: 'South Africa Standard Time (Johannesburg)' }
]

export function TimezoneSelector({ value, onValueChange, label = "Timezone", className }: TimezoneSelectorProps) {
  return (
    <div className={className}>
      <Label className="text-slate-300 mb-2 block">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white focus:border-cyan-500">
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
          {COMMON_TIMEZONES.map((timezone) => (
            <SelectItem 
              key={timezone.value} 
              value={timezone.value}
              className="text-white hover:bg-slate-700 focus:bg-slate-700"
            >
              {timezone.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}