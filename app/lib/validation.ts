import type { PatientType, RecordStatus, UserRole } from './supabase/database.types'

export const ALLOWED_MEDICAL_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
])

export const MAX_MEDICAL_FILE_SIZE = 10 * 1024 * 1024
export const MAX_MEDICAL_FILES = 5
export const APPLIED_SCIENCE_INDEX_PATTERN = /^2\d2\d{3}$/

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function optionalText(value: unknown, maxLength: number): string | null {
  const cleaned = cleanText(value, maxLength)
  return cleaned || null
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isPastOrToday(value: string, now = new Date()): boolean {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return new Date(`${value}T00:00:00Z`) <= today
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isAppliedScienceStudentIndex(value: unknown): value is string {
  return typeof value === 'string' && APPLIED_SCIENCE_INDEX_PATTERN.test(value.trim())
}

export function isUserRole(value: unknown): value is Exclude<UserRole, 'unassigned'> {
  return value === 'student' ||
    value === 'doctor' ||
    value === 'worker' ||
    value === 'faculty' ||
    value === 'admin'
}

export function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected'
}

export function isPatientType(value: unknown): value is PatientType {
  return value === 'Student' || value === 'Employee'
}

export function validateMedicalFile(file: File): string | null {
  if (!ALLOWED_MEDICAL_FILE_TYPES.has(file.type)) {
    return `${file.name}: only PDF, JPG, and PNG files are allowed.`
  }
  if (file.size <= 0 || file.size > MAX_MEDICAL_FILE_SIZE) {
    return `${file.name}: files must be between 1 byte and 10 MB.`
  }
  return null
}

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+/g, '')
    .replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 120) || 'document'
}

export type AvailabilityEntry = {
  day: string
  available: boolean
  startTime: string
  endTime: string
}

const VALID_DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])

export function validateAvailability(entries: AvailabilityEntry[]): string | null {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (!VALID_DAYS.has(entry.day) || seen.has(entry.day)) return 'Each valid weekday can appear only once.'
    seen.add(entry.day)
    if (!/^\d{2}:\d{2}$/.test(entry.startTime) || !/^\d{2}:\d{2}$/.test(entry.endTime)) {
      return `Invalid time for ${entry.day}.`
    }
    if (entry.available && entry.startTime >= entry.endTime) {
      return `Start time must be earlier than end time for ${entry.day}.`
    }
  }
  return null
}
