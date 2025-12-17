import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { Logger, PerformanceMonitor } from '../logger'
import { SchedulerMetrics } from '../types'

describe('Logger Properties', () => {
  let logger: Logger
  let performanceMonitor: PerformanceMonitor

  beforeEach(() => {
    logger = new Logger()
    performanceMonitor = new PerformanceMonitor(logger)
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  // **Feature: timezone-scheduler-fix, Property 8: Comprehensive scheduler logging**
  // **Validates: Requirements 3.1, 3.2, 3.3**
  it('Property 8: Comprehensive scheduler logging', () => {
    // Generate valid execution IDs
    const executionIds = fc.string({ minLength: 1, maxLength: 50 })

    // Generate valid post counts
    const postCounts = fc.integer({ min: 0, max: 1000 })

    // Generate valid durations (in milliseconds)
    const durations = fc.integer({ min: 0, max: 300000 }) // 0 to 5 minutes

    // Generate error arrays
    const errorArrays = fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 10 })

    fc.assert(
      fc.property(
        executionIds,
        postCounts,
        postCounts,
        durations,
        errorArrays,
        (executionId, postsProcessed, postsPublished, duration, errors) => {
          // Ensure postsPublished <= postsProcessed
          const actualPostsPublished = Math.min(postsPublished, postsProcessed)

          // Test scheduler start logging
          const startEntry = logger.logSchedulerStart(executionId)
          
          // Should contain required fields for start phase
          if (!startEntry.executionId || startEntry.executionId !== executionId) return false
          if (startEntry.phase !== 'start') return false
          if (startEntry.level !== 'info') return false
          if (!startEntry.timestamp) return false
          if (!startEntry.message.includes('started')) return false

          // Test scheduler processing logging
          const processingEntry = logger.logSchedulerProcessing(
            executionId,
            postsProcessed,
            actualPostsPublished
          )
          
          // Should contain required fields for processing phase
          if (!processingEntry.executionId || processingEntry.executionId !== executionId) return false
          if (processingEntry.phase !== 'processing') return false
          if (processingEntry.level !== 'info') return false
          if (!processingEntry.timestamp) return false
          if (processingEntry.postsProcessed !== postsProcessed) return false
          if (processingEntry.postsPublished !== actualPostsPublished) return false
          if (!processingEntry.message.includes(postsProcessed.toString())) return false
          if (!processingEntry.message.includes(actualPostsPublished.toString())) return false

          // Test scheduler completion logging
          const completeEntry = logger.logSchedulerComplete(
            executionId,
            postsProcessed,
            actualPostsPublished,
            duration,
            errors
          )
          
          // Should contain required fields for complete phase
          if (!completeEntry.executionId || completeEntry.executionId !== executionId) return false
          if (completeEntry.phase !== 'complete') return false
          if (!completeEntry.timestamp) return false
          if (completeEntry.postsProcessed !== postsProcessed) return false
          if (completeEntry.postsPublished !== actualPostsPublished) return false
          if (completeEntry.duration !== duration) return false
          if (!completeEntry.message.includes(duration.toString())) return false
          
          // Level should be 'warn' if there are errors, 'info' otherwise
          if (errors.length > 0) {
            if (completeEntry.level !== 'warn') return false
            if (!completeEntry.errors || completeEntry.errors.length !== errors.length) return false
          } else {
            if (completeEntry.level !== 'info') return false
          }

          // Test scheduler error logging
          if (errors.length > 0) {
            const errorEntry = logger.logSchedulerError(executionId, errors[0], duration)
            
            // Should contain required fields for error phase
            if (!errorEntry.executionId || errorEntry.executionId !== executionId) return false
            if (errorEntry.phase !== 'error') return false
            if (errorEntry.level !== 'error') return false
            if (!errorEntry.timestamp) return false
            if (!errorEntry.message.includes(errors[0])) return false
            if (!errorEntry.errors || !errorEntry.errors.includes(errors[0])) return false
            if (errorEntry.duration !== duration) return false
          }

          // Test correlation ID functionality
          const correlationId = `corr-${executionId}`
          logger.setCorrelationId(correlationId)
          
          const entryWithCorrelation = logger.info('Test message')
          if (entryWithCorrelation.correlationId !== correlationId) return false
          
          logger.clearCorrelationId()
          const entryWithoutCorrelation = logger.info('Test message')
          if (entryWithoutCorrelation.correlationId !== undefined) return false

          // Test security violation logging
          const securityEntry = logger.logSecurityViolation('Invalid auth token', { ip: '192.168.1.1' })
          if (securityEntry.level !== 'error') return false
          if (!securityEntry.message.includes('SECURITY VIOLATION')) return false
          if (!securityEntry.metadata?.securityEvent) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('PerformanceMonitor Properties', () => {
  let logger: Logger
  let performanceMonitor: PerformanceMonitor

  beforeEach(() => {
    logger = new Logger()
    performanceMonitor = new PerformanceMonitor(logger, {
      executionDurationMs: 30000, // 30 seconds
      errorRatePercent: 5, // 5%
      postsProcessedMin: 0
    })
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  // **Feature: timezone-scheduler-fix, Property 10: Performance monitoring**
  // **Validates: Requirements 3.5**
  it('Property 10: Performance monitoring', () => {
    // Generate valid scheduler metrics
    const schedulerMetrics = fc.record({
      execution_id: fc.string({ minLength: 1, maxLength: 50 }),
      started_at: fc.integer({ min: Date.parse('2020-01-01T00:00:00Z'), max: Date.parse('2030-12-31T23:59:59Z') }).map(ms => new Date(ms).toISOString()),
      completed_at: fc.integer({ min: Date.parse('2020-01-01T00:00:00Z'), max: Date.parse('2030-12-31T23:59:59Z') }).map(ms => new Date(ms).toISOString()),
      posts_processed: fc.integer({ min: 0, max: 1000 }),
      posts_published: fc.integer({ min: 0, max: 1000 }),
      errors_encountered: fc.integer({ min: 0, max: 100 }),
      execution_duration_ms: fc.integer({ min: 0, max: 600000 }) // 0 to 10 minutes
    }).map(metrics => ({
      ...metrics,
      // Ensure posts_published <= posts_processed
      posts_published: Math.min(metrics.posts_published, metrics.posts_processed)
    }))

    fc.assert(
      fc.property(
        schedulerMetrics,
        (metrics: SchedulerMetrics) => {
          // Test performance monitoring
          const alerts = performanceMonitor.checkPerformance(metrics)

          // Verify alert generation logic
          let expectedAlerts = 0

          // Check execution duration threshold (30 seconds = 30000ms)
          if (metrics.execution_duration_ms > 30000) {
            expectedAlerts++
            
            // Find the duration alert
            const durationAlert = alerts.find(a => a.metric === 'execution_duration')
            if (!durationAlert) return false
            
            // Verify alert properties
            if (durationAlert.threshold !== 30000) return false
            if (durationAlert.actualValue !== metrics.execution_duration_ms) return false
            if (!durationAlert.executionId || durationAlert.executionId !== metrics.execution_id) return false
            if (!durationAlert.timestamp) return false
            
            // Check alert type based on severity
            const expectedType = metrics.execution_duration_ms > 60000 ? 'performance_critical' : 'performance_warning'
            if (durationAlert.type !== expectedType) return false
          }

          // Check error rate threshold (5%)
          if (metrics.posts_processed > 0) {
            const errorRate = (metrics.errors_encountered / metrics.posts_processed) * 100
            if (errorRate > 5) {
              expectedAlerts++
              
              // Find the error rate alert
              const errorAlert = alerts.find(a => a.metric === 'error_rate')
              if (!errorAlert) return false
              
              // Verify alert properties
              if (errorAlert.threshold !== 5) return false
              if (Math.abs(errorAlert.actualValue - errorRate) > 0.01) return false // Allow small floating point differences
              if (!errorAlert.executionId || errorAlert.executionId !== metrics.execution_id) return false
              if (!errorAlert.timestamp) return false
              
              // Check alert type based on severity
              const expectedType = errorRate > 10 ? 'performance_critical' : 'performance_warning'
              if (errorAlert.type !== expectedType) return false
            }
          }

          // Verify total number of alerts matches expectations
          if (alerts.length !== expectedAlerts) return false

          // Test alert logging functionality
          alerts.forEach(alert => {
            // This should not throw an error
            performanceMonitor.logPerformanceAlert(alert)
          })

          // Test edge cases
          
          // Case 1: Zero posts processed should not generate error rate alerts
          const zeroPostsMetrics: SchedulerMetrics = {
            ...metrics,
            posts_processed: 0,
            posts_published: 0,
            errors_encountered: 10 // High error count but no posts processed
          }
          const zeroPostsAlerts = performanceMonitor.checkPerformance(zeroPostsMetrics)
          const hasErrorRateAlert = zeroPostsAlerts.some(a => a.metric === 'error_rate')
          if (hasErrorRateAlert) return false

          // Case 2: Exactly at threshold should not trigger alerts
          const thresholdMetrics: SchedulerMetrics = {
            ...metrics,
            execution_duration_ms: 30000, // Exactly at threshold
            posts_processed: 100,
            posts_published: 95,
            errors_encountered: 5 // Exactly 5% error rate
          }
          const thresholdAlerts = performanceMonitor.checkPerformance(thresholdMetrics)
          if (thresholdAlerts.length > 0) return false

          // Case 3: Just over threshold should trigger warning alerts
          const justOverMetrics: SchedulerMetrics = {
            ...metrics,
            execution_duration_ms: 30001, // Just over threshold
            posts_processed: 100,
            posts_published: 94,
            errors_encountered: 6 // Just over 5% error rate (6%)
          }
          const justOverAlerts = performanceMonitor.checkPerformance(justOverMetrics)
          
          // Should have exactly 2 alerts (duration and error rate)
          if (justOverAlerts.length !== 2) return false
          
          // Both should be warnings, not critical
          const allWarnings = justOverAlerts.every(a => a.type === 'performance_warning')
          if (!allWarnings) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})