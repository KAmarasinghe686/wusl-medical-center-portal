'use client'

import { useState } from 'react'
import Link from 'next/link'
import { csvTemplate } from '../../../lib/imports/csv'
import type { Json, TableRow } from '../../../lib/supabase/database.types'

type ImportKind = 'students' | 'staff'
type PreviewRow = {
  rowNumber: number
  data: Record<string, Json | undefined>
  errors: string[]
}
type ValidationResult = {
  valid: boolean
  totalRows: number
  validRows: number
  invalidRows: number
  rows: PreviewRow[]
}
type ImportResult = {
  job: TableRow<'onboarding_imports'>
  rows: TableRow<'onboarding_import_rows'>[]
}

const templates = {
  students: {
    name: 'student-import-template.csv',
    content: csvTemplate(
      ['index_no', 'full_name', 'email', 'faculty', 'academic_year', 'dob', 'gender', 'contact_no'],
      ['212345', 'Nimal Perera', 'nimal@university.lk', 'Applied Sciences', '2025', '2003-05-14', 'Male', '0712345678']
    ),
  },
  staff: {
    name: 'personnel-import-template.csv',
    content: csvTemplate(
      ['employee_index', 'full_name', 'email', 'role', 'specialisation'],
      ['WUSL/EMP/001', 'Jane Silva', 'jane@university.lk', 'worker', '']
    ),
  },
}

function statusClass(status: string) {
  if (status === 'invited' || status === 'completed') return 'text-emerald-700 bg-emerald-50'
  if (status === 'failed') return 'text-red-700 bg-red-50'
  if (status === 'skipped' || status === 'partial') return 'text-amber-700 bg-amber-50'
  return 'text-blue-700 bg-blue-50'
}

export default function BatchUserImport() {
  const [kind, setKind] = useState<ImportKind>('students')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ValidationResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForKind = (nextKind: ImportKind) => {
    setKind(nextKind)
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
  }

  const requestWithFile = async (url: string) => {
    if (!file) throw new Error('Choose a CSV file first.')
    const formData = new FormData()
    formData.set('file', file)
    const response = await fetch(url, { method: 'POST', body: formData })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'The import request failed.')
    return data
  }

  const validateFile = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setPreview(await requestWithFile(`/api/admin/import/${kind}/validate`))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to validate this file.')
    } finally {
      setLoading(false)
    }
  }

  const importFile = async () => {
    if (!preview?.valid) return
    setLoading(true)
    setError('')
    try {
      setResult(await requestWithFile(`/api/admin/import/${kind}`))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to import this file.')
    } finally {
      setLoading(false)
    }
  }

  const retryFailed = async () => {
    if (!result) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/invitations/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.job.job_id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to retry failed invitations.')
      setResult(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to retry failed invitations.')
    } finally {
      setLoading(false)
    }
  }

  const continueImport = async () => {
    if (!result) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/imports/${result.job.job_id}/process`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to continue this import.')
      setResult(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to continue this import.')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = templates[kind]
    const url = URL.createObjectURL(new Blob([template.content], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = template.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Batch User Onboarding</h1>
          <p className="text-sm text-gray-500">Validate CSV data before creating accounts and sending invitations.</p>
        </div>
        <Link href="/admin/users" className="text-xs text-blue-800 font-semibold hover:text-blue-600">
          Back to users
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex gap-2 mb-5">
          <button onClick={() => resetForKind('students')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${kind === 'students' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Student Batch
          </button>
          <button onClick={() => resetForKind('staff')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${kind === 'staff' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Personnel Batch
          </button>
        </div>

        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
          {kind === 'students'
            ? 'Applied Sciences indices must contain exactly six digits in 2x2xxx format. Example: 212345.'
            : 'Personnel roles may be worker, faculty, or doctor. Doctors must include a specialisation.'}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input type="file" accept=".csv,text/csv"
            onChange={event => {
              setFile(event.target.files?.[0] || null)
              setPreview(null)
              setResult(null)
              setError('')
            }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50" />
          <button onClick={downloadTemplate}
            className="border border-gray-200 px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
            Download Template
          </button>
          <button onClick={validateFile} disabled={!file || loading}
            className="bg-blue-800 text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
            {loading ? 'Working...' : 'Validate CSV'}
          </button>
        </div>
      </div>

      {error && <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

      {preview && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-5">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Validation Preview</h2>
              <p className="text-xs text-gray-500 mt-1">
                {preview.validRows} valid · {preview.invalidRows} invalid · {preview.totalRows} total
              </p>
            </div>
            <button onClick={importFile} disabled={!preview.valid || loading}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40">
              Confirm and Send Invitations
            </button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3">CSV Row</th>
                  <th className="text-left p-3">Identifier</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(row => (
                  <tr key={row.rowNumber} className="border-t border-gray-50">
                    <td className="p-3">{row.rowNumber}</td>
                    <td className="p-3 font-medium">{String(row.data.index_no || row.data.employee_index || '')}</td>
                    <td className="p-3">{String(row.data.full_name || '')}</td>
                    <td className="p-3">{String(row.data.email || '')}</td>
                    <td className={`p-3 ${row.errors.length ? 'text-red-600' : 'text-emerald-600'}`}>
                      {row.errors.length ? row.errors.join(' ') : 'Valid'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-800">Import Result</h2>
                <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${statusClass(result.job.status)}`}>
                  {result.job.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {result.job.successful_rows} invited · {result.job.skipped_rows} skipped · {result.job.failed_rows} failed ·{' '}
                {result.job.total_rows - result.job.successful_rows - result.job.skipped_rows - result.job.failed_rows} pending
              </p>
            </div>
            <div className="flex gap-2">
              {result.job.status === 'processing' && (
                <button onClick={continueImport} disabled={loading}
                  className="bg-blue-800 text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                  Process Next 20
                </button>
              )}
              {result.job.failed_rows > 0 && result.job.status !== 'processing' && (
                <button onClick={retryFailed} disabled={loading}
                  className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                  Retry Failed Invitations
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Row</th>
                  <th className="text-left p-3">Identifier</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map(row => (
                  <tr key={row.row_id} className="border-t border-gray-50">
                    <td className="p-3">{row.row_number}</td>
                    <td className="p-3 font-medium">{row.identifier}</td>
                    <td className="p-3">{row.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="p-3 text-gray-500">{row.error_message || 'Invitation sent.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
