import { SchedulerResult, SchedulerMetrics } from './types'
import { PostPublisher, PostPublisherImpl } from './post-publisher'
import { PostRepositoryImpl } from './post-repository'
import { logger, performanceMonitor } from './logger'
import { metricsRepository } from './metrics-repository'
import { v4 as uuidv4 } from 'uuid'

export interface SchedulerService {
  executeScheduledPublishing(): Promise<SchedulerResult>
}

export class SchedulerServiceImpl implements SchedulerService {
  private postPublisher: PostPublisher

  constructor(postPublisher: PostPublisher) {
    this.postPublisher = postPublisher
  }

  async executeScheduledPublishing(): Promise<SchedulerResult> {
    const executionId = uuidv4()
    const startTime = new Date()
    
    // Set correlation ID for all logs in this execution - with error isolation
    try {
      logger.setCorrelationId(executionId)
    } catch (error) {
      // Logger error should not prevent scheduler execution
      console.error('Logger setCorrelationId failed:', error)
    }
    
    try {
      // Log scheduler start - with error isolation
      try {
        logger.logSchedulerStart(executionId)
      } catch (error) {
        // Logger error should not prevent scheduler execution
        console.error('Logger logSchedulerStart failed:', error)
      }
      
      const currentTime = new Date().toISOString()
      
      // Execute the publishing
      const publishResult = await this.postPublisher.publishScheduledPosts(currentTime)
      
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      
      // Log processing results - with error isolation
      try {
        logger.logSchedulerProcessing(
          executionId,
          publishResult.post_ids.length + publishResult.errors.length,
          publishResult.published_count
        )
      } catch (error) {
        // Logger error should not prevent scheduler execution
        console.error('Logger logSchedulerProcessing failed:', error)
      }
      
      // Create scheduler metrics
      const metrics: SchedulerMetrics = {
        execution_id: executionId,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        posts_processed: publishResult.post_ids.length + publishResult.errors.length,
        posts_published: publishResult.published_count,
        errors_encountered: publishResult.errors.length,
        execution_duration_ms: duration
      }
      
      // Save metrics to database - with error isolation
      try {
        await metricsRepository.saveMetrics(metrics)
      } catch (error) {
        // Metrics error should not prevent scheduler execution
        console.error('MetricsRepository saveMetrics failed:', error)
      }
      
      // Check performance and generate alerts if needed - with error isolation
      try {
        const alerts = performanceMonitor.checkPerformance(metrics)
        alerts.forEach(alert => performanceMonitor.logPerformanceAlert(alert))
      } catch (error) {
        // Performance monitoring error should not prevent scheduler execution
        console.error('Performance monitoring failed:', error)
      }
      
      // Log completion - with error isolation
      try {
        logger.logSchedulerComplete(
          executionId,
          metrics.posts_processed,
          metrics.posts_published,
          duration,
          publishResult.errors
        )
      } catch (error) {
        // Logger error should not prevent scheduler execution
        console.error('Logger logSchedulerComplete failed:', error)
      }
      
      // Create result
      const result: SchedulerResult = {
        execution_id: executionId,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        posts_processed: metrics.posts_processed,
        posts_published: metrics.posts_published,
        errors: publishResult.errors,
        duration_ms: duration
      }
      
      return result
      
    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log error - with error isolation
      try {
        logger.logSchedulerError(executionId, errorMessage, duration)
      } catch (logError) {
        // Logger error should not prevent error handling
        console.error('Logger logSchedulerError failed:', logError)
      }
      
      // Create error metrics
      const errorMetrics: SchedulerMetrics = {
        execution_id: executionId,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        posts_processed: 0,
        posts_published: 0,
        errors_encountered: 1,
        execution_duration_ms: duration
      }
      
      // Save error metrics - with error isolation
      try {
        await metricsRepository.saveMetrics(errorMetrics)
      } catch (metricsError) {
        // Metrics error should not prevent error handling
        console.error('MetricsRepository saveMetrics failed during error handling:', metricsError)
      }
      
      // Create error result
      const result: SchedulerResult = {
        execution_id: executionId,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        posts_processed: 0,
        posts_published: 0,
        errors: [errorMessage],
        duration_ms: duration
      }
      
      return result
      
    } finally {
      // Clear correlation ID - with error isolation
      try {
        logger.clearCorrelationId()
      } catch (error) {
        // Logger error should not prevent cleanup
        console.error('Logger clearCorrelationId failed:', error)
      }
    }
  }
}

// Factory function to create scheduler service with dependencies
export function createSchedulerService(): SchedulerService {
  const postRepository = new PostRepositoryImpl()
  const postPublisher = new PostPublisherImpl(postRepository)
  return new SchedulerServiceImpl(postPublisher)
}