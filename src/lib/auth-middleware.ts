import { NextRequest, NextResponse } from 'next/server'
import { SecurityValidator, RequestMetadata } from './security-validator'
import { logger } from './logger'

export interface AuthMiddlewareOptions {
  requireCronAuth?: boolean
  logAllRequests?: boolean
  enableRateLimiting?: boolean
}

export class AuthMiddleware {
  private securityValidator: SecurityValidator

  constructor() {
    this.securityValidator = new SecurityValidator(logger)
  }

  /**
   * Validates cron job authentication for scheduler endpoints
   */
  validateCronAuth(request: NextRequest): NextResponse | null {
    const authHeader = request.headers.get('authorization')
    
    // Extract request metadata for security logging
    const metadata: RequestMetadata = {
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      method: request.method,
      path: request.nextUrl.pathname
    }

    const validationResult = this.securityValidator.validateCronAuth(authHeader, metadata)

    if (!validationResult.isValid) {
      // Log additional context for security monitoring
      logger.warn('Scheduler authentication failed', {
        path: metadata.path,
        method: metadata.method,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        violationType: validationResult.violationType,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or missing authentication credentials',
          timestamp: new Date().toISOString()
        }, 
        { status: 401 }
      )
    }

    // Authentication successful - log for audit trail
    logger.info('Scheduler authentication successful', {
      path: metadata.path,
      method: metadata.method,
      ip: metadata.ip,
      timestamp: new Date().toISOString()
    })

    return null // No error, continue processing
  }

  /**
   * Middleware wrapper for Next.js API routes
   */
  withCronAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      // Validate authentication
      const authError = this.validateCronAuth(request)
      if (authError) {
        return authError
      }

      // Set correlation ID for request tracking
      const correlationId = this.generateCorrelationId()
      logger.setCorrelationId(correlationId)

      try {
        // Add security headers to the request context
        const securityHeaders = {
          'X-Correlation-ID': correlationId,
          'X-Request-Time': new Date().toISOString()
        }

        // Call the actual handler
        const response = await handler(request)

        // Add security headers to response
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value)
        })

        return response
      } catch (error) {
        logger.error('Request processing error', {
          error: error instanceof Error ? error.message : String(error),
          correlationId,
          path: request.nextUrl.pathname,
          method: request.method
        })

        return NextResponse.json(
          { 
            error: 'Internal server error',
            correlationId,
            timestamp: new Date().toISOString()
          }, 
          { status: 500 }
        )
      } finally {
        logger.clearCorrelationId()
      }
    }
  }

  /**
   * Extract client IP address from request headers
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers that might contain the real IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim()
    }
    
    if (realIP) {
      return realIP
    }
    
    if (cfConnectingIP) {
      return cfConnectingIP
    }
    
    // Fallback to connection remote address
    return request.ip || 'unknown'
  }

  /**
   * Generate a unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2)
    return `${timestamp}-${random}`
  }

  /**
   * Get security violation statistics
   */
  getSecurityStats() {
    return this.securityValidator.getViolationStats()
  }

  /**
   * Clean up old violation records
   */
  cleanupSecurityData() {
    this.securityValidator.cleanupOldViolations()
  }
}

// Singleton instance for use across the application
export const authMiddleware = new AuthMiddleware()