/**
 * Configuration module for timezone scheduler system
 * Handles environment variables and system configuration
 */

export interface SchedulerConfig {
  // Database retry configuration (Requirement 2.4)
  database: {
    maxRetries: number
    initialRetryDelayMs: number
    maxRetryDelayMs: number
    retryMultiplier: number
    connectionTimeoutMs: number
  }
  
  // Batch processing configuration (Requirement 2.5)
  batch: {
    maxBatchSize: number
    processingTimeoutMs: number
    maxConcurrentBatches: number
  }
  
  // Performance monitoring thresholds (Requirement 3.5)
  monitoring: {
    maxExecutionTimeMs: number
    slowQueryThresholdMs: number
    memoryUsageThresholdMb: number
    errorRateThreshold: number
    alertingEnabled: boolean
  }
  
  // Timezone configuration
  timezone: {
    defaultTimezone: string
    supportedTimezones: string[]
    enableDstHandling: boolean
  }
  
  // Security configuration
  security: {
    cronSecret: string
    jwtSecret: string
    enableSecurityLogging: boolean
  }
  
  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    enableStructuredLogging: boolean
    enableCorrelationIds: boolean
  }
}

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): SchedulerConfig {
  return {
    database: {
      maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
      initialRetryDelayMs: parseInt(process.env.DB_INITIAL_RETRY_DELAY_MS || '1000'),
      maxRetryDelayMs: parseInt(process.env.DB_MAX_RETRY_DELAY_MS || '30000'),
      retryMultiplier: parseFloat(process.env.DB_RETRY_MULTIPLIER || '2.0'),
      connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000'),
    },
    
    batch: {
      maxBatchSize: parseInt(process.env.SCHEDULER_MAX_BATCH_SIZE || '100'),
      processingTimeoutMs: parseInt(process.env.SCHEDULER_PROCESSING_TIMEOUT_MS || '300000'), // 5 minutes
      maxConcurrentBatches: parseInt(process.env.SCHEDULER_MAX_CONCURRENT_BATCHES || '3'),
    },
    
    monitoring: {
      maxExecutionTimeMs: parseInt(process.env.SCHEDULER_MAX_EXECUTION_TIME_MS || '600000'), // 10 minutes
      slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '5000'),
      memoryUsageThresholdMb: parseInt(process.env.MEMORY_USAGE_THRESHOLD_MB || '512'),
      errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'), // 5%
      alertingEnabled: process.env.ALERTING_ENABLED === 'true',
    },
    
    timezone: {
      defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
      supportedTimezones: (process.env.SUPPORTED_TIMEZONES || 'UTC,America/New_York,America/Los_Angeles,Europe/London,Europe/Paris,Asia/Tokyo').split(','),
      enableDstHandling: process.env.ENABLE_DST_HANDLING !== 'false',
    },
    
    security: {
      cronSecret: process.env.CRON_SECRET || '',
      jwtSecret: process.env.JWT_SECRET || '',
      enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',
    },
    
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING !== 'false',
      enableCorrelationIds: process.env.ENABLE_CORRELATION_IDS !== 'false',
    },
  }
}

/**
 * Validate configuration values
 */
export function validateConfig(config: SchedulerConfig): string[] {
  const errors: string[] = []
  
  // Validate database configuration
  if (config.database.maxRetries < 0) {
    errors.push('Database max retries must be non-negative')
  }
  if (config.database.initialRetryDelayMs < 0) {
    errors.push('Database initial retry delay must be non-negative')
  }
  if (config.database.maxRetryDelayMs < config.database.initialRetryDelayMs) {
    errors.push('Database max retry delay must be greater than or equal to initial retry delay')
  }
  if (config.database.retryMultiplier <= 1) {
    errors.push('Database retry multiplier must be greater than 1')
  }
  
  // Validate batch configuration
  if (config.batch.maxBatchSize <= 0) {
    errors.push('Batch max size must be positive')
  }
  if (config.batch.processingTimeoutMs <= 0) {
    errors.push('Batch processing timeout must be positive')
  }
  if (config.batch.maxConcurrentBatches <= 0) {
    errors.push('Max concurrent batches must be positive')
  }
  
  // Validate monitoring configuration
  if (config.monitoring.maxExecutionTimeMs <= 0) {
    errors.push('Max execution time must be positive')
  }
  if (config.monitoring.slowQueryThresholdMs <= 0) {
    errors.push('Slow query threshold must be positive')
  }
  if (config.monitoring.memoryUsageThresholdMb <= 0) {
    errors.push('Memory usage threshold must be positive')
  }
  if (config.monitoring.errorRateThreshold < 0 || config.monitoring.errorRateThreshold > 1) {
    errors.push('Error rate threshold must be between 0 and 1')
  }
  
  // Validate security configuration
  if (!config.security.cronSecret) {
    errors.push('Cron secret is required')
  }
  if (!config.security.jwtSecret) {
    errors.push('JWT secret is required')
  }
  
  // Validate timezone configuration
  if (!config.timezone.defaultTimezone) {
    errors.push('Default timezone is required')
  }
  if (config.timezone.supportedTimezones.length === 0) {
    errors.push('At least one supported timezone is required')
  }
  
  return errors
}

/**
 * Get the current configuration instance
 */
let configInstance: SchedulerConfig | null = null

export function getConfig(): SchedulerConfig {
  if (!configInstance) {
    const baseConfig = loadConfig()
    
    const errors = validateConfig(baseConfig)
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }
    
    configInstance = baseConfig
  }
  return configInstance
}

/**
 * Reset configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null
}