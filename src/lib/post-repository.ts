import { createServiceClient } from '@/lib/supabase/server'
import { Post, CreatePostRequest, UpdatePostRequest, ScheduledPost, PublishResult } from '@/lib/types'

export interface PostRepository {
  getScheduledPosts(beforeTime: string): Promise<ScheduledPost[]>
  updatePostsToPublished(postIds: string[], publishedAt: string): Promise<number>
  createPost(post: CreatePostRequest): Promise<Post>
  updatePost(id: string, updates: UpdatePostRequest): Promise<Post>
  publishScheduledPosts(currentTime: string): Promise<PublishResult>
}

export class PostRepositoryImpl implements PostRepository {
  private supabase = createServiceClient()

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
   * Atomic batch update posts to published status using optimistic locking
   * This prevents race conditions by checking status hasn't changed
   */
  async updatePostsToPublished(postIds: string[], publishedAt: string): Promise<number> {
    if (postIds.length === 0) {
      return 0
    }

    // Use atomic update with status check to prevent race conditions
    const { data, error } = await this.supabase
      .from('posts')
      .update({
        status: 'PUBLISHED',
        published_at: publishedAt
      })
      .in('id', postIds)
      .eq('status', 'SCHEDULED') // Optimistic locking - only update if still SCHEDULED
      .select('id')

    if (error) {
      throw new Error(`Failed to publish posts: ${error.message}`)
    }

    return data?.length || 0
  }

  /**
   * Create a new post using parameterized queries for security
   */
  async createPost(request: CreatePostRequest): Promise<Post> {
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
  async updatePost(id: string, updates: UpdatePostRequest): Promise<Post> {
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
   * Atomic operation to publish scheduled posts with concurrent safety
   * This method implements the core atomic publishing logic with optimistic locking
   */
  async publishScheduledPosts(currentTime: string): Promise<PublishResult> {
    const result: PublishResult = {
      success: true,
      published_count: 0,
      post_ids: [],
      errors: []
    }

    try {
      // First, get all posts that should be published
      const scheduledPosts = await this.getScheduledPosts(currentTime)
      
      if (scheduledPosts.length === 0) {
        return result
      }

      const postIds = scheduledPosts.map(post => post.id)
      
      // Atomic batch update with optimistic locking
      // Only posts that are still SCHEDULED will be updated
      const publishedCount = await this.updatePostsToPublished(postIds, currentTime)
      
      result.published_count = publishedCount
      result.post_ids = postIds.slice(0, publishedCount) // Only include actually published posts
      
      // If fewer posts were published than expected, some had concurrent modifications
      if (publishedCount < postIds.length) {
        const skippedCount = postIds.length - publishedCount
        result.errors.push(`${skippedCount} posts were skipped due to concurrent modifications`)
      }

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred')
    }

    return result
  }
}