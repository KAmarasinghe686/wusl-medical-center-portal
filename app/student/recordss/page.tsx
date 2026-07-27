'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '../hooks/useStudent'

type MedicalRecord = { record_id: number; purpose: string; issue_date: string; status: string; description: string | null }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

export default function MyRecords() {
  const { student, loading, supabase } = useStudent()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (!student) return
    const fetchRecords = async () => {
      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('student_id', student.student_id)
        .eq('lifecycle_status', 'active')
        .order('issue_date', { ascending: false })
      setRecords(data || [])
    }
    fetchRecords()
  }, [student, supabase])

  const filtered = records.filter(r =>
    (filter === 'All' || r.status === filter.toLowerCase()) &&
    (r.purpose?.toLowerCase().includes(search.toLowerCase()) || r.issue_date?.includes(search))
  )

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Records</h1>
      <p className="text-sm text-gray-500 mb-6">Track and manage all your submitted medical documentation.</p>
      <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center">
        <input type="text" placeholder="Search by purpose or date..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 bg-white shadow-sm" />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 bg-white shadow-sm w-full lg:w-48">
          <option>All</option><option>Approved</option><option>Pending</option><option>Rejected</option>
        </select>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No records found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800">REC-{r.record_id}</td>
                  <td className="py-3 px-5 text-xs text-gray-700">{r.purpose}</td>
                  <td className="py-3 px-5 text-xs text-gray-400">{r.issue_date}</td>
                  <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-5">
                    <Link href={`/student/recordss/detail?id=${r.record_id}`} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors">View</Link>
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
