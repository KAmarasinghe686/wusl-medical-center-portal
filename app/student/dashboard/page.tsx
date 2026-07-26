'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type MedicalRecord = {
  record_id: number
  purpose: string
  issue_date: string
  status: string
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

const statCards = [
  { key: 'total', label: 'Total Records', border: 'border-l-blue-400' },
  { key: 'pending', label: 'Pending', border: 'border-l-amber-400' },
  { key: 'approved', label: 'Approved', border: 'border-l-green-500' },
  { key: 'rejected', label: 'Rejected', border: 'border-l-red-400' },
]

export default function StudentDashboard() {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [studentName, setStudentName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: student } = await supabase.from('students').select('student_id, full_name').eq('user_id', user.id).maybeSingle()
      if (!student) { setLoading(false); return }
      setStudentName(student.full_name)
      const [recent, total, pending, approved, rejected] = await Promise.all([
        supabase
          .from('medical_records')
          .select('record_id, purpose, issue_date, status')
          .eq('student_id', student.student_id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('student_id', student.student_id),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('student_id', student.student_id).eq('status', 'pending'),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('student_id', student.student_id).eq('status', 'approved'),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('student_id', student.student_id).eq('status', 'rejected'),
      ])
      if (recent.data) {
        setRecords(recent.data)
        setStats({
          total: total.count || 0,
          pending: pending.count || 0,
          approved: approved.count || 0,
          rejected: rejected.count || 0,
        })
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, <span className="text-indigo-600 font-medium">{studentName}</span>. Your medical overview is up to date.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
  {statCards.map(card => (
   <div key={card.key} className={`bg-white border border-gray-200 border-l-4 ${card.border} rounded-r-xl p-4 flex flex-col gap-1`}>
      <div className="text-2xl font-bold text-gray-800">{stats[card.key as keyof typeof stats]}</div>
      <div className="text-xs font-medium text-gray-500">{card.label}</div>
    </div>
  ))}
</div>

      {/* Recent Records */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm mb-6">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recent Medical Records</h2>
          <Link href="/student/recordss" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No records found.</td></tr>
              ) : (
                records.map(r => (
                  <tr key={r.record_id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                    <td className="py-3 px-5 text-xs font-mono font-medium text-indigo-600">REC-{r.record_id}</td>
                    <td className="py-3 px-5 text-xs text-gray-700">{r.purpose}</td>
                    <td className="py-3 px-5 text-xs text-gray-400">{r.issue_date}</td>
                    <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-5">
                      <Link href={`/student/recordss/detail?id=${r.record_id}`}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="portal-action-card portal-action-card--teal rounded-2xl p-5 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 40%, #7c3aed 100%)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(30%, -30%)' }} />
          <div className="text-sm font-bold mb-1 relative z-10">Submit New Record</div>
          <div className="text-xs text-blue-200 mb-4 relative z-10">Upload clinical reports or excuse letters easily.</div>
          <Link href="/student/submit"
            className="relative z-10 inline-block text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-lg transition-colors border border-white/30 backdrop-blur-sm">
            Get Started
          </Link>
        </div>
        <div className="portal-action-card portal-action-card--blue rounded-2xl p-5 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 40%, #2563eb 100%)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(30%, -30%)' }} />
          <div className="text-sm font-bold mb-1 relative z-10">Doctor Availability</div>
          <div className="text-xs text-violet-200 mb-4 relative z-10">Check doctor schedules and available time slots.</div>
          <Link href="/student/availability"
            className="relative z-10 inline-block text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-lg transition-colors border border-white/30 backdrop-blur-sm">
            Check Availability
          </Link>
        </div>
      </div>
    </div>
  )
}
