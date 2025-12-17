import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { JWTPayload } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const TOKEN_EXPIRY = '7d'

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function getTokenFromHeader(authorization: string | null): string | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null
  }
  return authorization.substring(7)
}
