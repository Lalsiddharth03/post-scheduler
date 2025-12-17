"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePosts } from '@/hooks/usePosts'
import { PostCard } from '@/components/PostCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Post } from '@/lib/types'

export default function DraftsPage() {
  const { posts, loading, deletePost } = usePosts('DRAFT')
  const [deleteDialog, setDeleteDialog] = useState<Post | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!deleteDialog) return
    setDeleting(true)
    try {
      await deletePost(deleteDialog.id)
      toast.success('Draft deleted')
      setDeleteDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit(post: Post) {
    router.push(`/dashboard/edit/${post.id}`)
  }

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
          <h1 className="text-3xl font-bold text-white mb-2">Drafts</h1>
          <p className="text-slate-400">Posts saved for later</p>
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
            <FileText className="h-12 w-12 text-slate-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No drafts</h3>
            <p className="text-slate-400 mb-4">Save posts as drafts to edit them later</p>
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
            <PostCard
              key={post.id}
              post={post}
              onEdit={handleEdit}
              onDelete={setDeleteDialog}
            />
          ))}
        </div>
      )}

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Draft</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this draft? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(null)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
