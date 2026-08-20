'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useDoctor } from '../hooks/useDoctor'

type MedicalRecord = {
  record_id: number
  purpose: string
  issue_date: string
  leave_start_date?: string | null
  leave_end_date?: string | null
  leave_days_count?: number | null
  status: string
  workflow_stage?: string | null
  created_at: string
  students: { full_name: string; index_no: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function AssignedRecords() {
  const { doctor, loading: doctorLoading, supabase } = useDoctor()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [search, setSearch] = useState('')
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [tabFilter, setTabFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const doctorId = doctor?.doctor_id

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true)
    let query = supabase
      .from('medical_records')
      .select('*, students(full_name, index_no)')
      .eq('lifecycle_status', 'active')

    if (doctorId) {
      query = query.or(`status.eq.pending,reviewed_by.eq.${doctorId}`)
    } else {
      query = query.eq('status', 'pending')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      setRecordsError(error.message)
    } else {
      setRecords(
        (data || []).map(r => ({
          ...r,
          students: Array.isArray(r.students) ? r.students[0] || null : r.students,
        }))
      )
      setRecordsError('')
    }
    setRecordsLoading(false)
  }, [doctorId, supabase])

  useEffect(() => {
    void fetchRecords()

    const channel = supabase
      .channel('doctor-records-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => {
        void fetchRecords()
      })
      .subscribe()

    const onFocus = () => { void fetchRecords() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchRecords()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [fetchRecords, supabase])

  const filtered = records.filter(r => {
    const matchesSearch =
      r.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.students?.index_no?.toLowerCase().includes(search.toLowerCase()) ||
      r.purpose?.toLowerCase().includes(search.toLowerCase())

    const matchesTab =
      tabFilter === 'all' ? true : r.status === tabFilter

    return matchesSearch && matchesTab
  })

  const pendingCount = records.filter(r => r.status === 'pending').length
  const approvedCount = records.filter(r => r.status === 'approved').length
  const rejectedCount = records.filter(r => r.status === 'rejected').length

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Clinical Review Queue</h1>
          <p className="text-sm text-gray-500">Student medical submissions awaiting clinical evaluation and decision.</p>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Search student or record..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 flex-1 sm:w-64 shadow-sm"
          />
          <button
            onClick={() => void fetchRecords()}
            className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap"
            title="Refresh queue"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards & Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setTabFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all ${tabFilter === 'all' ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-white border-gray-100 text-gray-900 hover:border-gray-300'}`}
        >
          <div className={`text-xs font-semibold uppercase ${tabFilter === 'all' ? 'text-blue-100' : 'text-gray-400'}`}>Total Records</div>
          <div className="text-2xl font-bold mt-1">{records.length}</div>
        </button>
        <button
          onClick={() => setTabFilter('pending')}
          className={`p-4 rounded-xl border text-left transition-all ${tabFilter === 'pending' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white border-gray-100 text-gray-900 hover:border-gray-300'}`}
        >
          <div className={`text-xs font-semibold uppercase ${tabFilter === 'pending' ? 'text-amber-100' : 'text-amber-600'}`}>Awaiting Review</div>
          <div className="text-2xl font-bold mt-1 text-amber-900 group-hover:text-white">{pendingCount}</div>
        </button>
        <button
          onClick={() => setTabFilter('approved')}
          className={`p-4 rounded-xl border text-left transition-all ${tabFilter === 'approved' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white border-gray-100 text-gray-900 hover:border-gray-300'}`}
        >
          <div className={`text-xs font-semibold uppercase ${tabFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-600'}`}>Approved</div>
          <div className="text-2xl font-bold mt-1">{approvedCount}</div>
        </button>
        <button
          onClick={() => setTabFilter('rejected')}
          className={`p-4 rounded-xl border text-left transition-all ${tabFilter === 'rejected' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white border-gray-100 text-gray-900 hover:border-gray-300'}`}
        >
          <div className={`text-xs font-semibold uppercase ${tabFilter === 'rejected' ? 'text-red-100' : 'text-red-600'}`}>Rejected</div>
          <div className="text-2xl font-bold mt-1">{rejectedCount}</div>
        </button>
      </div>

      {recordsError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center justify-between">
          <span>{recordsError}</span>
          <button onClick={() => void fetchRecords()} className="underline font-semibold ml-2">Retry</button>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Duration</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {recordsLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-400">Loading review queue...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                    {search ? 'No matching records found.' : 'No medical records found in this view.'}
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const durationStr = r.leave_start_date
                    ? `${r.leave_start_date}${r.leave_end_date ? ` TO ${r.leave_end_date}` : ''} (${r.leave_days_count || 1}d)`
                    : r.issue_date

                  return (
                    <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800">REC-{r.record_id}</td>
                      <td className="py-3 px-5 text-xs">
                        <div className="font-semibold text-gray-900">{r.students?.full_name || 'Unknown student'}</div>
                        <div className="text-gray-400 text-[11px] mt-0.5">{r.students?.index_no}</div>
                      </td>
                      <td className="py-3 px-5 text-xs text-gray-600 font-mono text-[11px]">{durationStr}</td>
                      <td className="py-3 px-5 text-xs text-gray-500">{r.purpose}</td>
                      <td className="py-3 px-5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-5">
                        <Link
                          href={`/doctor/review?id=${r.record_id}`}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                            r.status === 'pending'
                              ? 'bg-blue-800 hover:bg-blue-900 text-white shadow-sm'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {r.status === 'pending' ? 'Review →' : 'View Details'}
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
