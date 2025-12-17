"use client"

import { Post } from '@/lib/types'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, FileText, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatDateInTimezone, getRelativeTime } from '@/lib/timezone-utils'
import { useUserPreferences } from '@/hooks/useUserPreferences'

interface PostCardProps {
  post: Post
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => void
}

const statusConfig = {
  DRAFT: {
    label: 'Draft',
    icon: FileText,
    className: 'bg-slate-700/50 text-slate-300 border-slate-600'
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: Clock,
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  PUBLISHED: {
    label: 'Published',
    icon: CheckCircle,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  }
}

export function PostCard({ post, onEdit, onDelete }: PostCardProps) {
  const { userTimezone } = useUserPreferences()
  const config = statusConfig[post.status]
  const Icon = config.icon
  const canModify = post.status !== 'PUBLISHED'

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <Badge variant="outline" className={cn("gap-1.5", config.className)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
          <span className="text-xs text-slate-500">
            {formatDateInTimezone(post.created_at, userTimezone, { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </span>
        </div>
        
        <p className="text-slate-200 whitespace-pre-wrap line-clamp-4">
          {post.content}
        </p>

        {post.scheduled_at && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Clock className="h-4 w-4" />
            <div className="flex flex-col">
              <span>
                {post.status === 'SCHEDULED' ? 'Scheduled for ' : 'Was scheduled for '}
                {formatDateInTimezone(post.scheduled_at, userTimezone)}
              </span>
              {post.status === 'SCHEDULED' && (
                <span className="text-xs text-slate-500">
                  {getRelativeTime(post.scheduled_at, userTimezone)}
                </span>
              )}
            </div>
          </div>
        )}

        {post.published_at && (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span>Published on {formatDateInTimezone(post.published_at, userTimezone)}</span>
          </div>
        )}
      </CardContent>

      {canModify && (onEdit || onDelete) && (
        <CardFooter className="border-t border-slate-700 pt-4 gap-2">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(post)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(post)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
