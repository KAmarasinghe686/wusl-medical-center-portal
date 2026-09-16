'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import type { ExamCourseEntry } from '../../lib/validation'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty' | 'academic_year' | 'contact_no'>
type AdvanceNoticeWithStudent = TableRow<'advance_medical_notices'> & {
  students: StudentSummary | null
}

export default function DeanAdvanceNoticesPage() {
  const [notices, setNotices] = useState<AdvanceNoticeWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'medical_submitted'>('all')
  const [search, setSearch] = useState('')
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null)

  const fetchNotices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('advance_medical_notices')
      .select('*, students(full_name, index_no, faculty, academic_year, contact_no)')
      .order('created_at', { ascending: false })

    setNotices((data || []).map(n => ({
      ...n,
      students: Array.isArray(n.students) ? n.students[0] || null : n.students,
    })))
    setLoading(false)
  }

  useEffect(() => {
    void fetchNotices()
  }, [])

  const handleAcknowledge = async (noticeId: number) => {
    setAcknowledgingId(noticeId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('advance_medical_notices')
      .update({
        status: 'acknowledged',
        acknowledged_by: user?.id || null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('notice_id', noticeId)

    setAcknowledgingId(null)
    void fetchNotices()
  }

  const filtered = notices.filter(n => {
    const matchesSearch =
      (n.students?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (n.students?.index_no || '').toLowerCase().includes(search.toLowerCase()) ||
      n.reason.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (filter === 'pending') return n.status === 'pending'
    if (filter === 'medical_submitted') return n.status === 'medical_submitted'
    return true
  })

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Advance Medical Notices (Dean's Register)</h1>
          <p className="text-sm text-gray-500">
            Early illness intimations submitted by students prior to physical medical certificate issuance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dean/letters"
            className="border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            ← View Submitted Letters
          </Link>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'all' ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Intimations ({notices.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'pending' ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Awaiting Physical Medical ({notices.filter(n => n.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('medical_submitted')}
            className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'medical_submitted' ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Medical Certificate Linked ({notices.filter(n => n.status === 'medical_submitted').length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by student name, index..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full sm:w-72 shadow-sm"
        />
      </div>

      {/* Notices Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading advance intimations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400">No advance medical notices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Ref #</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Absence Type</th>
                  <th className="py-2.5 px-4">Illness Period</th>
                  <th className="py-2.5 px-4">Treatment & Hospital</th>
                  <th className="py-2.5 px-4">Reason / Symptoms</th>
                  <th className="py-2.5 px-4">Notice Timestamp</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(notice => {
                  const courses: ExamCourseEntry[] = Array.isArray(notice.affected_courses)
                    ? (notice.affected_courses as unknown as ExamCourseEntry[])
                    : []

                  return (
                    <tr key={notice.notice_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                        ADV-{notice.notice_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{notice.students?.full_name}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {notice.students?.index_no} · {notice.students?.faculty || 'Applied Sciences'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          notice.submission_type === 'exam'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {notice.submission_type === 'exam' ? 'Exam Absence' : 'Coursework'}
                        </span>
                        {courses.length > 0 && (
                          <div className="text-[10px] text-gray-500 mt-1 font-mono">
                            {courses.map(c => c.course_code).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-700">
                        <div>{notice.illness_start_date}</div>
                        {notice.expected_end_date && (
                          <div className="text-[10px] text-gray-400">to {notice.expected_end_date}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        <div className="font-medium">{notice.treatment_status || 'Resting at Home'}</div>
                        {notice.hospital_name && (
                          <div className="text-[10px] text-gray-500">{notice.hospital_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 max-w-[200px] truncate" title={notice.reason}>
                        {notice.reason}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-gray-500 font-mono">
                        {new Date(notice.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          notice.status === 'medical_submitted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : notice.status === 'acknowledged'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {notice.status === 'medical_submitted'
                            ? 'Medical Certificate Linked'
                            : notice.status === 'acknowledged'
                            ? 'Acknowledged'
                            : 'Early Notice On Record'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {notice.status === 'pending' && (
                          <button
                            onClick={() => handleAcknowledge(notice.notice_id)}
                            disabled={acknowledgingId === notice.notice_id}
                            className="px-2.5 py-1 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {acknowledgingId === notice.notice_id ? 'Noting...' : 'Acknowledge'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
