import { PostRepository } from './post-repository'
import { PublishResult, SchedulerResult } from './types'

export interface PostPublisher {
  publishScheduledPosts(currentTime: string): Promise<PublishResult>
  validatePostForPublishing(post: any): boolean
  updatePostStatus(postId: string, status: string): Promise<boolean>
}

export interface PostPublisherConfig {
  maxBatchSize: number
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

export class PostPublisherImpl implements PostPublisher {
  private repository: PostRepository
  private config: PostPublisherConfig

  constructor(
    repository: PostRepository,
    config: PostPublisherConfig = {
      maxBatchSize: 50,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    }
  ) {
    this.repository = repository
    this.config = config
  }

  /**
   * Publish scheduled posts with batch processing and retry logic
   * Implements batch size limiting to prevent timeouts
   */
  async publishScheduledPosts(currentTime: string): Promise<PublishResult> {
    const result: PublishResult = {
      success: true,
      published_count: 0,
      post_ids: [],
      errors: []
    }

    try {
      // Get all scheduled posts that should be published
      const scheduledPosts = await this.retryOperation(
        () => this.repository.getScheduledPosts(currentTime),
        'fetch scheduled posts'
      )

      if (scheduledPosts.length === 0) {
        return result
      }

      // Process posts in batches to prevent timeouts
      const batches = this.createBatches(scheduledPosts.map(p => p.id), this.config.maxBatchSize)
      
      for (const batch of batches) {
        try {
          const batchResult = await this.processBatch(batch, currentTime)
          
          result.published_count += batchResult.published_count
          result.post_ids.push(...batchResult.post_ids)
          result.errors.push(...batchResult.errors)
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error'
          result.errors.push(`Batch processing failed: ${errorMessage}`)
          result.success = false
        }
      }

    } catch (error) {
      result.success = false
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      result.errors.push(`Publishing failed: ${errorMessage}`)
    }

    return result
  }

  /**
   * Process a single batch of posts with retry logic
   */
  private async processBatch(postIds: string[], publishedAt: string): Promise<PublishResult> {
    const batchResult: PublishResult = {
      success: true,
      published_count: 0,
      post_ids: [],
      errors: []
    }

    try {
      const publishedCount = await this.retryOperation(
        () => this.repository.updatePostsToPublished(postIds, publishedAt),
        `publish batch of ${postIds.length} posts`
      )

      batchResult.published_count = publishedCount
      batchResult.post_ids = postIds.slice(0, publishedCount)

      // If fewer posts were published than expected, some had concurrent modifications
      if (publishedCount < postIds.length) {
        const skippedCount = postIds.length - publishedCount
        batchResult.errors.push(`${skippedCount} posts were skipped due to concurrent modifications`)
      }

    } catch (error) {
      batchResult.success = false
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      batchResult.errors.push(`Batch processing error: ${errorMessage}`)
    }

    return batchResult
  }

  /**
   * Create batches from array of post IDs with size limiting
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }

  /**
   * Retry operation with exponential backoff for database failures
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.config.baseDelayMs * Math.pow(2, attempt),
          this.config.maxDelayMs
        )

        console.warn(
          `${operationName} failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}): ${lastError.message}. Retrying in ${delay}ms...`
        )

        await this.sleep(delay)
      }
    }

    throw new Error(
      `${operationName} failed after ${this.config.maxRetries + 1} attempts. Last error: ${lastError?.message}`
    )
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Validate if a post is ready for publishing
   */
  validatePostForPublishing(post: any): boolean {
    if (!post) return false
    if (post.status !== 'SCHEDULED') return false
    if (!post.scheduled_at) return false
    
    // Check if scheduled time has passed
    const scheduledTime = new Date(post.scheduled_at)
    const now = new Date()
    
    return scheduledTime <= now
  }

  /**
   * Update individual post status (for compatibility)
   */
  async updatePostStatus(postId: string, status: string): Promise<boolean> {
    try {
      const publishedAt = status === 'PUBLISHED' ? new Date().toISOString() : null
      
      await this.retryOperation(
        () => this.repository.updatePost(postId, { 
          status: status as any,
          published_at: publishedAt 
        }),
        `update post ${postId} status to ${status}`
      )
      
      return true
    } catch (error) {
      console.error(`Failed to update post ${postId} status:`, error)
      return false
    }
  }
}