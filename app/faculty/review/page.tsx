'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type ReviewRecord = TableRow<'medical_records'> & {
  students: Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'> | null
}

export default function FacultyAdministrativeReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading Faculty Review Queue...</div>}>
      <FacultyAdministrativeReviewContent />
    </Suspense>
  )
}

function FacultyAdministrativeReviewContent() {
  const [records, setRecords] = useState<ReviewRecord[]>([])
  const [filterType, setFilterType] = useState<'all' | 'general' | 'exam'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_faculty' | 'in_review' | 'approved' | 'rejected'>('all')
  const [loading, setLoading] = useState(true)
  const [forwardingId, setForwardingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam === 'general' || typeParam === 'exam') {
      setFilterType(typeParam)
    }
  }, [searchParams])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('medical_records')
      .select('*, students(full_name, index_no, faculty)')
      .eq('lifecycle_status', 'active')
      .order('created_at', { ascending: false })

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
    setRecords(current =>
      current.map(record =>
        record.record_id === recordId ? { ...record, workflow_stage: 'umo_review' } : record
      )
    )
  }

  const generalCount = useMemo(() => records.filter(r => r.submission_type !== 'exam').length, [records])
  const examCount = useMemo(() => records.filter(r => r.submission_type === 'exam').length, [records])

  const pendingFacultyCount = useMemo(() => records.filter(r => r.workflow_stage === 'faculty_review').length, [records])
  const inReviewCount = useMemo(() => records.filter(r => r.workflow_stage === 'umo_review' || r.workflow_stage === 'faculty_board').length, [records])
  const approvedCount = useMemo(() => records.filter(r => r.status === 'approved').length, [records])
  const rejectedCount = useMemo(() => records.filter(r => r.status === 'rejected').length, [records])

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Type Filter
      if (filterType === 'general' && r.submission_type === 'exam') return false
      if (filterType === 'exam' && r.submission_type !== 'exam') return false

      // Status Filter
      if (statusFilter === 'pending_faculty') return r.workflow_stage === 'faculty_review'
      if (statusFilter === 'in_review') return r.workflow_stage === 'umo_review' || r.workflow_stage === 'faculty_board'
      if (statusFilter === 'approved') return r.status === 'approved'
      if (statusFilter === 'rejected') return r.status === 'rejected'

      return true
    })
  }, [records, filterType, statusFilter])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Faculty Administrative Review</h1>
          <p className="text-sm text-gray-500">Track all incoming submissions, forward to UMO, and monitor ratification status.</p>
        </div>
        <button
          onClick={() => void loadRecords()}
          className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm w-fit cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter Section: Desk & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        {/* Desk Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-blue-800 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Desks ({records.length})
          </button>
          <button
            onClick={() => setFilterType('general')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'general'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Coursework & Lectures ({generalCount})
          </button>
          <button
            onClick={() => setFilterType('exam')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'exam'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Examination Absence ({examCount})
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({records.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending_faculty')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'pending_faculty' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Awaiting Action ({pendingFacultyCount})
          </button>
          <button
            onClick={() => setStatusFilter('in_review')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'in_review' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            In UMO/FB Review ({inReviewCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'approved' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'rejected' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">{error}</div>}
      {successMsg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="alert">{successMsg}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Record', 'Student', 'Status / Stage', 'Faculty', 'Submitted', 'Action'].map(label => (
                  <th key={label} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">No medical records match the selected review filters.</td></tr>
              ) : filteredRecords.map(record => {
                const isExam = record.submission_type === 'exam'
                const courses: Array<{ course_code: string; exam_date: string }> = Array.isArray(record.exam_courses) ? (record.exam_courses as any) : []
                const isPendingFaculty = record.workflow_stage === 'faculty_review'

                return (
                  <tr key={record.record_id} className="border-b border-gray-50 align-top hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {record.advance_notice_id ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Early Notice on Record
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                            No Advance Notice
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
                    <td className="px-5 py-4">
                      {record.status === 'approved' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                          {record.faculty_board_memo_no && (
                            <div className="text-[11px] font-mono text-gray-500">{record.faculty_board_memo_no}</div>
                          )}
                        </div>
                      ) : record.status === 'rejected' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          Rejected
                        </span>
                      ) : record.workflow_stage === 'faculty_review' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Awaiting Faculty Review
                        </span>
                      ) : record.workflow_stage === 'umo_review' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          In UMO Review
                        </span>
                      ) : record.workflow_stage === 'faculty_board' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          Faculty Board Schedule
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {record.status}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">{record.students?.faculty || 'Applied Sciences'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 font-mono">{new Date(record.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/faculty/record-detail?id=${record.record_id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-blue-800 hover:text-blue-800 transition-colors">
                          View Details
                        </Link>
                        {isPendingFaculty && (
                          <button onClick={() => void forwardToUmo(record.record_id)} disabled={forwardingId === record.record_id}
                            className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition-colors cursor-pointer">
                            {forwardingId === record.record_id ? 'Forwarding...' : 'Forward to UMO'}
                          </button>
                        )}
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
