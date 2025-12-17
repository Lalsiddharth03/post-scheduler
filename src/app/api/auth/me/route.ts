import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        name: payload.name,
        email: payload.email
      }
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
