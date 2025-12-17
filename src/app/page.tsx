"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
      
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Post Scheduler</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Schedule your posts,{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              automate publishing
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10">
            Create, schedule, and automatically publish your content at the perfect time. 
            Never miss a posting deadline again.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-lg px-8">
                Start Scheduling
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-slate-600 transition-colors">
            <div className="p-3 rounded-xl bg-cyan-500/10 w-fit mb-6">
              <Calendar className="h-8 w-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Create Posts</h3>
            <p className="text-slate-400">
              Write and save your content as drafts or schedule them for future publishing.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-slate-600 transition-colors">
            <div className="p-3 rounded-xl bg-amber-500/10 w-fit mb-6">
              <Clock className="h-8 w-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Schedule Ahead</h3>
            <p className="text-slate-400">
              Set the exact date and time for your posts to go live automatically.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-slate-600 transition-colors">
            <div className="p-3 rounded-xl bg-emerald-500/10 w-fit mb-6">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Auto Publish</h3>
            <p className="text-slate-400">
              Our scheduler automatically publishes your posts at the scheduled time.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-8 text-center text-slate-500 text-sm">
          Post Scheduler - Schedule and publish your content automatically
        </div>
      </footer>
    </div>
  )
}
