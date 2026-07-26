'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, students: 0, doctors: 0, workers: 0, faculty: 0 })
  const [activity, setActivity] = useState<TableRow<'audit_logs'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [totalRes, studentsRes, doctorsRes, workersRes, facultyRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'faculty'),
        supabase.from('audit_logs').select('*').order('performed_at', { ascending: false }).limit(5),
      ])
      setStats({
        total: totalRes.count || 0,
        students: studentsRes.count || 0,
        doctors: doctorsRes.count || 0,
        workers: workersRes.count || 0,
        faculty: facultyRes.count || 0,
      })
      setActivity(activityRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">System administration overview.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.total, border: 'border-l-blue-400' },
          { label: 'Students', value: stats.students, border: 'border-l-indigo-400' },
          { label: 'Doctors', value: stats.doctors, border: 'border-l-emerald-400' },
          { label: 'Staff', value: stats.workers, border: 'border-l-amber-400' },
          { label: 'Faculty', value: stats.faculty, border: 'border-l-violet-400' },
        ].map(s => (
         <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1`}>
          <div className="text-2xl font-bold text-gray-800">{s.value}</div>
          <div className="text-xs font-medium text-gray-500">{s.label}</div>
        </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent System Activity</h2>
          <Link href="/admin/system" className="text-xs text-blue-800 hover:text-blue-600 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Table</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-xs text-gray-400">No activity found.</td></tr>
              ) : activity.map(a => (
                <tr key={a.audit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{a.action}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{a.table_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-400">{new Date(a.performed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
