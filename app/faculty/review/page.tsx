'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type ReviewRecord = TableRow<'medical_records'> & {
  students: Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'> | null
}

export default function FacultyAdministrativeReviewPage() {
  const [records, setRecords] = useState<ReviewRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [forwardingId, setForwardingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadRecords = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('medical_records')
      .select('*, students(full_name, index_no, faculty)')
      .eq('lifecycle_status', 'active')
      .eq('workflow_stage', 'faculty_review')
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setRecords([])
    } else {
      setRecords((data || []).map(record => ({
        ...record,
        students: Array.isArray(record.students) ? record.students[0] || null : record.students,
      })))
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadRecords()

    const channel = supabase
      .channel('faculty-review-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => {
        void loadRecords()
      })
      .subscribe()

    const onFocus = () => { void loadRecords() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadRecords()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [loadRecords])

  const forwardToUmo = async (recordId: number) => {
    setForwardingId(recordId)
    setError('')
    setSuccessMsg('')
    const { error: forwardError } = await supabase.rpc('forward_medical_record_to_umo', {
      p_record_id: recordId,
      p_note: null,
    })
    setForwardingId(null)
    if (forwardError) {
      setError(forwardError.message)
      return
    }
    setSuccessMsg(`Medical record REC-${recordId} successfully forwarded to UMO review queue.`)
    setRecords(current => current.filter(record => record.record_id !== recordId))
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Faculty Administrative Review</h1>
          <p className="text-sm text-gray-500">Confirm receipt and forward submissions to the UMO for clinical evaluation.</p>
        </div>
        <button
          onClick={() => void loadRecords()}
          className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm w-fit"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">{error}</div>}
      {successMsg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="alert">{successMsg}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Record', 'Student', 'Faculty', 'Submitted', 'Action'].map(label => (
                  <th key={label} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-gray-400">No records are currently awaiting Faculty Administrative Review.</td></tr>
              ) : records.map(record => {
                const isExam = record.submission_type === 'exam'
                const courses: Array<{ course_code: string; exam_date: string }> = Array.isArray(record.exam_courses) ? (record.exam_courses as any) : []

                return (
                  <tr key={record.record_id} className="border-b border-gray-50 align-top">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 font-mono">REC-{record.record_id}</span>
                        {isExam ? (
                          <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-50 text-amber-900 rounded-full border border-amber-200">
                            Exam Medical
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                            General
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-800 font-medium">{record.purpose}</div>
                      {isExam && courses.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono">
                          {courses.map((c, idx) => (
                            <div key={idx}>{c.exam_date} – <strong>{c.course_code}</strong></div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-medium text-gray-800">{record.students?.full_name || 'Unknown student'}</div>
                      <div className="mt-1 text-xs text-gray-400 font-mono">{record.students?.index_no || 'No index number'}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">{record.students?.faculty || 'Applied Sciences'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 font-mono">{new Date(record.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/faculty/record-detail?id=${record.record_id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-blue-800 hover:text-blue-800">
                          View Details
                        </Link>
                        <button onClick={() => void forwardToUmo(record.record_id)} disabled={forwardingId === record.record_id}
                          className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50">
                          {forwardingId === record.record_id ? 'Forwarding...' : 'Forward to UMO'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
