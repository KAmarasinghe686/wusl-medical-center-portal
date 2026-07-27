'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDoctor } from '../hooks/useDoctor'

type MedicalRecord = { record_id: number; purpose: string; issue_date: string; status: string; students: { full_name: string; index_no: string } }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

export default function AssignedRecords() {
  const { doctor, loading, supabase } = useDoctor()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [search, setSearch] = useState('')
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const doctorId = doctor?.doctor_id

  useEffect(() => {
    if (!doctorId) return
    let active = true

    const fetchRecords = async () => {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no)')
        .eq('lifecycle_status', 'active')
        .or(`status.eq.pending,reviewed_by.eq.${doctorId}`)
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setRecordsError(error.message)
        setRecordsLoading(false)
        return
      }

      setRecords(data || [])
      setRecordsError('')
      setRecordsLoading(false)
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchRecords()
    }

    void fetchRecords()
    const channel = supabase
      .channel(`doctor-records-${doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => { void fetchRecords() })
      .subscribe()
    window.addEventListener('focus', fetchRecords)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.removeEventListener('focus', fetchRecords)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [doctorId, supabase])

  const filtered = records.filter(r =>
    r.students?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.students?.index_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.purpose?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading || recordsLoading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
<div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Review Queue</h1>
            <p className="text-sm text-gray-500">Review pending records and access decisions you previously made.</p>
          </div>
          <input type="text" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full sm:w-72 lg:w-48 shadow-sm" />
      </div>

      {/* Corrected Stats Cards Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Open Review Queue', value: records.filter(r => r.status === 'pending').length, border: 'border-l-blue-400' },
          { label: 'My Completed Reviews', value: records.filter(r => r.status !== 'pending').length, border: 'border-l-violet-400' },
          { label: 'My Approved', value: records.filter(r => r.status === 'approved').length, border: 'border-l-emerald-400' },
          { label: 'My Rejected', value: records.filter(r => r.status === 'rejected').length, border: 'border-l-red-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1`}>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {recordsError && (
        <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          Unable to load the review queue: {recordsError}
        </div>
      )}

      {/* Balanced Table Layout */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Index No</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-xs text-gray-400">No records found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800 truncate">REC-{r.record_id}</td>
                  <td className="py-3 px-5 text-xs text-gray-800 truncate">{r.students?.full_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-500 truncate">{r.students?.index_no}</td>
                  <td className="py-3 px-5 text-xs text-gray-500 truncate">{r.purpose}</td>
                  <td className="py-3 px-5 text-xs text-gray-400 truncate">{r.issue_date}</td>
                  <td className="py-3 px-5 truncate"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-5">
                    <Link href={`/doctor/review?id=${r.record_id}`} className="text-xs border border-blue-800 rounded-lg px-3 py-1.5 text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">Showing {filtered.length} of {records.length} records</div>
      </div>
    </div>
  )
}
