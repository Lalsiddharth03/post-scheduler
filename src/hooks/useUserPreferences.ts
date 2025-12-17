import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserPreferences } from '@/lib/types'

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { token } = useAuth()

  const fetchPreferences = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/preferences', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreferences(data.preferences)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preferences')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  async function updateTimezone(timezone: string) {
    if (!token) throw new Error('Not authenticated')
    const res = await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ timezone })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setPreferences(data.preferences)
    return data.preferences
  }

  return { 
    preferences, 
    loading, 
    error, 
    fetchPreferences, 
    updateTimezone,
    userTimezone: preferences?.timezone || 'UTC'
  }
}