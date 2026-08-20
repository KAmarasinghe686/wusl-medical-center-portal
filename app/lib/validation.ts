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

export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return false
  return new Date(`${startDate}T00:00:00Z`) <= new Date(`${endDate}T00:00:00Z`)
}

export function calculateLeaveDays(startDate: string, endDate: string): number {
  if (!isValidDateRange(startDate, endDate)) return 1
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(1, Math.round((end - start) / msPerDay) + 1)
}

export function extractBatchFromIndex(indexNo: string): string {
  const clean = (indexNo || '').trim()
  if (/^2\d2\d{3}$/.test(clean)) {
    const yearPrefix = clean.slice(0, 2)
    return `${yearPrefix} Batch`
  }
  return 'General'
}

export const VALID_MEDICAL_ISSUERS = [
  { value: 'umo', label: 'The University Medical Officer (UMO)' },
  { value: 'government_hospital', label: 'Medical Officer of a Government Medical Institute (Hospital / DMO)' },
  { value: 'private_hospital', label: 'Consultant / Specialist in SLMC from a Registered Private Hospital' },
  { value: 'consultant', label: 'Consultant / Specialist registered in the Sri Lanka Medical Council' },
  { value: 'general_practitioner', label: 'General Practitioner registered in the Sri Lanka Medical Council' },
  { value: 'ayurvedic', label: 'Ayurvedic Practitioner registered with Ayurvedic Medical Council' },
] as const

export type ExamCourseEntry = {
  course_code: string
  course_name: string
  exam_date: string
}

export function validateExamCourses(courses: unknown): ExamCourseEntry[] | string {
  if (!Array.isArray(courses) || courses.length === 0) {
    return 'At least one missed course unit must be listed for an Examination Medical.'
  }
  const validated: ExamCourseEntry[] = []
  for (const c of courses) {
    if (!c || typeof c !== 'object') return 'Invalid course unit entry.'
    const row = c as Record<string, unknown>
    const code = cleanText(row.course_code, 30).toUpperCase()
    const name = cleanText(row.course_name, 120)
    const date = cleanText(row.exam_date, 20)
    if (!code) return 'Course Unit No is required (e.g. CMIS 1131).'
    if (!name) return `Course title is required for ${code}.`
    if (!isIsoDate(date)) return `A valid exam date is required for ${code}.`
    validated.push({ course_code: code, course_name: name, exam_date: date })
  }
  return validated
}

export function isWithinSevenCalendarDays(
  illnessStartDate: string,
  submissionDate = new Date().toISOString().slice(0, 10)
): { withinDays: boolean; daysDifference: number } {
  if (!isIsoDate(illnessStartDate) || !isIsoDate(submissionDate)) {
    return { withinDays: true, daysDifference: 0 }
  }
  const start = new Date(`${illnessStartDate}T00:00:00Z`).getTime()
  const sub = new Date(`${submissionDate}T00:00:00Z`).getTime()
  const diffDays = Math.floor((sub - start) / (1000 * 60 * 60 * 24))
  return {
    withinDays: diffDays <= 7 && diffDays >= 0,
    daysDifference: diffDays,
  }
}

export function getCurrentAcademicYear(date = new Date()): string {
  const currentYear = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  // If in first half of year (Jan-June), current AY is (currentYear - 1)/currentYear
  // If in second half of year (July-Dec), current AY is currentYear/(currentYear + 1)
  if (month >= 7) {
    return `${currentYear}/${currentYear + 1}`
  }
  return `${currentYear - 1}/${currentYear}`
}

export function generateAcademicYears(count = 5, baseDate = new Date()): string[] {
  const currentAy = getCurrentAcademicYear(baseDate)
  const [startStr] = currentAy.split('/')
  const startYear = parseInt(startStr, 10) || baseDate.getFullYear()

  const list: string[] = []
  // Include next upcoming year + current + past count years
  for (let i = -1; i < count; i++) {
    const yr = startYear - i
    list.push(`${yr}/${yr + 1}`)
  }
  return list
}



