import { timezoneHandler } from './timezone-handler'

/**
 * Formats a UTC datetime string for display in a specific timezone
 * @param utcDateTime - UTC datetime string
 * @param timezone - IANA timezone identifier
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted datetime string
 */
export function formatDateInTimezone(
  utcDateTime: string, 
  timezone: string, 
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = new Date(utcDateTime)
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      ...options
    }

    return new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: timezone
    }).format(date)
  } catch (error) {
    console.error('Error formatting date in timezone:', error)
    return new Date(utcDateTime).toLocaleString()
  }
}

/**
 * Gets the current date and time in a specific timezone
 * @param timezone - IANA timezone identifier
 * @returns Current datetime formatted for the timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  return formatDateInTimezone(new Date().toISOString(), timezone)
}

/**
 * Converts a local datetime input to UTC for storage
 * @param localDateTime - Local datetime string (from input)
 * @param timezone - User's timezone
 * @returns UTC datetime string for storage
 */
export function convertLocalToUTC(localDateTime: string, timezone: string): string {
  return timezoneHandler.convertToUTC(localDateTime, timezone)
}

/**
 * Converts a UTC datetime to local time for display
 * @param utcDateTime - UTC datetime string from database
 * @param timezone - User's timezone for display
 * @returns Local datetime string for display
 */
export function convertUTCToLocal(utcDateTime: string, timezone: string): string {
  return timezoneHandler.convertFromUTC(utcDateTime, timezone)
}

/**
 * Gets a user-friendly relative time string
 * @param utcDateTime - UTC datetime string
 * @param timezone - User's timezone
 * @returns Relative time string (e.g., "in 2 hours", "3 days ago")
 */
export function getRelativeTime(utcDateTime: string, timezone: string): string {
  try {
    const date = new Date(utcDateTime)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMinutes = Math.round(diffMs / (1000 * 60))
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (Math.abs(diffMinutes) < 1) {
      return 'now'
    } else if (Math.abs(diffMinutes) < 60) {
      return diffMinutes > 0 ? `in ${diffMinutes} minutes` : `${Math.abs(diffMinutes)} minutes ago`
    } else if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours} hours` : `${Math.abs(diffHours)} hours ago`
    } else if (Math.abs(diffDays) < 7) {
      return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`
    } else {
      return formatDateInTimezone(utcDateTime, timezone, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  } catch (error) {
    console.error('Error calculating relative time:', error)
    return formatDateInTimezone(utcDateTime, timezone)
  }
}