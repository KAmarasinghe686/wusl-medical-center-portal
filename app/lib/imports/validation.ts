import {
  cleanText,
  isAppliedScienceStudentIndex,
  isEmail,
  isIsoDate,
} from '../validation'
import type { CsvRow } from './csv'

export type StudentImportData = {
  index_no: string
  full_name: string
  email: string
  faculty: string
  academic_year: string | null
  dob: string | null
  gender: string | null
  contact_no: string | null
}

export type PersonnelRole = 'worker' | 'faculty' | 'doctor'

export type PersonnelImportData = {
  employee_index: string
  full_name: string
  email: string
  role: PersonnelRole
  specialisation: string | null
}

export type ValidatedImportRow<T> = {
  rowNumber: number
  data: T
  errors: string[]
}

function duplicateErrors<T>(
  rows: ValidatedImportRow<T>[],
  selector: (row: ValidatedImportRow<T>) => string,
  label: string
) {
  const occurrences = new Map<string, number[]>()
  rows.forEach(row => {
    const value = selector(row).toLowerCase()
    if (!value) return
    occurrences.set(value, [...(occurrences.get(value) || []), row.rowNumber])
  })
  occurrences.forEach(rowNumbers => {
    if (rowNumbers.length < 2) return
    rows.forEach(row => {
      if (rowNumbers.includes(row.rowNumber)) row.errors.push(`Duplicate ${label} in this file.`)
    })
  })
}

export function validateStudentImportRows(rows: CsvRow[]): ValidatedImportRow<StudentImportData>[] {
  const validated = rows.map(({ rowNumber, values }) => {
    const indexNo = cleanText(values.index_no, 80)
    const fullName = cleanText(values.full_name, 120)
    const email = cleanText(values.email, 254).toLowerCase()
    const dob = cleanText(values.dob, 10)
    const errors: string[] = []

    if (!isAppliedScienceStudentIndex(indexNo)) {
      errors.push('Index must be six digits in Applied Sciences format 2x2xxx.')
    }
    if (!fullName) errors.push('Full name is required.')
    if (!isEmail(email)) errors.push('A valid real email address is required.')
    if (dob && !isIsoDate(dob)) errors.push('Date of birth must use YYYY-MM-DD.')

    return {
      rowNumber,
      data: {
        index_no: indexNo,
        full_name: fullName,
        email,
        faculty: cleanText(values.faculty, 120) || 'Applied Sciences',
        academic_year: cleanText(values.academic_year, 30) || null,
        dob: dob || null,
        gender: cleanText(values.gender, 30) || null,
        contact_no: cleanText(values.contact_no, 30) || null,
      },
      errors,
    }
  })

  duplicateErrors(validated, row => row.data.index_no, 'student index')
  duplicateErrors(validated, row => row.data.email, 'email')
  return validated
}

export function validatePersonnelImportRows(rows: CsvRow[]): ValidatedImportRow<PersonnelImportData>[] {
  const validated = rows.map(({ rowNumber, values }) => {
    const employeeIndex = cleanText(values.employee_index, 80)
    const fullName = cleanText(values.full_name, 120)
    const email = cleanText(values.email, 254).toLowerCase()
    const roleValue = cleanText(values.role, 20).toLowerCase()
    const role = roleValue as PersonnelRole
    const errors: string[] = []

    if (!employeeIndex) errors.push('Employee index is required.')
    if (!fullName) errors.push('Full name is required.')
    if (!isEmail(email)) errors.push('A valid real email address is required.')
    if (!['worker', 'faculty', 'doctor'].includes(roleValue)) {
      errors.push('Role must be worker, faculty, or doctor.')
    }
    if (roleValue === 'doctor' && !cleanText(values.specialisation, 120)) {
      errors.push('Doctor specialisation is required.')
    }

    return {
      rowNumber,
      data: {
        employee_index: employeeIndex,
        full_name: fullName,
        email,
        role,
        specialisation: cleanText(values.specialisation, 120) || null,
      },
      errors,
    }
  })

  duplicateErrors(validated, row => row.data.employee_index, 'employee index')
  duplicateErrors(validated, row => row.data.email, 'email')
  return validated
}

export function publicValidationResult<T>(rows: ValidatedImportRow<T>[]) {
  return {
    valid: rows.every(row => row.errors.length === 0),
    totalRows: rows.length,
    validRows: rows.filter(row => row.errors.length === 0).length,
    invalidRows: rows.filter(row => row.errors.length > 0).length,
    rows,
  }
}
