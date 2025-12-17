import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import { PostStatus } from '@/lib/types'
import { timezoneHandler } from '@/lib/timezone-handler'

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PostStatus | null

    const supabase = createServiceClient()

    // Get user's timezone preference
    const { data: userPrefs } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', payload.userId)
      .single()

    const userTimezone = userPrefs?.timezone || 'UTC'

    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', payload.userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: posts, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    // Convert UTC times to user timezone for display
    const postsWithUserTimezone = posts?.map(post => ({
      ...post,
      // Convert scheduled_at and published_at from UTC to user timezone for display
      scheduled_at_display: post.scheduled_at 
        ? timezoneHandler.convertFromUTC(post.scheduled_at, userTimezone)
        : null,
      published_at_display: post.published_at
        ? timezoneHandler.convertFromUTC(post.published_at, userTimezone)
        : null,
      created_at_display: timezoneHandler.convertFromUTC(post.created_at, userTimezone)
    })) || []

    return NextResponse.json({ posts: postsWithUserTimezone })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { content, status, scheduled_at, user_timezone } = await request.json()

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const postStatus: PostStatus = status || 'DRAFT'

    if (postStatus === 'SCHEDULED' && !scheduled_at) {
      return NextResponse.json(
        { error: 'Scheduled date is required for scheduled posts' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get user's timezone preference if not provided
    let effectiveTimezone = user_timezone
    if (!effectiveTimezone) {
      const { data: userPrefs } = await supabase
        .from('user_preferences')
        .select('timezone')
        .eq('user_id', payload.userId)
        .single()
      
      effectiveTimezone = userPrefs?.timezone || 'UTC'
    }

    // Validate timezone
    if (!timezoneHandler.validateTimezone(effectiveTimezone)) {
      return NextResponse.json({ error: 'Invalid timezone identifier' }, { status: 400 })
    }

    // Convert scheduled_at from user timezone to UTC for storage
    let utcScheduledAt = null
    let originalScheduledTime = null
    
    if (postStatus === 'SCHEDULED' && scheduled_at) {
      originalScheduledTime = scheduled_at
      utcScheduledAt = timezoneHandler.convertToUTC(scheduled_at, effectiveTimezone)
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: payload.userId,
        content,
        status: postStatus,
        scheduled_at: utcScheduledAt,
        user_timezone: effectiveTimezone,
        original_scheduled_time: originalScheduledTime
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    // Add display times for the response
    const postWithDisplayTimes = {
      ...post,
      scheduled_at_display: post.scheduled_at 
        ? timezoneHandler.convertFromUTC(post.scheduled_at, effectiveTimezone)
        : null,
      created_at_display: timezoneHandler.convertFromUTC(post.created_at, effectiveTimezone)
    }

    return NextResponse.json({ post: postWithDisplayTimes }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
