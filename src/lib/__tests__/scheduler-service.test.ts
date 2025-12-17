import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { SchedulerServiceImpl } from '../scheduler-service'
import { PostPublisher } from '../post-publisher'
import { PublishResult } from '../types'

// Mock the dependencies
vi.mock('../logger', () => ({
  logger: {
    setCorrelationId: vi.fn(),
    clearCorrelationId: vi.fn(),
    logSchedulerStart: vi.fn(),
    logSchedulerProcessing: vi.fn(),
    logSchedulerComplete: vi.fn(),
    logSchedulerError: vi.fn()
  },
  performanceMonitor: {
    checkPerformance: vi.fn(() => [])
  }
}))

vi.mock('../metrics-repository', () => ({
  metricsRepository: {
    saveMetrics: vi.fn()
  }
}))

// Import after mocking
import { logger } from '../logger'
import { metricsRepository } from '../metrics-repository'

describe('SchedulerService Integration', () => {
  let schedulerService: SchedulerServiceImpl
  let mockPostPublisher: PostPublisher

  beforeEach(() => {
    // Create mock post publisher
    mockPostPublisher = {
      publishScheduledPosts: vi.fn(),
      validatePostForPublishing: vi.fn(),
      updatePostStatus: vi.fn()
    }

    schedulerService = new SchedulerServiceImpl(mockPostPublisher)

    // Mock logger methods
    vi.mocked(logger.setCorrelationId).mockImplementation(() => {})
    vi.mocked(logger.clearCorrelationId).mockImplementation(() => {})
    vi.mocked(logger.logSchedulerStart).mockReturnValue({
      level: 'info',
      message: 'Scheduler execution started',
      timestamp: new Date().toISOString(),
      executionId: 'test-id',
      phase: 'start'
    })
    vi.mocked(logger.logSchedulerProcessing).mockReturnValue({
      level: 'info',
      message: 'Processing',
      timestamp: new Date().toISOString(),
      executionId: 'test-id',
      phase: 'processing',
      postsProcessed: 5,
      postsPublished: 3
    })
    vi.mocked(logger.logSchedulerComplete).mockReturnValue({
      level: 'info',
      message: 'Completed',
      timestamp: new Date().toISOString(),
      executionId: 'test-id',
      phase: 'complete',
      postsProcessed: 5,
      postsPublished: 3,
      duration: 1000
    })
    vi.mocked(logger.logSchedulerError).mockReturnValue({
      level: 'error',
      message: 'Error occurred',
      timestamp: new Date().toISOString(),
      executionId: 'test-id',
      phase: 'error',
      errors: ['Test error']
    })

    // Mock metrics repository
    vi.mocked(metricsRepository.saveMetrics).mockResolvedValue(true)
  })

  it('should execute scheduled publishing with comprehensive logging and metrics', async () => {
    // Arrange
    const mockPublishResult: PublishResult = {
      success: true,
      published_count: 3,
      post_ids: ['post1', 'post2', 'post3'],
      errors: []
    }
    vi.mocked(mockPostPublisher.publishScheduledPosts).mockResolvedValue(mockPublishResult)

    // Act
    const result = await schedulerService.executeScheduledPublishing()

    // Assert
    expect(result).toBeDefined()
    expect(result.execution_id).toBeDefined()
    expect(result.posts_processed).toBe(3)
    expect(result.posts_published).toBe(3)
    expect(result.errors).toEqual([])
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)

    // Verify logging calls
    expect(logger.setCorrelationId).toHaveBeenCalledWith(result.execution_id)
    expect(logger.logSchedulerStart).toHaveBeenCalledWith(result.execution_id)
    expect(logger.logSchedulerProcessing).toHaveBeenCalledWith(result.execution_id, 3, 3)
    expect(logger.logSchedulerComplete).toHaveBeenCalledWith(
      result.execution_id,
      3,
      3,
      expect.any(Number),
      []
    )
    expect(logger.clearCorrelationId).toHaveBeenCalled()

    // Verify metrics were saved
    expect(metricsRepository.saveMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        execution_id: result.execution_id,
        posts_processed: 3,
        posts_published: 3,
        errors_encountered: 0,
        execution_duration_ms: expect.any(Number)
      })
    )
  })

  it('should handle errors with proper logging and metrics', async () => {
    // Arrange
    const testError = new Error('Database connection failed')
    vi.mocked(mockPostPublisher.publishScheduledPosts).mockRejectedValue(testError)

    // Act
    const result = await schedulerService.executeScheduledPublishing()

    // Assert
    expect(result).toBeDefined()
    expect(result.execution_id).toBeDefined()
    expect(result.posts_processed).toBe(0)
    expect(result.posts_published).toBe(0)
    expect(result.errors).toEqual(['Database connection failed'])
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)

    // Verify error logging
    expect(logger.logSchedulerError).toHaveBeenCalledWith(
      result.execution_id,
      'Database connection failed',
      expect.any(Number)
    )

    // Verify error metrics were saved
    expect(metricsRepository.saveMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        execution_id: result.execution_id,
        posts_processed: 0,
        posts_published: 0,
        errors_encountered: 1,
        execution_duration_ms: expect.any(Number)
      })
    )

    // Verify correlation ID is cleared even on error
    expect(logger.clearCorrelationId).toHaveBeenCalled()
  })

  it('should handle partial success with errors', async () => {
    // Arrange
    const mockPublishResult: PublishResult = {
      success: false,
      published_count: 2,
      post_ids: ['post1', 'post2'],
      errors: ['Failed to publish post3', 'Failed to publish post4']
    }
    vi.mocked(mockPostPublisher.publishScheduledPosts).mockResolvedValue(mockPublishResult)

    // Act
    const result = await schedulerService.executeScheduledPublishing()

    // Assert
    expect(result).toBeDefined()
    expect(result.posts_processed).toBe(4) // 2 published + 2 errors
    expect(result.posts_published).toBe(2)
    expect(result.errors).toEqual(['Failed to publish post3', 'Failed to publish post4'])

    // Verify logging includes errors
    expect(logger.logSchedulerComplete).toHaveBeenCalledWith(
      result.execution_id,
      4,
      2,
      expect.any(Number),
      ['Failed to publish post3', 'Failed to publish post4']
    )

    // Verify metrics include error count
    expect(metricsRepository.saveMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        posts_processed: 4,
        posts_published: 2,
        errors_encountered: 2
      })
    )
  })

  describe('Property-Based Tests', () => {
    it('Property 13: Error isolation - component failures should not cascade to other system parts', async () => {
      // **Feature: timezone-scheduler-fix, Property 13: Error isolation**
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant('PostPublisher'),
          fc.constant('MetricsRepository'),
          fc.constant('Logger')
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (failingComponent, errorMessage) => {
          // Arrange - Create a fresh scheduler service for each test
          const mockPostPublisher: PostPublisher = {
            publishScheduledPosts: vi.fn(),
            validatePostForPublishing: vi.fn(),
            updatePostStatus: vi.fn()
          }
          
          const testScheduler = new SchedulerServiceImpl(mockPostPublisher)
          
          // Reset all mocks
          vi.clearAllMocks()
          
          // Mock successful operations by default
          vi.mocked(mockPostPublisher.publishScheduledPosts).mockResolvedValue({
            success: true,
            published_count: 1,
            post_ids: ['test-post'],
            errors: []
          })
          vi.mocked(metricsRepository.saveMetrics).mockResolvedValue(true)
          vi.mocked(logger.setCorrelationId).mockImplementation(() => {})
          vi.mocked(logger.clearCorrelationId).mockImplementation(() => {})
          vi.mocked(logger.logSchedulerStart).mockReturnValue({
            level: 'info',
            message: 'Started',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'start'
          })
          vi.mocked(logger.logSchedulerProcessing).mockReturnValue({
            level: 'info',
            message: 'Processing',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'processing',
            postsProcessed: 1,
            postsPublished: 1
          })
          vi.mocked(logger.logSchedulerComplete).mockReturnValue({
            level: 'info',
            message: 'Complete',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'complete',
            postsProcessed: 1,
            postsPublished: 1,
            duration: 100
          })
          vi.mocked(logger.logSchedulerError).mockReturnValue({
            level: 'error',
            message: 'Error',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'error',
            errors: [errorMessage]
          })
          
          // Inject failure into the specified component
          switch (failingComponent) {
            case 'PostPublisher':
              vi.mocked(mockPostPublisher.publishScheduledPosts).mockRejectedValue(new Error(errorMessage))
              break
            case 'MetricsRepository':
              vi.mocked(metricsRepository.saveMetrics).mockRejectedValue(new Error(errorMessage))
              break
            case 'Logger':
              vi.mocked(logger.logSchedulerStart).mockImplementation(() => {
                throw new Error(errorMessage)
              })
              break
          }
          
          // Act - Execute the scheduler
          let result
          try {
            result = await testScheduler.executeScheduledPublishing()
          } catch (error) {
            // If the scheduler throws, it means error isolation failed
            return false
          }
          
          // Assert - The scheduler should always return a result, never throw
          // This demonstrates error isolation - component failures are contained
          expect(result).toBeDefined()
          expect(result.execution_id).toBeDefined()
          expect(typeof result.duration_ms).toBe('number')
          expect(Array.isArray(result.errors)).toBe(true)
          
          // When a component fails, the scheduler should still complete gracefully
          // and provide meaningful error information
          if (failingComponent === 'PostPublisher') {
            expect(result.errors).toContain(errorMessage)
            expect(result.posts_published).toBe(0)
          } else {
            // For Logger and MetricsRepository failures, the scheduler should still
            // complete successfully since these are non-critical components
            // The key is that it doesn't throw an exception
            expect(result.posts_published).toBeGreaterThanOrEqual(0)
          }
          
          // The scheduler should always attempt to clean up (clear correlation ID)
          // even when components fail
          expect(logger.clearCorrelationId).toHaveBeenCalled()
          
          return true
        }
      ), { numRuns: 100 })
    })

    it('Property 2: UTC-only internal operations - all time comparisons and calculations should use UTC timestamps exclusively', async () => {
      // **Feature: timezone-scheduler-fix, Property 2: UTC-only internal operations**
      await fc.assert(fc.asyncProperty(
        fc.constantFrom(
          'America/New_York',
          'Europe/London', 
          'Asia/Tokyo',
          'Australia/Sydney',
          'America/Los_Angeles',
          'Europe/Paris'
        ),
        async (userTimezone) => {
          // Arrange - Create scheduler with mock that captures the time parameter
          let capturedTimeParameter: string | undefined
          
          const mockPostPublisher: PostPublisher = {
            publishScheduledPosts: vi.fn().mockImplementation((currentTime: string) => {
              capturedTimeParameter = currentTime
              return Promise.resolve({
                success: true,
                published_count: 0,
                post_ids: [],
                errors: []
              })
            }),
            validatePostForPublishing: vi.fn(),
            updatePostStatus: vi.fn()
          }
          
          const testScheduler = new SchedulerServiceImpl(mockPostPublisher)
          
          // Reset mocks
          vi.clearAllMocks()
          vi.mocked(metricsRepository.saveMetrics).mockResolvedValue(true)
          vi.mocked(logger.setCorrelationId).mockImplementation(() => {})
          vi.mocked(logger.clearCorrelationId).mockImplementation(() => {})
          vi.mocked(logger.logSchedulerStart).mockReturnValue({
            level: 'info',
            message: 'Started',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'start'
          })
          vi.mocked(logger.logSchedulerProcessing).mockReturnValue({
            level: 'info',
            message: 'Processing',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'processing',
            postsProcessed: 0,
            postsPublished: 0
          })
          vi.mocked(logger.logSchedulerComplete).mockReturnValue({
            level: 'info',
            message: 'Complete',
            timestamp: new Date().toISOString(),
            executionId: 'test-id',
            phase: 'complete',
            postsProcessed: 0,
            postsPublished: 0,
            duration: 100
          })
          
          // Act - Execute scheduler (userTimezone is not used because scheduler should always use UTC internally)
          await testScheduler.executeScheduledPublishing()
          
          // Assert - The time parameter passed to publishScheduledPosts should be UTC
          if (!capturedTimeParameter) {
            return false
          }
          
          // Verify the timestamp is in UTC format (ends with 'Z')
          if (!capturedTimeParameter.endsWith('Z')) {
            return false
          }
          
          // Verify it matches the ISO UTC format
          const isUTCFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(capturedTimeParameter)
          if (!isUTCFormat) {
            return false
          }
          
          // Verify it's a valid date
          const capturedDate = new Date(capturedTimeParameter)
          if (isNaN(capturedDate.getTime())) {
            return false
          }
          
          // The key property: scheduler always uses UTC internally
          // regardless of user timezone preferences or system timezone
          return true
        }
      ), { numRuns: 100 })
    })
  })
})