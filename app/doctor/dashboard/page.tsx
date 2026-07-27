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

const statCards = [
  { key: 'queue', label: 'Open Review Queue', border: 'border-l-blue-400' },
  { key: 'approved', label: 'My Approved', border: 'border-l-emerald-400' },
  { key: 'rejected', label: 'My Rejected', border: 'border-l-red-400' },
  { key: 'visitsToday', label: 'Visits Today', border: 'border-l-violet-400' },
]

export default function DoctorDashboard() {
  const { doctor, loading, supabase } = useDoctor()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [stats, setStats] = useState({ queue: 0, approved: 0, rejected: 0, visitsToday: 0 })
  const [recordsError, setRecordsError] = useState('')
  const doctorId = doctor?.doctor_id

  useEffect(() => {
    if (!doctorId) return
    let active = true

    const fetchData = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [recordsResult, statsResult, visitsResult] = await Promise.all([
        supabase
          .from('medical_records')
          .select('record_id, purpose, issue_date, status, students(full_name, index_no)')
          .eq('lifecycle_status', 'active')
          .or(`status.eq.pending,reviewed_by.eq.${doctorId}`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('medical_records')
          .select('status')
          .eq('lifecycle_status', 'active')
          .or(`status.eq.pending,reviewed_by.eq.${doctorId}`),
        supabase
          .from('medical_visits')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', doctorId)
          .eq('visit_date', today),
      ])
      const { data, error } = recordsResult

      if (!active) return
      const dashboardError = error || statsResult.error || visitsResult.error
      if (dashboardError) {
        setRecordsError(dashboardError.message || 'Unable to load dashboard statistics.')
        return
      }

      if (data) {
        const normalizedRecords: MedicalRecord[] = data.map(record => ({
          ...record,
          students: Array.isArray(record.students) ? record.students[0] : record.students,
        }))
        setRecords(normalizedRecords)
        const assignedRecords = statsResult.data || []
        setStats({
          queue: assignedRecords.filter(record => record.status === 'pending').length,
          approved: assignedRecords.filter(record => record.status === 'approved').length,
          rejected: assignedRecords.filter(record => record.status === 'rejected').length,
          visitsToday: visitsResult.count || 0,
        })
        setRecordsError('')
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData()
    }

    void fetchData()
    const channel = supabase
      .channel(`doctor-dashboard-records-${doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => { void fetchData() })
      .subscribe()
    window.addEventListener('focus', fetchData)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.removeEventListener('focus', fetchData)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [doctorId, supabase])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Doctor Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Welcome back, <span className="text-blue-800 font-medium">{doctor?.full_name}</span></p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.key} className={`bg-white border border-gray-200 border-l-4 ${card.border} rounded-r-xl p-4 flex flex-col gap-1`}>
            <div className="text-2xl font-bold text-gray-800">{stats[card.key as keyof typeof stats]}</div>
            <div className="text-xs font-medium text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      {recordsError && (
        <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          Unable to load the review queue: {recordsError}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Review Queue and My Reviews</h2>
          <Link href="/doctor/records" className="text-xs text-blue-800 hover:text-blue-600 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs text-gray-400">No pending or previously reviewed records.</td></tr>
              ) : records.map(r => (
                <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800">REC-{r.record_id}</td>
                  <td className="py-3 px-5 text-xs text-gray-800">{r.students?.full_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{r.purpose}</td>
                  <td className="py-3 px-5 text-xs text-gray-400">{r.issue_date}</td>
                  <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-5">
                    <Link href={`/doctor/review?id=${r.record_id}`} className="text-xs border border-blue-800 rounded-lg px-3 py-1.5 text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
