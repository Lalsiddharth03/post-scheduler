import { NextRequest, NextResponse } from 'next/server'
import { createSchedulerService } from '@/lib/scheduler-service'
import { SecurityValidator } from '@/lib/security-validator'
import { logger } from '@/lib/logger'

// Create security validator instance
const securityValidator = new SecurityValidator(logger)

async function schedulerHandler(request: NextRequest) {
  try {
    // Extract request metadata for security logging
    const requestMetadata = {
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      method: request.method,
      path: request.nextUrl.pathname
    }

    // Validate authentication using SecurityValidator
    const authHeader = request.headers.get('authorization')
    const authResult = securityValidator.validateCronAuth(authHeader, requestMetadata)

    if (!authResult.isValid) {
      // Security violation detected - return appropriate error
      const statusCode = authResult.violationType === 'rate_limited' ? 429 : 401
      
      return NextResponse.json({
        error: 'Authentication failed',
        message: authResult.errorMessage,
        violation_type: authResult.violationType,
        timestamp: new Date().toISOString()
      }, { status: statusCode })
    }

    // Create scheduler service with proper dependency injection
    const schedulerService = createSchedulerService()
    
    // Execute scheduled publishing using the new architecture
    const result = await schedulerService.executeScheduledPublishing()

    // Return successful result
    return NextResponse.json({
      message: `Successfully processed ${result.posts_processed} post(s), published ${result.posts_published}`,
      execution_id: result.execution_id,
      started_at: result.started_at,
      completed_at: result.completed_at,
      posts_processed: result.posts_processed,
      posts_published: result.posts_published,
      errors: result.errors,
      duration_ms: result.duration_ms,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    // Error isolation - catch any unhandled errors at the route level
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log the error with proper isolation
    try {
      logger.error('Scheduler route error', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
      })
    } catch (logError) {
      // Even logging errors should not crash the route
      console.error('Failed to log scheduler route error:', logError)
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during scheduler execution',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Export POST handler with new architecture
export const POST = schedulerHandler

export async function GET() {
  return NextResponse.json({ 
    message: 'Scheduler endpoint. Use POST with proper authorization to trigger publishing.',
    status: 'ready'
  })
}
