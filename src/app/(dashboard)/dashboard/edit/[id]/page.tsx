"use client"

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, CalendarIcon, FileText, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Post, PostStatus } from '@/lib/types'
import { TimezoneSelector } from '@/components/TimezoneSelector'
import { convertLocalToUTC, convertUTCToLocal } from '@/lib/timezone-utils'

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [post, setPost] = useState<Post | null>(null)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'SCHEDULED'>('DRAFT')
  const [date, setDate] = useState<Date | undefined>()
  const [time, setTime] = useState('12:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { token } = useAuth()
  const { userTimezone, updateTimezone } = useUserPreferences()
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone)
  const router = useRouter()

  // Update selected timezone when user preference changes
  useEffect(() => {
    setSelectedTimezone(userTimezone)
  }, [userTimezone])

  useEffect(() => {
    async function fetchPost() {
      if (!token) return
      try {
        const res = await fetch(`/api/posts/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        
        setPost(data.post)
        setContent(data.post.content)
        setStatus(data.post.status === 'PUBLISHED' ? 'DRAFT' : data.post.status)
        
        if (data.post.scheduled_at) {
          // Convert UTC time to user's timezone for editing
          const userTimezoneForPost = data.post.user_timezone || userTimezone
          const localTime = convertUTCToLocal(data.post.scheduled_at, userTimezoneForPost)
          const scheduledDate = new Date(localTime)
          setDate(scheduledDate)
          setTime(format(scheduledDate, 'HH:mm'))
          setSelectedTimezone(userTimezoneForPost)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load post')
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [id, token, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!content.trim()) {
      toast.error('Please enter some content')
      return
    }

    if (status === 'SCHEDULED' && !date) {
      toast.error('Please select a scheduled date')
      return
    }

    setSaving(true)
    try {
      let scheduledAt: string | undefined
      let userTimezoneForPost: string | undefined
      let originalScheduledTime: string | undefined

      if (status === 'SCHEDULED' && date) {
        const [hours, minutes] = time.split(':').map(Number)
        const scheduledDate = new Date(date)
        scheduledDate.setHours(hours, minutes, 0, 0)
        
        // Store the original time as entered by user
        originalScheduledTime = scheduledDate.toISOString().slice(0, 19)
        
        // Convert to UTC for storage
        scheduledAt = convertLocalToUTC(originalScheduledTime, selectedTimezone)
        userTimezoneForPost = selectedTimezone
        
        // Update user's timezone preference if it changed
        if (selectedTimezone !== userTimezone) {
          await updateTimezone(selectedTimezone)
        }
      }

      const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          status: status as PostStatus,
          scheduled_at: scheduledAt,
          user_timezone: userTimezoneForPost,
          original_scheduled_time: originalScheduledTime
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Post updated!')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Edit Post</h1>
        <p className="text-slate-400">Update your post content and schedule</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Content</CardTitle>
            <CardDescription className="text-slate-400">Edit your post content</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="min-h-[200px] bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500"
            />
            <p className="text-xs text-slate-500 mt-2">{content.length} characters</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Post Type</CardTitle>
            <CardDescription className="text-slate-400">Choose how to save your post</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as 'DRAFT' | 'SCHEDULED')}>
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer">
                <RadioGroupItem value="DRAFT" id="draft" className="border-slate-500 text-cyan-500" />
                <Label htmlFor="draft" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-white">Save as Draft</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Save for later editing</p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer mt-3">
                <RadioGroupItem value="SCHEDULED" id="scheduled" className="border-slate-500 text-cyan-500" />
                <Label htmlFor="scheduled" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="font-medium text-white">Schedule for Later</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Automatically publish at a specific time</p>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {status === 'SCHEDULED' && (
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Schedule Time</CardTitle>
              <CardDescription className="text-slate-400">When should this post be published?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-slate-900/50 border-slate-600 text-white hover:bg-slate-800",
                        !date && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Time</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-cyan-500"
                />
              </div>
              <TimezoneSelector
                value={selectedTimezone}
                onValueChange={setSelectedTimezone}
                label="Timezone"
              />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
