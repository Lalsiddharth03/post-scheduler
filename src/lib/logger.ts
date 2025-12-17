import { SchedulerMetrics } from './types'

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  correlationId?: string
  metadata?: Record<string, any>
}

export interface SchedulerLogEntry extends LogEntry {
  executionId: string
  phase: 'start' | 'processing' | 'complete' | 'error'
  postsProcessed?: number
  postsPublished?: number
  duration?: number
  errors?: string[]
}

export interface PerformanceAlert {
  type: 'performance_warning' | 'performance_critical'
  threshold: number
  actualValue: number
  metric: 'execution_duration' | 'posts_processed' | 'error_rate'
  timestamp: string
  executionId: string
}

export class Logger {
  private correlationId: string | null = null

  setCorrelationId(id: string): void {
    this.correlationId = id
  }

  clearCorrelationId(): void {
    this.correlationId = null
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId || undefined,
      metadata
    }
  }

  info(message: string, metadata?: Record<string, any>): LogEntry {
    const entry = this.createLogEntry('info', message, metadata)
    console.log(JSON.stringify(entry))
    return entry
  }

  warn(message: string, metadata?: Record<string, any>): LogEntry {
    const entry = this.createLogEntry('warn', message, metadata)
    console.warn(JSON.stringify(entry))
    return entry
  }

  error(message: string, metadata?: Record<string, any>): LogEntry {
    const entry = this.createLogEntry('error', message, metadata)
    console.error(JSON.stringify(entry))
    return entry
  }

  debug(message: string, metadata?: Record<string, any>): LogEntry {
    const entry = this.createLogEntry('debug', message, metadata)
    console.debug(JSON.stringify(entry))
    return entry
  }

  logSchedulerStart(executionId: string): SchedulerLogEntry {
    const entry: SchedulerLogEntry = {
      level: 'info',
      message: 'Scheduler execution started',
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId || undefined,
      executionId,
      phase: 'start'
    }
    console.log(JSON.stringify(entry))
    return entry
  }

  logSchedulerProcessing(
    executionId: string,
    postsProcessed: number,
    postsPublished: number
  ): SchedulerLogEntry {
    const entry: SchedulerLogEntry = {
      level: 'info',
      message: `Scheduler processing: ${postsProcessed} posts processed, ${postsPublished} published`,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId || undefined,
      executionId,
      phase: 'processing',
      postsProcessed,
      postsPublished
    }
    console.log(JSON.stringify(entry))
    return entry
  }

  logSchedulerComplete(
    executionId: string,
    postsProcessed: number,
    postsPublished: number,
    duration: number,
    errors: string[] = []
  ): SchedulerLogEntry {
    const entry: SchedulerLogEntry = {
      level: errors.length > 0 ? 'warn' : 'info',
      message: `Scheduler execution completed in ${duration}ms`,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId || undefined,
      executionId,
      phase: 'complete',
      postsProcessed,
      postsPublished,
      duration,
      errors: errors.length > 0 ? errors : undefined
    }
    console.log(JSON.stringify(entry))
    return entry
  }

  logSchedulerError(
    executionId: string,
    error: string,
    duration?: number
  ): SchedulerLogEntry {
    const entry: SchedulerLogEntry = {
      level: 'error',
      message: `Scheduler execution failed: ${error}`,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId || undefined,
      executionId,
      phase: 'error',
      duration,
      errors: [error]
    }
    console.error(JSON.stringify(entry))
    return entry
  }

  logSecurityViolation(
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    const entry = this.createLogEntry('error', `SECURITY VIOLATION: ${message}`, {
      ...metadata,
      securityEvent: true
    })
    console.error(JSON.stringify(entry))
    return entry
  }
}

export class PerformanceMonitor {
  private logger: Logger
  private thresholds: {
    executionDurationMs: number
    errorRatePercent: number
    postsProcessedMin: number
  }

  constructor(
    logger: Logger,
    thresholds = {
      executionDurationMs: 30000, // 30 seconds
      errorRatePercent: 5, // 5%
      postsProcessedMin: 0 // minimum posts that should be processed
    }
  ) {
    this.logger = logger
    this.thresholds = thresholds
  }

  checkPerformance(metrics: SchedulerMetrics): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = []

    // Check execution duration
    if (metrics.execution_duration_ms > this.thresholds.executionDurationMs) {
      const alert: PerformanceAlert = {
        type: metrics.execution_duration_ms > this.thresholds.executionDurationMs * 2 
          ? 'performance_critical' 
          : 'performance_warning',
        threshold: this.thresholds.executionDurationMs,
        actualValue: metrics.execution_duration_ms,
        metric: 'execution_duration',
        timestamp: new Date().toISOString(),
        executionId: metrics.execution_id
      }
      alerts.push(alert)
      
      this.logger.warn('Performance threshold exceeded', {
        metric: 'execution_duration',
        threshold: this.thresholds.executionDurationMs,
        actual: metrics.execution_duration_ms,
        executionId: metrics.execution_id
      })
    }

    // Check error rate
    if (metrics.posts_processed > 0) {
      const errorRate = (metrics.errors_encountered / metrics.posts_processed) * 100
      if (errorRate > this.thresholds.errorRatePercent) {
        const alert: PerformanceAlert = {
          type: errorRate > this.thresholds.errorRatePercent * 2 
            ? 'performance_critical' 
            : 'performance_warning',
          threshold: this.thresholds.errorRatePercent,
          actualValue: errorRate,
          metric: 'error_rate',
          timestamp: new Date().toISOString(),
          executionId: metrics.execution_id
        }
        alerts.push(alert)
        
        this.logger.warn('Error rate threshold exceeded', {
          metric: 'error_rate',
          threshold: this.thresholds.errorRatePercent,
          actual: errorRate,
          executionId: metrics.execution_id
        })
      }
    }

    return alerts
  }

  logPerformanceAlert(alert: PerformanceAlert): void {
    this.logger.warn(`Performance alert: ${alert.type}`, {
      metric: alert.metric,
      threshold: alert.threshold,
      actual: alert.actualValue,
      executionId: alert.executionId
    })
  }
}

// Singleton instances
export const logger = new Logger()
export const performanceMonitor = new PerformanceMonitor(logger)