"use client"

import { usePosts } from '@/hooks/usePosts'
import { PostCard } from '@/components/PostCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Plus, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function PublishedPostsPage() {
  const { posts, loading } = usePosts('PUBLISHED')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Published Posts</h1>
          <p className="text-slate-400">Your posts that have been published</p>
        </div>
        <Link href="/dashboard/create">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No published posts yet</h3>
            <p className="text-slate-400 mb-4">Schedule posts and they&apos;ll appear here once published</p>
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
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
