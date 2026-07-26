'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

const PER_PAGE = 5
type StudentSearchRow = TableRow<'students'> & { medical_records?: { count: number }[] }

export default function StudentSearch() {
  const [students, setStudents] = useState<StudentSearchRow[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0 })

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, count } = await supabase.from('students').select('*, medical_records(count)', { count: 'exact' })
      setStudents((data || []) as StudentSearchRow[])
      setStats({ total: count || 0 })
      setLoading(false)
    }
    void fetchStudents()
  }, [])

  const filtered = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.index_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.faculty?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Search</h1>
      <p className="text-sm text-gray-500 mb-6">Search by name or identification number.</p>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">
        <input type="text" placeholder="Enter student name, ID, or faculty..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { label: 'Total Students', value: stats.total, border: 'border-l-blue-400' },
            { label: 'Search Results', value: filtered.length, border: 'border-l-violet-400' },
          ].map(s => (
            <div key={s.label} className={`bg-white border border-gray-100 border-l-4 ${s.border} rounded-r-2xl p-4 flex flex-col gap-1 shadow-sm`}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Academic Year</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No students found.</td></tr>
              ) : paginated.map(s => (
                <tr key={s.student_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-mono font-medium text-blue-800">{s.index_no}</td>
                  <td className="py-3 px-5 text-xs text-gray-800">{s.full_name}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{s.faculty || 'N/A'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">Year {s.academic_year}</td>
                  <td className="py-3 px-5">
                    <Link href={`/faculty/records?search=${s.index_no}`}
                      className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors">
                      View Records
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Showing {paginated.length} of {filtered.length} students</span>
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
