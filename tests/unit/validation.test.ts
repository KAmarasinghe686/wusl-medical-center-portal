import { describe, expect, it } from 'vitest'
import {
  MAX_MEDICAL_FILE_SIZE,
  cleanText,
  isEmail,
  isIsoDate,
  isPastOrToday,
  safeFileName,
  validateAvailability,
  validateMedicalFile,
} from '../../app/lib/validation'

describe('shared validation', () => {
  it('normalizes bounded text', () => {
    expect(cleanText('  Medical Record  ', 20)).toBe('Medical Record')
    expect(cleanText('abcdef', 3)).toBe('abc')
    expect(cleanText(null, 10)).toBe('')
  })

  it('validates email and ISO calendar dates', () => {
    expect(isEmail('student@wusl.ac.lk')).toBe(true)
    expect(isEmail('invalid-address')).toBe(false)
    expect(isIsoDate('2026-07-26')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
  })

  it('rejects future medical dates', () => {
    const now = new Date('2026-07-26T12:00:00Z')
    expect(isPastOrToday('2026-07-26', now)).toBe(true)
    expect(isPastOrToday('2026-07-27', now)).toBe(false)
  })

  it('accepts only bounded medical documents', () => {
    expect(validateMedicalFile(new File(['report'], 'report.pdf', { type: 'application/pdf' }))).toBeNull()
    expect(validateMedicalFile(new File(['script'], 'script.html', { type: 'text/html' }))).toContain('only PDF')
    const tooLarge = new File([new Uint8Array(MAX_MEDICAL_FILE_SIZE + 1)], 'large.pdf', { type: 'application/pdf' })
    expect(validateMedicalFile(tooLarge)).toContain('10 MB')
  })

  it('sanitizes object names', () => {
    expect(safeFileName('../../My report (final).pdf')).toBe('My-report-final-.pdf')
  })

  it('validates availability as a unique ordered time range', () => {
    expect(validateAvailability([
      { day: 'Monday', available: true, startTime: '09:00', endTime: '17:00' },
    ])).toBeNull()
    expect(validateAvailability([
      { day: 'Monday', available: true, startTime: '17:00', endTime: '09:00' },
    ])).toContain('earlier')
    expect(validateAvailability([
      { day: 'Monday', available: false, startTime: '09:00', endTime: '17:00' },
      { day: 'Monday', available: false, startTime: '09:00', endTime: '17:00' },
    ])).toContain('only once')
  })
})
