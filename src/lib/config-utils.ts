/**
 * Configuration utilities for environment-specific settings
 */

import { SchedulerConfig } from './config'

/**
 * Environment-specific configuration overrides
 */
export interface EnvironmentConfig {
  development?: Partial<SchedulerConfig>
  test?: Partial<SchedulerConfig>
  production?: Partial<SchedulerConfig>
}

/**
 * Get environment-specific configuration overrides
 */
export function getEnvironmentOverrides(): Partial<SchedulerConfig> {
  const env = process.env.NODE_ENV || 'development'
  
  const environmentConfigs: EnvironmentConfig = {
    development: {
      logging: {
        level: 'debug',
        enableStructuredLogging: true,
        enableCorrelationIds: true,
      },
      monitoring: {
        alertingEnabled: false, // Disable alerting in development
        maxExecutionTimeMs: 1200000, // 20 minutes for debugging
        slowQueryThresholdMs: 10000, // More lenient in development
        memoryUsageThresholdMb: 1024,
        errorRateThreshold: 0.1, // 10% - more lenient
      },
      batch: {
        maxBatchSize: 10, // Smaller batches for testing
        processingTimeoutMs: 60000, // 1 minute
        maxConcurrentBatches: 1,
      },
    },
    
    test: {
      logging: {
        level: 'warn', // Reduce noise in tests
        enableStructuredLogging: false,
        enableCorrelationIds: false,
      },
      monitoring: {
        alertingEnabled: false,
        maxExecutionTimeMs: 30000, // 30 seconds for tests
        slowQueryThresholdMs: 1000,
        memoryUsageThresholdMb: 256,
        errorRateThreshold: 0.2, // 20% - very lenient for tests
      },
      batch: {
        maxBatchSize: 5, // Very small batches for tests
        processingTimeoutMs: 10000, // 10 seconds
        maxConcurrentBatches: 1,
      },
      database: {
        maxRetries: 1, // Fail fast in tests
        initialRetryDelayMs: 100,
        maxRetryDelayMs: 1000,
        retryMultiplier: 1.5,
        connectionTimeoutMs: 5000,
      },
    },
    
    production: {
      logging: {
        level: 'info',
        enableStructuredLogging: true,
        enableCorrelationIds: true,
      },
      monitoring: {
        alertingEnabled: true,
        maxExecutionTimeMs: 600000, // 10 minutes
        slowQueryThresholdMs: 3000, // 3 seconds
        memoryUsageThresholdMb: 512,
        errorRateThreshold: 0.02, // 2% - strict in production
      },
      batch: {
        maxBatchSize: 200, // Larger batches for efficiency
        processingTimeoutMs: 600000, // 10 minutes
        maxConcurrentBatches: 5,
      },
      database: {
        maxRetries: 5, // More retries in production
        initialRetryDelayMs: 2000,
        maxRetryDelayMs: 60000, // 1 minute max
        retryMultiplier: 2.5,
        connectionTimeoutMs: 15000,
      },
    },
  }
  
  return environmentConfigs[env as keyof EnvironmentConfig] || {}
}

/**
 * Merge configuration with environment-specific overrides
 */
export function mergeConfigWithEnvironment(baseConfig: SchedulerConfig): SchedulerConfig {
  const overrides = getEnvironmentOverrides()
  
  return {
    ...baseConfig,
    database: { ...baseConfig.database, ...overrides.database },
    batch: { ...baseConfig.batch, ...overrides.batch },
    monitoring: { ...baseConfig.monitoring, ...overrides.monitoring },
    timezone: { ...baseConfig.timezone, ...overrides.timezone },
    security: { ...baseConfig.security, ...overrides.security },
    logging: { ...baseConfig.logging, ...overrides.logging },
  }
}

/**
 * Configuration health check
 */
export interface ConfigHealthCheck {
  isHealthy: boolean
  issues: string[]
  warnings: string[]
}

export function performConfigHealthCheck(config: SchedulerConfig): ConfigHealthCheck {
  const issues: string[] = []
  const warnings: string[] = []
  
  // Check critical configuration
  if (!config.security.cronSecret || config.security.cronSecret.length < 16) {
    issues.push('Cron secret is too short or missing (minimum 16 characters)')
  }
  
  if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
    issues.push('JWT secret is too short or missing (minimum 32 characters)')
  }
  
  // Check performance configuration
  if (config.batch.maxBatchSize > 500) {
    warnings.push('Batch size is very large and may cause timeouts')
  }
  
  if (config.monitoring.maxExecutionTimeMs > 1800000) { // 30 minutes
    warnings.push('Max execution time is very long and may indicate configuration issues')
  }
  
  if (config.database.maxRetries > 10) {
    warnings.push('Database max retries is very high and may cause long delays')
  }
  
  // Check timezone configuration
  const invalidTimezones = config.timezone.supportedTimezones.filter(tz => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz })
      return false
    } catch {
      return true
    }
  })
  
  if (invalidTimezones.length > 0) {
    issues.push(`Invalid timezones configured: ${invalidTimezones.join(', ')}`)
  }
  
  // Check environment-specific issues
  const env = process.env.NODE_ENV || 'development'
  if (env === 'production') {
    if (config.logging.level === 'debug') {
      warnings.push('Debug logging enabled in production may impact performance')
    }
    
    if (!config.monitoring.alertingEnabled) {
      warnings.push('Alerting is disabled in production')
    }
  }
  
  return {
    isHealthy: issues.length === 0,
    issues,
    warnings,
  }
}

/**
 * Get configuration summary for logging/debugging
 */
export function getConfigSummary(config: SchedulerConfig): Record<string, any> {
  return {
    environment: process.env.NODE_ENV || 'development',
    database: {
      maxRetries: config.database.maxRetries,
      connectionTimeoutMs: config.database.connectionTimeoutMs,
    },
    batch: {
      maxBatchSize: config.batch.maxBatchSize,
      maxConcurrentBatches: config.batch.maxConcurrentBatches,
    },
    monitoring: {
      alertingEnabled: config.monitoring.alertingEnabled,
      maxExecutionTimeMs: config.monitoring.maxExecutionTimeMs,
    },
    timezone: {
      defaultTimezone: config.timezone.defaultTimezone,
      supportedTimezonesCount: config.timezone.supportedTimezones.length,
      enableDstHandling: config.timezone.enableDstHandling,
    },
    logging: {
      level: config.logging.level,
      enableStructuredLogging: config.logging.enableStructuredLogging,
    },
    security: {
      hasSecrets: !!(config.security.cronSecret && config.security.jwtSecret),
      enableSecurityLogging: config.security.enableSecurityLogging,
    },
  }
}