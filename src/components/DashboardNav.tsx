"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Clock, CheckCircle, LayoutDashboard, LogOut, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/create', label: 'Create Post', icon: Plus },
  { href: '/dashboard/scheduled', label: 'Scheduled', icon: Clock },
  { href: '/dashboard/published', label: 'Published', icon: CheckCircle },
  { href: '/dashboard/drafts', label: 'Drafts', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function DashboardNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Post Scheduler</span>
        </Link>
      </div>

      <div className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="px-4 py-3 mb-3">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
        <Button
          onClick={logout}
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </nav>
  )
}
