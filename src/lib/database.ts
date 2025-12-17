import { createServiceClient } from '@/lib/supabase/server'
import { Post, CreatePostRequest, UpdatePostRequest, ScheduledPost } from '@/lib/types'

export class DatabaseService {
  private supabase = createServiceClient()

  /**
   * Create a new post using parameterized queries for security
   */
  async createPost(request: CreatePostRequest): Promise<Post | null> {
    const { data, error } = await this.supabase
      .from('posts')
      .insert({
        content: request.content,
        status: request.status,
        scheduled_at: request.scheduled_at,
        user_timezone: request.user_timezone,
        original_scheduled_time: request.original_scheduled_time
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create post: ${error.message}`)
    }

    return data
  }

  /**
   * Update a post using parameterized queries for security
   */
  async updatePost(id: string, updates: UpdatePostRequest): Promise<Post | null> {
    const { data, error } = await this.supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update post: ${error.message}`)
    }

    return data
  }

  /**
   * Get scheduled posts using parameterized queries for security
   */
  async getScheduledPosts(beforeTime: string): Promise<ScheduledPost[]> {
    const { data, error } = await this.supabase
      .from('posts')
      .select('*')
      .eq('status', 'SCHEDULED')
      .lte('scheduled_at', beforeTime)
      .order('scheduled_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch scheduled posts: ${error.message}`)
    }

    return data as ScheduledPost[]
  }

  /**
   * Batch update posts to published status using parameterized queries
   */
  async updatePostsToPublished(postIds: string[], publishedAt: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('posts')
      .update({
        status: 'PUBLISHED',
        published_at: publishedAt
      })
      .in('id', postIds)
      .eq('status', 'SCHEDULED') // Double-check status hasn't changed
      .select('id')

    if (error) {
      throw new Error(`Failed to publish posts: ${error.message}`)
    }

    return data?.length || 0
  }

  /**
   * Search posts by content using parameterized queries for security
   * This method demonstrates proper handling of user input in search queries
   */
  async searchPosts(searchTerm: string, userId?: string): Promise<Post[]> {
    let query = this.supabase
      .from('posts')
      .select('*')
      .ilike('content', `%${searchTerm}%`)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to search posts: ${error.message}`)
    }

    return data || []
  }
}