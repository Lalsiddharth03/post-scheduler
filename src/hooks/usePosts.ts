import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Post, PostStatus } from '@/lib/types'

export function usePosts(status?: PostStatus) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { token } = useAuth()

  const fetchPosts = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const url = status ? `/api/posts?status=${status}` : '/api/posts'
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPosts(data.posts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }, [token, status])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  async function createPost(
    content: string, 
    postStatus: PostStatus, 
    scheduledAt?: string, 
    userTimezone?: string, 
    originalScheduledTime?: string
  ) {
    if (!token) throw new Error('Not authenticated')
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content,
        status: postStatus,
        scheduled_at: scheduledAt,
        user_timezone: userTimezone,
        original_scheduled_time: originalScheduledTime
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchPosts()
    return data.post
  }

  async function updatePost(
    id: string, 
    content: string, 
    postStatus: PostStatus, 
    scheduledAt?: string, 
    userTimezone?: string, 
    originalScheduledTime?: string
  ) {
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`/api/posts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content,
        status: postStatus,
        scheduled_at: scheduledAt,
        user_timezone: userTimezone,
        original_scheduled_time: originalScheduledTime
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchPosts()
    return data.post
  }

  async function deletePost(id: string) {
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    await fetchPosts()
  }

  return { posts, loading, error, fetchPosts, createPost, updatePost, deletePost }
}
