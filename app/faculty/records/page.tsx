'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

const PER_PAGE = 5
type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no'>
type DoctorSummary = Pick<TableRow<'doctors'>, 'full_name'>
type FacultyRecordRow = TableRow<'medical_records'> & { students: StudentSummary | null }
type FacultyVisitRow = TableRow<'medical_visits'> & { doctors: DoctorSummary | null }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

export default function ApprovedRecordsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <ApprovedRecords />
    </Suspense>
  )
}

function ApprovedRecords() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'records' | 'visits'>('records')
  const [records, setRecords] = useState<FacultyRecordRow[]>([])
  const [visits, setVisits] = useState<FacultyVisitRow[]>([])
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [recordsRes, visitsRes] = await Promise.all([
        supabase.from('medical_records').select('*, students(full_name, index_no)').eq('status', 'approved').order('created_at', { ascending: false }),
        supabase.from('medical_visits').select('*, doctors(full_name)').eq('patient_type', 'Student').order('visit_date', { ascending: false }),
      ])
      setRecords((recordsRes.data || []).map(record => ({
        ...record,
        students: Array.isArray(record.students) ? record.students[0] || null : record.students,
      })))
      setVisits((visitsRes.data || []).map(visit => ({
        ...visit,
        doctors: Array.isArray(visit.doctors) ? visit.doctors[0] || null : visit.doctors,
      })))
      setLoading(false)
    }
    void fetchData()
  }, [])

  const filteredRecords = records.filter(r =>
    r.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.students?.index_no?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredVisits = visits.filter(v =>
    v.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.patient_index?.toLowerCase().includes(search.toLowerCase())
  )

  const activeData = tab === 'records' ? filteredRecords : filteredVisits
  const totalPages = Math.ceil(activeData.length / PER_PAGE)
  const paginated = activeData.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Health Records</h1>
          <p className="text-sm text-gray-500">Approved records and medical visits.</p>
        </div>
        <input type="text" placeholder="Search student..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full sm:w-72 lg:w-48 shadow-sm" />
      </div>

      <div className="flex gap-2 mb-6">
        {(['records', 'visits'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${tab === t ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'records' ? 'Approved Records' : 'Medical Visits'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {tab === 'records' ? (
                  <>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Index No</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </>
                ) : (
                  <>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Visit Date</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Patient</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Index No</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Doctor</th>
                    <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/5">Reason</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-xs text-gray-400">No data found.</td></tr>
              ) : tab === 'records' ? (
                (paginated as FacultyRecordRow[]).map(r => (
                  <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800">REC-{r.record_id}</td>
                    <td className="py-3 px-5 text-xs text-gray-800">{r.students?.full_name}</td>
                    <td className="py-3 px-5 text-xs text-gray-500">{r.students?.index_no}</td>
                    <td className="py-3 px-5 text-xs text-gray-500">{r.purpose}</td>
                    <td className="py-3 px-5 text-xs text-gray-400">{r.issue_date}</td>
                    <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-5">
                      <Link href={`/faculty/record-detail?id=${r.record_id}`}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                (paginated as FacultyVisitRow[]).map(v => (
                  <tr key={v.visit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 text-xs text-gray-700">{v.visit_date}</td>
                    <td className="py-3 px-5 text-xs font-medium text-gray-800">{v.patient_name || '-'}</td>
                    <td className="py-3 px-5 text-xs text-gray-500">{v.patient_index || '-'}</td>
                    <td className="py-3 px-5 text-xs text-gray-500">{v.doctors?.full_name || '-'}</td>
                    <td className="py-3 px-5 text-xs text-gray-500">{v.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Showing {paginated.length} of {activeData.length} entries</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="border border-gray-200 rounded px-2 py-1 text-xs disabled:opacity-40 hover:bg-gray-50">&lt;</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`border rounded px-2.5 py-1 text-xs ${page === i + 1 ? 'bg-blue-800 text-white border-blue-800' : 'border-gray-200 hover:bg-gray-50'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border border-gray-200 rounded px-2 py-1 text-xs disabled:opacity-40 hover:bg-gray-50">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  )
}
