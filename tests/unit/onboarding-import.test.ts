import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../app/lib/imports/csv'
import {
  validatePersonnelImportRows,
  validateStudentImportRows,
} from '../../app/lib/imports/validation'
import { isAppliedScienceStudentIndex } from '../../app/lib/validation'

describe('batch onboarding imports', () => {
  it('accepts only six-digit Applied Sciences indices in 2x2xxx format', () => {
    expect(isAppliedScienceStudentIndex('212345')).toBe(true)
    expect(isAppliedScienceStudentIndex('292000')).toBe(true)
    expect(isAppliedScienceStudentIndex('112345')).toBe(false)
    expect(isAppliedScienceStudentIndex('213456')).toBe(false)
    expect(isAppliedScienceStudentIndex('21234')).toBe(false)
    expect(isAppliedScienceStudentIndex('2A2345')).toBe(false)
  })

  it('parses quoted CSV fields and normalized headers', () => {
    const parsed = parseCsv(
      'Index No,Full Name,Email\r\n212345,"Perera, Nimal",nimal@example.com\r\n'
    )
    expect(parsed.headers).toEqual(['index_no', 'full_name', 'email'])
    expect(parsed.rows[0]).toEqual({
      rowNumber: 2,
      values: {
        index_no: '212345',
        full_name: 'Perera, Nimal',
        email: 'nimal@example.com',
      },
    })
  })

  it('reports malformed student rows and duplicates before import', () => {
    const parsed = parseCsv(
      [
        'index_no,full_name,email,dob',
        '212345,Nimal,nimal@example.com,2003-05-14',
        '212345,Another,nimal@example.com,2003-02-30',
      ].join('\n')
    )
    const rows = validateStudentImportRows(parsed.rows)
    expect(rows[0].errors).toContain('Duplicate student index in this file.')
    expect(rows[0].errors).toContain('Duplicate email in this file.')
    expect(rows[1].errors).toContain('Date of birth must use YYYY-MM-DD.')
  })

  it('requires controlled personnel roles and doctor specialisation', () => {
    const parsed = parseCsv(
      [
        'employee_index,full_name,email,role,specialisation',
        'EMP-1,Doctor Silva,doctor@example.com,doctor,',
        'EMP-2,Unknown User,user@example.com,student,',
      ].join('\n')
    )
    const rows = validatePersonnelImportRows(parsed.rows)
    expect(rows[0].errors).toContain('Doctor specialisation is required.')
    expect(rows[1].errors).toContain('Role must be worker, faculty, or doctor.')
  })
})
