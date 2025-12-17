"use client"

import { usePosts } from '@/hooks/usePosts'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PostCard } from '@/components/PostCard'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Clock, CheckCircle, FileText } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user } = useAuth()
  const { posts, loading } = usePosts()

  const draftCount = posts.filter(p => p.status === 'DRAFT').length
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED').length
  const publishedCount = posts.filter(p => p.status === 'PUBLISHED').length

  const recentPosts = posts.slice(0, 6)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-400">Here&apos;s an overview of your posts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Drafts</CardTitle>
            <FileText className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{draftCount}</div>
            <p className="text-xs text-slate-500 mt-1">Waiting to be scheduled</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-400">Scheduled</CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{scheduledCount}</div>
            <p className="text-xs text-slate-500 mt-1">Ready to publish</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Published</CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{publishedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Live posts</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Recent Posts</h2>
        <Link href="/dashboard/create">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </Link>
      </div>

      {recentPosts.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
            <p className="text-slate-400 mb-4">Create your first post to get started</p>
            <Link href="/dashboard/create">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentPosts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
