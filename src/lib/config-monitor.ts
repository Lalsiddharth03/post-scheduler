/**
 * Configuration monitoring and alerting system
 * Implements monitoring thresholds from Requirement 3.5
 */

import { SchedulerConfig } from './config'
import { performConfigHealthCheck, ConfigHealthCheck } from './config-utils'

export interface PerformanceMetrics {
  executionTimeMs: number
  memoryUsageMb: number
  queryTimeMs: number
  errorCount: number
  totalOperations: number
  timestamp: Date
}

export interface AlertThreshold {
  metric: keyof PerformanceMetrics
  threshold: number
  operator: 'gt' | 'lt' | 'eq'
  severity: 'warning' | 'error' | 'critical'
}

export class ConfigurationMonitor {
  private config: SchedulerConfig
  private metricsHistory: PerformanceMetrics[] = []
  private alertThresholds: AlertThreshold[] = []
  private lastHealthCheck: ConfigHealthCheck | null = null

  constructor(config: SchedulerConfig) {
    this.config = config
    this.initializeAlertThresholds()
  }

  /**
   * Initialize alert thresholds based on configuration
   */
  private initializeAlertThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'executionTimeMs',
        threshold: this.config.monitoring.maxExecutionTimeMs,
        operator: 'gt',
        severity: 'error',
      },
      {
        metric: 'queryTimeMs',
        threshold: this.config.monitoring.slowQueryThresholdMs,
        operator: 'gt',
        severity: 'warning',
      },
      {
        metric: 'memoryUsageMb',
        threshold: this.config.monitoring.memoryUsageThresholdMb,
        operator: 'gt',
        severity: 'warning',
      },
    ]
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push({
      ...metrics,
      timestamp: new Date(),
    })

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000)
    }

    // Check for threshold violations
    if (this.config.monitoring.alertingEnabled) {
      this.checkThresholds(metrics)
    }
  }

  /**
   * Check if metrics violate configured thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    for (const threshold of this.alertThresholds) {
      const value = metrics[threshold.metric] as number
      let violated = false

      switch (threshold.operator) {
        case 'gt':
          violated = value > threshold.threshold
          break
        case 'lt':
          violated = value < threshold.threshold
          break
        case 'eq':
          violated = value === threshold.threshold
          break
      }

      if (violated) {
        this.triggerAlert(threshold, value, metrics)
      }
    }

    // Check error rate threshold
    if (metrics.totalOperations > 0) {
      const errorRate = metrics.errorCount / metrics.totalOperations
      if (errorRate > this.config.monitoring.errorRateThreshold) {
        this.triggerAlert(
          {
            metric: 'errorCount',
            threshold: this.config.monitoring.errorRateThreshold,
            operator: 'gt',
            severity: 'error',
          },
          errorRate,
          metrics
        )
      }
    }
  }

  /**
   * Trigger an alert when threshold is violated
   */
  private triggerAlert(
    threshold: AlertThreshold,
    actualValue: number,
    metrics: PerformanceMetrics
  ): void {
    const alert = {
      timestamp: new Date(),
      severity: threshold.severity,
      metric: threshold.metric,
      threshold: threshold.threshold,
      actualValue,
      message: `${threshold.metric} threshold violated: ${actualValue} ${threshold.operator} ${threshold.threshold}`,
      context: {
        executionTimeMs: metrics.executionTimeMs,
        memoryUsageMb: metrics.memoryUsageMb,
        errorCount: metrics.errorCount,
        totalOperations: metrics.totalOperations,
      },
    }

    // Log the alert
    console.warn('Configuration Monitor Alert:', alert)

    // In a real system, this would send alerts to monitoring systems
    // like DataDog, New Relic, or custom alerting endpoints
    if (threshold.severity === 'critical') {
      console.error('CRITICAL ALERT:', alert)
    }
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): {
    recent: PerformanceMetrics[]
    averages: Partial<PerformanceMetrics>
    trends: Record<string, 'improving' | 'degrading' | 'stable'>
  } {
    const recent = this.metricsHistory.slice(-10) // Last 10 metrics
    
    if (recent.length === 0) {
      return {
        recent: [],
        averages: {},
        trends: {},
      }
    }

    // Calculate averages
    const averages: Partial<PerformanceMetrics> = {
      executionTimeMs: recent.reduce((sum, m) => sum + m.executionTimeMs, 0) / recent.length,
      memoryUsageMb: recent.reduce((sum, m) => sum + m.memoryUsageMb, 0) / recent.length,
      queryTimeMs: recent.reduce((sum, m) => sum + m.queryTimeMs, 0) / recent.length,
      errorCount: recent.reduce((sum, m) => sum + m.errorCount, 0) / recent.length,
      totalOperations: recent.reduce((sum, m) => sum + m.totalOperations, 0) / recent.length,
    }

    // Calculate trends (simple comparison of first half vs second half)
    const trends: Record<string, 'improving' | 'degrading' | 'stable'> = {}
    if (recent.length >= 4) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
      const secondHalf = recent.slice(Math.floor(recent.length / 2))

      const firstAvg = firstHalf.reduce((sum, m) => sum + m.executionTimeMs, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.executionTimeMs, 0) / secondHalf.length

      const change = (secondAvg - firstAvg) / firstAvg
      if (Math.abs(change) < 0.1) {
        trends.executionTime = 'stable'
      } else if (change > 0) {
        trends.executionTime = 'degrading'
      } else {
        trends.executionTime = 'improving'
      }
    }

    return { recent, averages, trends }
  }

  /**
   * Perform configuration health check
   */
  performHealthCheck(): ConfigHealthCheck {
    this.lastHealthCheck = performConfigHealthCheck(this.config)
    return this.lastHealthCheck
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): {
    config: {
      alertingEnabled: boolean
      thresholds: Record<string, number>
    }
    health: ConfigHealthCheck | null
    performance: ReturnType<ConfigurationMonitor['getPerformanceStats']>
    alerts: {
      recent: number
      critical: number
    }
  } {
    const performance = this.getPerformanceStats()
    
    // Count recent alerts (in a real system, this would come from alert storage)
    const recentAlerts = 0 // Placeholder
    const criticalAlerts = 0 // Placeholder

    return {
      config: {
        alertingEnabled: this.config.monitoring.alertingEnabled,
        thresholds: {
          maxExecutionTimeMs: this.config.monitoring.maxExecutionTimeMs,
          slowQueryThresholdMs: this.config.monitoring.slowQueryThresholdMs,
          memoryUsageThresholdMb: this.config.monitoring.memoryUsageThresholdMb,
          errorRateThreshold: this.config.monitoring.errorRateThreshold,
        },
      },
      health: this.lastHealthCheck,
      performance,
      alerts: {
        recent: recentAlerts,
        critical: criticalAlerts,
      },
    }
  }

  /**
   * Update configuration and reinitialize thresholds
   */
  updateConfig(newConfig: SchedulerConfig): void {
    this.config = newConfig
    this.initializeAlertThresholds()
  }

  /**
   * Clear metrics history (useful for testing or maintenance)
   */
  clearMetrics(): void {
    this.metricsHistory = []
  }
}

/**
 * Global configuration monitor instance
 */
let monitorInstance: ConfigurationMonitor | null = null

export function getConfigurationMonitor(config: SchedulerConfig): ConfigurationMonitor {
  if (!monitorInstance) {
    monitorInstance = new ConfigurationMonitor(config)
  }
  return monitorInstance
}

/**
 * Reset monitor instance (useful for testing)
 */
export function resetConfigurationMonitor(): void {
  monitorInstance = null
}