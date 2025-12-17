import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { SecurityValidator } from '../security-validator'
import { Logger } from '../logger'

describe('Security Properties', () => {
  let securityValidator: SecurityValidator
  let logger: Logger

  beforeEach(() => {
    logger = new Logger()
    securityValidator = new SecurityValidator(logger)
    
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  // **Feature: timezone-scheduler-fix, Property 9: Security validation and logging**
  // **Validates: Requirements 3.4**
  it('Property 9: Security validation and logging', () => {
    // Generate valid cron secrets (non-empty, non-whitespace)
    const validSecrets = fc.string({ minLength: 16, maxLength: 128 })
      .filter(s => s.trim().length >= 16) // Ensure it's not just whitespace
    
    // Generate invalid auth headers (missing, malformed, wrong secret)
    const invalidAuthHeaders = fc.oneof(
      fc.constant(null), // Missing header
      fc.constant(''), // Empty header
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('Bearer ')), // Malformed
      fc.string({ minLength: 1, maxLength: 50 }).map(s => `Bearer ${s}`), // Wrong secret
      fc.constant('Basic dXNlcjpwYXNz'), // Wrong auth type
      fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.includes(' ') && !s.startsWith('Bearer ')) // Other malformed
    )

    // Generate request metadata (IP addresses, user agents, etc.)
    const requestMetadata = fc.record({
      ip: fc.oneof(
        fc.ipV4(),
        fc.ipV6(),
        fc.constant('127.0.0.1'),
        fc.constant('::1')
      ),
      userAgent: fc.oneof(
        fc.constant('cron-job-service/1.0'),
        fc.constant('curl/7.68.0'),
        fc.string({ minLength: 10, maxLength: 200 })
      ),
      method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
      path: fc.constantFrom('/api/scheduler', '/api/posts', '/api/auth')
    })

    fc.assert(
      fc.property(
        validSecrets,
        invalidAuthHeaders,
        requestMetadata,
        (cronSecret, invalidAuthHeader, metadata) => {
          // Create a fresh validator for each test to avoid state pollution
          const freshValidator = new SecurityValidator(logger)
          
          // Set the environment variable for the test
          process.env.CRON_SECRET = cronSecret
          
          // Test 1: Valid authentication should pass without logging security violations
          const validAuthHeader = `Bearer ${cronSecret}`
          const validResult = freshValidator.validateCronAuth(validAuthHeader, metadata)
          
          if (!validResult.isValid) return false
          if (validResult.securityViolation) return false
          if (validResult.errorMessage) return false

          // Test 2: Invalid authentication should fail and log security violations
          const invalidResult = freshValidator.validateCronAuth(invalidAuthHeader, metadata)
          
          if (invalidResult.isValid) return false
          if (!invalidResult.securityViolation) return false
          if (!invalidResult.errorMessage) return false
          
          // Should contain details about the violation
          if (!invalidResult.violationType) return false
          if (!invalidResult.loggedAt) return false
          
          // Test 3: Missing CRON_SECRET environment variable should fail securely
          const originalSecret = process.env.CRON_SECRET
          delete process.env.CRON_SECRET
          
          const noSecretResult = freshValidator.validateCronAuth(validAuthHeader, metadata)
          if (noSecretResult.isValid) return false
          if (!noSecretResult.securityViolation) return false
          if (noSecretResult.violationType !== 'missing_secret') return false
          
          // Restore the secret
          process.env.CRON_SECRET = originalSecret

          // Test 4: Security logs should contain required information
          const loggedViolation = freshValidator.validateCronAuth('Bearer wrongsecret', metadata)
          if (!loggedViolation.logEntry) return false
          
          const logEntry = loggedViolation.logEntry
          if (logEntry.level !== 'error') return false
          if (!logEntry.message.includes('SECURITY VIOLATION')) return false
          if (!logEntry.metadata?.securityEvent) return false
          if (!logEntry.metadata?.ip) return false
          if (!logEntry.metadata?.violationType) return false
          if (!logEntry.timestamp) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases in security validation', () => {
    const logger = new Logger()
    const securityValidator = new SecurityValidator(logger)
    
    // Test the specific failing case from the property test
    const originalSecret = process.env.CRON_SECRET
    
    // Case 1: CRON_SECRET is just spaces, auth header is null
    process.env.CRON_SECRET = "                " // spaces
    const result1 = securityValidator.validateCronAuth(null, { ip: '::1' })
    expect(result1.isValid).toBe(false)
    expect(result1.securityViolation).toBe(true)
    expect(result1.violationType).toBe('missing_secret')
    
    // Case 2: CRON_SECRET is just spaces, auth header is empty
    const result2 = securityValidator.validateCronAuth("", { ip: '::1' })
    expect(result2.isValid).toBe(false)
    expect(result2.securityViolation).toBe(true)
    expect(result2.violationType).toBe('missing_secret')
    
    // Restore original secret
    process.env.CRON_SECRET = originalSecret
    
    // Test with very long auth headers
    const longHeader = 'Bearer ' + 'a'.repeat(10000)
    const longResult = securityValidator.validateCronAuth(longHeader, { ip: '127.0.0.1' })
    expect(longResult.isValid).toBe(false)
    expect(longResult.securityViolation).toBe(true)
    
    // Test with special characters in metadata
    const specialMetadata = {
      ip: '127.0.0.1',
      userAgent: 'test<script>alert("xss")</script>',
      method: 'POST'
    }
    const specialResult = securityValidator.validateCronAuth(null, specialMetadata)
    expect(specialResult.isValid).toBe(false)
    expect(specialResult.logEntry?.metadata?.userAgent).toBe(specialMetadata.userAgent)
  })
})