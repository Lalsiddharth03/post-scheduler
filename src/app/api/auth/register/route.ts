import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { hashPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email, password_hash: passwordHash })
      .select('id, name, email')
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    })

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      token
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
