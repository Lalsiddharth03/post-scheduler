import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import { PostStatus } from '@/lib/types'
import { timezoneHandler } from '@/lib/timezone-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's timezone preference
    const { data: userPrefs } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', payload.userId)
      .single()

    const userTimezone = userPrefs?.timezone || 'UTC'

    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', payload.userId)
      .single()

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Add display times converted to user timezone
    const postWithDisplayTimes = {
      ...post,
      scheduled_at_display: post.scheduled_at 
        ? timezoneHandler.convertFromUTC(post.scheduled_at, userTimezone)
        : null,
      published_at_display: post.published_at
        ? timezoneHandler.convertFromUTC(post.published_at, userTimezone)
        : null,
      created_at_display: timezoneHandler.convertFromUTC(post.created_at, userTimezone)
    }

    return NextResponse.json({ post: postWithDisplayTimes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    const { data: existingPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', payload.userId)
      .single()

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (existingPost.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot edit published posts' },
        { status: 400 }
      )
    }

    const { content, status, scheduled_at, user_timezone } = await request.json()
    const postStatus: PostStatus = status || existingPost.status

    if (postStatus === 'SCHEDULED' && !scheduled_at) {
      return NextResponse.json(
        { error: 'Scheduled date is required for scheduled posts' },
        { status: 400 }
      )
    }

    // Get effective timezone
    let effectiveTimezone = user_timezone || existingPost.user_timezone
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
    let utcScheduledAt = existingPost.scheduled_at
    let originalScheduledTime = existingPost.original_scheduled_time
    
    if (postStatus === 'SCHEDULED' && scheduled_at) {
      originalScheduledTime = scheduled_at
      utcScheduledAt = timezoneHandler.convertToUTC(scheduled_at, effectiveTimezone)
    } else if (postStatus !== 'SCHEDULED') {
      utcScheduledAt = null
      originalScheduledTime = null
    }

    const { data: post, error } = await supabase
      .from('posts')
      .update({
        content: content || existingPost.content,
        status: postStatus,
        scheduled_at: utcScheduledAt,
        user_timezone: effectiveTimezone,
        original_scheduled_time: originalScheduledTime
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
    }

    // Add display times for the response
    const postWithDisplayTimes = {
      ...post,
      scheduled_at_display: post.scheduled_at 
        ? timezoneHandler.convertFromUTC(post.scheduled_at, effectiveTimezone)
        : null,
      published_at_display: post.published_at
        ? timezoneHandler.convertFromUTC(post.published_at, effectiveTimezone)
        : null,
      created_at_display: timezoneHandler.convertFromUTC(post.created_at, effectiveTimezone)
    }

    return NextResponse.json({ post: postWithDisplayTimes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    const { data: existingPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', payload.userId)
      .single()

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (existingPost.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot delete published posts' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
