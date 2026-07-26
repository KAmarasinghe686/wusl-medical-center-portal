'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type FacultyDashboardRecord = TableRow<'medical_records'> & {
  students: Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'> | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

export default function FacultyDashboard() {
  const [stats, setStats] = useState({ approved: 0, approvedThisMonth: 0, total: 0 })
  const [records, setRecords] = useState<FacultyDashboardRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
      const [approvedRes, monthlyRes, studentsRes, recentRes] = await Promise.all([
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('medical_records').select('*', { count: 'exact', head: true })
          .eq('status', 'approved').gte('created_at', monthStart).lt('created_at', nextMonth),
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('medical_records').select('*, students(full_name, index_no, faculty)')
          .eq('status', 'approved').order('created_at', { ascending: false }).limit(5),
      ])
      setStats({
        approved: approvedRes.count || 0,
        approvedThisMonth: monthlyRes.count || 0,
        total: studentsRes.count || 0,
      })
      setRecords((recentRes.data || []).map(record => ({
        ...record,
        students: Array.isArray(record.students) ? record.students[0] || null : record.students,
      })))
      setLoading(false)
    }
    void fetchData()
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Faculty Office Overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Approved Records', value: stats.approved, border: 'border-l-emerald-400' },
          { label: 'Approved This Month', value: stats.approvedThisMonth, border: 'border-l-amber-400' },
          { label: 'Total Students', value: stats.total, border: 'border-l-blue-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1`}>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Health Applications</h2>
          <Link href="/faculty/records" className="text-xs text-blue-800 hover:text-blue-600 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs text-gray-400">No records found.</td></tr>
              ) : records.map(r => (
                <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{r.students?.full_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{r.students?.index_no}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{r.students?.faculty || 'N/A'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{r.purpose}</td>
                  <td className="py-3 px-5 text-xs text-gray-400">{r.issue_date}</td>
                  <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
