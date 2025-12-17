import { Logger, LogEntry } from './logger'

export interface SecurityValidationResult {
  isValid: boolean
  securityViolation: boolean
  errorMessage?: string
  violationType?: SecurityViolationType
  loggedAt?: string
  logEntry?: LogEntry
}

export type SecurityViolationType = 
  | 'missing_secret'
  | 'missing_auth_header'
  | 'empty_auth_header'
  | 'wrong_auth_type'
  | 'malformed_bearer_token'
  | 'invalid_secret'
  | 'rate_limited'

export interface RequestMetadata {
  ip?: string
  userAgent?: string
  method?: string
  path?: string
  [key: string]: any
}

export interface SecurityViolationTracker {
  ip: string
  violations: number
  firstViolation: string
  lastViolation: string
}

export class SecurityValidator {
  private logger: Logger
  private violationTracker: Map<string, SecurityViolationTracker> = new Map()
  private readonly MAX_VIOLATIONS_PER_IP = 10
  private readonly VIOLATION_WINDOW_MS = 60000 // 1 minute

  constructor(logger: Logger) {
    this.logger = logger
  }

  validateCronAuth(
    authHeader: string | null, 
    metadata: RequestMetadata = {}
  ): SecurityValidationResult {
    const cronSecret = process.env.CRON_SECRET

    // Check if CRON_SECRET is configured and not just whitespace
    if (!cronSecret || cronSecret.trim() === '') {
      return this.logSecurityViolation(
        'missing_secret',
        'CRON_SECRET environment variable not configured or empty',
        metadata
      )
    }

    // Check if auth header is present
    if (authHeader === null || authHeader === undefined) {
      return this.logSecurityViolation(
        'missing_auth_header',
        'Missing authorization header',
        metadata
      )
    }

    // Check if auth header is empty
    if (authHeader === '') {
      return this.logSecurityViolation(
        'empty_auth_header',
        'Empty authorization header',
        metadata
      )
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return this.logSecurityViolation(
        'wrong_auth_type',
        `Invalid authorization type. Expected Bearer token, got: ${authHeader.split(' ')[0]}`,
        metadata
      )
    }

    // Extract the token
    const token = authHeader.substring('Bearer '.length)

    // Check if token is present after Bearer
    if (!token || token.trim() === '') {
      return this.logSecurityViolation(
        'malformed_bearer_token',
        'Malformed Bearer token - no token provided after Bearer',
        metadata
      )
    }

    // Validate the secret
    if (token !== cronSecret) {
      return this.logSecurityViolation(
        'invalid_secret',
        'Invalid cron secret provided',
        metadata,
        { providedTokenLength: token.length }
      )
    }

    // Valid authentication
    return {
      isValid: true,
      securityViolation: false
    }
  }

  private logSecurityViolation(
    violationType: SecurityViolationType,
    message: string,
    metadata: RequestMetadata,
    additionalData: Record<string, any> = {}
  ): SecurityValidationResult {
    const timestamp = new Date().toISOString()
    const ip = metadata.ip || 'unknown'

    // Track violations per IP
    this.trackViolation(ip, timestamp)

    // Check if this IP should be rate limited
    const isRateLimited = this.isRateLimited(ip)

    // Create comprehensive log entry
    const logMetadata = {
      securityEvent: true,
      violationType,
      ip,
      userAgent: metadata.userAgent,
      method: metadata.method,
      path: metadata.path,
      timestamp,
      isRateLimited,
      ...additionalData,
      ...metadata // Include any additional metadata
    }

    const logEntry = this.logger.logSecurityViolation(message, logMetadata)

    return {
      isValid: false,
      securityViolation: true,
      errorMessage: message,
      violationType: isRateLimited ? 'rate_limited' : violationType,
      loggedAt: timestamp,
      logEntry
    }
  }

  private trackViolation(ip: string, timestamp: string): void {
    const existing = this.violationTracker.get(ip)
    
    if (existing) {
      // Clean up old violations outside the window
      const windowStart = Date.now() - this.VIOLATION_WINDOW_MS
      if (new Date(existing.firstViolation).getTime() < windowStart) {
        // Reset the tracker if the first violation is outside the window
        this.violationTracker.set(ip, {
          ip,
          violations: 1,
          firstViolation: timestamp,
          lastViolation: timestamp
        })
      } else {
        // Increment violations within the window
        existing.violations++
        existing.lastViolation = timestamp
      }
    } else {
      // First violation for this IP
      this.violationTracker.set(ip, {
        ip,
        violations: 1,
        firstViolation: timestamp,
        lastViolation: timestamp
      })
    }
  }

  private isRateLimited(ip: string): boolean {
    const tracker = this.violationTracker.get(ip)
    if (!tracker) return false

    const windowStart = Date.now() - this.VIOLATION_WINDOW_MS
    const firstViolationTime = new Date(tracker.firstViolation).getTime()

    // If first violation is within the window and we've exceeded the limit
    return firstViolationTime >= windowStart && tracker.violations >= this.MAX_VIOLATIONS_PER_IP
  }

  // Method to get violation statistics (useful for monitoring)
  getViolationStats(): { totalIPs: number; totalViolations: number; rateLimitedIPs: number } {
    let totalViolations = 0
    let rateLimitedIPs = 0

    for (const tracker of this.violationTracker.values()) {
      totalViolations += tracker.violations
      if (this.isRateLimited(tracker.ip)) {
        rateLimitedIPs++
      }
    }

    return {
      totalIPs: this.violationTracker.size,
      totalViolations,
      rateLimitedIPs
    }
  }

  // Method to clear old violation records (should be called periodically)
  cleanupOldViolations(): void {
    const windowStart = Date.now() - this.VIOLATION_WINDOW_MS
    
    for (const [ip, tracker] of this.violationTracker.entries()) {
      if (new Date(tracker.lastViolation).getTime() < windowStart) {
        this.violationTracker.delete(ip)
      }
    }
  }
}