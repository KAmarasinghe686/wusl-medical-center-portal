'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import { fetchPortalUserCounts } from '../../lib/users/counts'

const supabase = createBrowserSupabaseClient()

const PER_PAGE = 10

export default function SystemOverview() {
  const [stats, setStats] = useState({ records: 0, users: 0 })
  const [activity, setActivity] = useState<TableRow<'audit_logs'>[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<'Healthy' | 'Degraded'>('Healthy')
  const [loadError, setLoadError] = useState('')

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const [recordsRes, userCounts, activityRes] = await Promise.all([
        supabase.from('medical_records').select('*', { count: 'exact', head: true }),
        fetchPortalUserCounts(session?.access_token),
        supabase.from('audit_logs').select('*').order('performed_at', { ascending: false }),
      ])
      const firstError = recordsRes.error || activityRes.error
      setSystemStatus(firstError ? 'Degraded' : 'Healthy')
      setLoadError(firstError?.message || '')
      setStats({ records: recordsRes.count || 0, users: userCounts.total })
      setActivity(activityRes.data || [])
    } catch (error) {
      setSystemStatus('Degraded')
      setLoadError(error instanceof Error ? error.message : 'Unable to load system data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData() }, 0)

    const channel = supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [])

  const totalPages = Math.ceil(activity.length / PER_PAGE)
  const paginated = activity.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">System Overview</h1>
      <p className="text-sm text-gray-500 mb-6">Monitor system health and recent activity.</p>

      {/* Stats Section matching the Admin Dashboard card design exactly */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'System Status', value: systemStatus, border: systemStatus === 'Healthy' ? 'border-l-emerald-400' : 'border-l-red-400' },
          { label: 'Total Records', value: stats.records, border: 'border-l-blue-400' },
          { label: 'Total Users', value: stats.users, border: 'border-l-violet-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1`}>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
      {loadError && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">System check failed: {loadError}</div>}

      {/* Balanced 5-Column Table Section */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="w-1/5 text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="w-1/5 text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Table</th>
                <th className="w-1/5 text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="w-1/5 text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="w-1/5 text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No activity found.</td></tr>
              ) : paginated.map(a => (
                <tr key={a.audit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-medium text-gray-800 truncate">{a.action}</td>
                  <td className="py-3 px-5 text-xs text-gray-500 truncate">{a.table_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-400 truncate">{a.record_id || '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-400 font-mono truncate">{a.user_id ? a.user_id.slice(0, 8) + '...' : '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-400 truncate">{new Date(a.performed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Showing {paginated.length} of {activity.length} entries</span>
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
