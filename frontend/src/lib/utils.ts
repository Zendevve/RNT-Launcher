import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines Tailwind and conditional class names safely.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats raw byte size into human-readable binary unit string (e.g. "14.2 MB").
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, sizes.length - 1)
  const val = parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))
  return `${val} ${sizes[idx]}`
}

/**
 * Formats duration in milliseconds into a concise readable string (e.g. "1h 24m 10s", "45s", "0s").
 */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s'
  
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 1) {
    return '< 1s'
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Formats an ISO date string or timestamp into a consistent display date (e.g. "2026-08-29 14:30").
 */
export function formatDate(isoString?: string | number | Date | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return '-'

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * Formats an ISO date string or timestamp into a relative time string (e.g. "just now", "5m ago", "2h ago").
 */
export function formatTimeAgo(isoString?: string | number | Date | null): string {
  if (!isoString) return 'never'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return 'never'

  const now = Date.now()
  const diffMs = now - d.getTime()
  if (diffMs < 0) return 'just now'

  const sec = Math.floor(diffMs / 1000)
  if (sec < 45) return 'just now'
  
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`

  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`

  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`

  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mo ago`

  const yr = Math.floor(month / 12)
  return `${yr}y ago`
}
