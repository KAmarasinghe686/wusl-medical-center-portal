'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty' | 'academic_year'>
type DeanRecord = TableRow<'medical_records'> & {
  students: StudentSummary | null
}

const PER_PAGE = 8

export default function DeanAllRecordsPage() {
  const [records, setRecords] = useState<DeanRecord[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecords = async () => {
      const { data } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty, academic_year)')
        .eq('lifecycle_status', 'active')
        .order('created_at', { ascending: false })

      setRecords((data || []).map(r => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] || null : r.students,
      })))
      setLoading(false)
    }

    void fetchRecords()
  }, [])

  const filtered = records.filter(r => {
    const matchesSearch =
      (r.students?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.students?.index_no || '').toLowerCase().includes(search.toLowerCase()) ||
      r.purpose.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (statusFilter === 'approved') return r.status === 'approved'
    if (statusFilter === 'pending') return r.status === 'pending'
    if (statusFilter === 'rejected') return r.status === 'rejected'
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Health & Absence Archive</h1>
          <p className="text-sm text-gray-500">
            Complete institutional medical records repository for Faculty of Applied Sciences.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search by student name or index..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full sm:w-72 shadow-sm"
        />
      </div>

      {/* Toolbar / Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'approved', 'pending', 'rejected'].map(st => (
          <button
            key={st}
            onClick={() => { setStatusFilter(st); setPage(1) }}
            className={`text-xs px-4 py-2 rounded-lg font-semibold capitalize transition-colors ${
              statusFilter === st
                ? 'bg-blue-800 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {st} ({st === 'all' ? records.length : records.filter(r => r.status === st).length})
          </button>
        ))}
      </div>

      {/* Records Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400">No medical records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Record ID</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Type & Purpose</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Doctor / Issuer</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(r => (
                  <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">REC-{r.record_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{r.students?.full_name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{r.students?.index_no}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.submission_type === 'exam'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {r.submission_type === 'exam' ? 'Exam' : 'Coursework'}
                      </span>
                      <div className="text-gray-700 mt-0.5">{r.purpose}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-mono text-[11px]">
                      <div>{r.leave_start_date || r.issue_date}</div>
                      <div className="text-[10px] text-gray-400">({r.leave_days_count || 1} d)</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      <div>{r.doctor_name || 'Registered Doctor'}</div>
                      <div className="text-[10px] text-gray-400 capitalize">{r.issuer_type?.replace(/_/g, ' ') || 'Authorized Hospital'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
              <span className="text-xs text-gray-500">
                Showing {Math.min(filtered.length, (page - 1) * PER_PAGE + 1)} - {Math.min(filtered.length, page * PER_PAGE)} of {filtered.length} records (Page {page} of {totalPages})
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
