'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type Visit = { visit_id: number; visit_date: string; reason: string; doctors: { full_name: string } | null }


const PER_PAGE = 5

export default function WorkerVisits() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fetchVisits = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('medical_visits').select('visit_id, visit_date, reason, doctors(full_name)').eq('user_id', user.id).order('visit_date', { ascending: false })
      setVisits((data || []).map(visit => ({
        ...visit,
        doctors: Array.isArray(visit.doctors) ? visit.doctors[0] || null : visit.doctors,
      })))
      setLoading(false)
    }

    void fetchVisits()
    const channel = supabase.channel('worker_visits').on('postgres_changes', { event: '*', schema: 'public', table: 'medical_visits' }, () => fetchVisits()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = visits.filter(v => v.doctors?.full_name?.toLowerCase().includes(search.toLowerCase()) || v.reason?.toLowerCase().includes(search.toLowerCase()) || v.visit_date?.includes(search))
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Visits</h1>
      <p className="text-sm text-gray-500 mb-6">Your visit history at the medical center.</p>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visit Logs</h2>
          <input type="text" placeholder="Search records..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full lg:w-56" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Visit Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Doctor</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Reason</th>
                
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-xs text-gray-400">No visits found.</td></tr>
              ) : paginated.map(v => (
                <tr key={v.visit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs text-gray-700">{v.visit_date}</td>
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{v.doctors?.full_name || '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{v.reason}</td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Showing {paginated.length} of {filtered.length} records</span>
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
