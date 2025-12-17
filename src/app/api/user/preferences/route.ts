import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
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

    const supabase = createServiceClient()

    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', payload.userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    // If no preferences found, return default UTC
    if (!preferences) {
      return NextResponse.json({ 
        preferences: { 
          user_id: payload.userId, 
          timezone: 'UTC' 
        } 
      })
    }

    return NextResponse.json({ preferences })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { timezone } = await request.json()

    if (!timezone) {
      return NextResponse.json({ error: 'Timezone is required' }, { status: 400 })
    }

    // Validate timezone using TimezoneHandler
    if (!timezoneHandler.validateTimezone(timezone)) {
      return NextResponse.json({ error: 'Invalid timezone identifier' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Use upsert to handle both insert and update cases
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: payload.userId,
        timezone,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ preferences })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}