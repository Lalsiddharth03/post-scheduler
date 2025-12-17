export type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'

export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  status: PostStatus
  scheduled_at: string | null  // Always stored in UTC
  published_at: string | null  // Always stored in UTC
  created_at: string          // Always stored in UTC
  user_timezone: string | null // IANA timezone identifier
  original_scheduled_time: string | null // User's original input for reference
}

export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface JWTPayload {
  userId: string
  email: string
  name: string
}
export interface UserPreferences {
  user_id: string
  timezone: string // IANA timezone identifier (e.g., 'America/New_York')
  created_at: string
  updated_at: string
}

export interface SchedulerMetrics {
  execution_id: string
  started_at: string
  completed_at: string
  posts_processed: number
  posts_published: number
  errors_encountered: number
  execution_duration_ms: number
}

export interface CreatePostRequest {
  content: string
  status: PostStatus
  scheduled_at?: string | null
  user_timezone?: string | null
  original_scheduled_time?: string | null
}

export interface UpdatePostRequest {
  content?: string
  status?: PostStatus
  scheduled_at?: string | null
  published_at?: string | null
  user_timezone?: string | null
  original_scheduled_time?: string | null
}

export interface ScheduledPost extends Post {
  status: 'SCHEDULED'
  scheduled_at: string
}

export interface PublishResult {
  success: boolean
  published_count: number
  post_ids: string[]
  errors: string[]
}

export interface SchedulerResult {
  execution_id: string
  started_at: string
  completed_at: string
  posts_processed: number
  posts_published: number
  errors: string[]
  duration_ms: number
}

export interface SecurityValidationResult {
  isValid: boolean
  securityViolation: boolean
  errorMessage?: string
  violationType?: SecurityViolationType
  loggedAt?: string
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