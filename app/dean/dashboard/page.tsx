'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'>
type RecordWithStudent = TableRow<'medical_records'> & {
  students: StudentSummary | null
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

export default function DeanDashboard() {
  const [records, setRecords] = useState<RecordWithStudent[]>([])
  const [letterDocs, setLetterDocs] = useState<Record<number, TableRow<'record_images'>[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: recs } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty)')
        .eq('lifecycle_status', 'active')
        .order('created_at', { ascending: false })

      const mapped = (recs || []).map(r => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] || null : r.students,
      }))
      setRecords(mapped)

      // Fetch attached documents
      if (mapped.length > 0) {
        const { data: imgs } = await supabase
          .from('record_images')
          .select('*')
          .in('record_id', mapped.map(r => r.record_id))
          .eq('disposal_status', 'retained')

        if (imgs) {
          const map: Record<number, TableRow<'record_images'>[]> = {}
          imgs.forEach(img => {
            if (!map[img.record_id]) map[img.record_id] = []
            map[img.record_id].push(img)
          })
          setLetterDocs(map)
        }
      }
      setLoading(false)
    }

    void fetchData()
  }, [])

  const totalRecords = records.length
  const examRecords = records.filter(r => r.submission_type === 'exam')
  const pendingFacultyBoard = examRecords.filter(r => r.workflow_stage === 'faculty_board' || r.doctor_recommendation)
  const approvedTotal = records.filter(r => r.status === 'approved').length

  const handleOpenDoc = async (filePath: string) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(filePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading Dean Executive Dashboard...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Dean's Executive Dashboard</h1>
          <p className="text-sm text-gray-500">Faculty of Applied Sciences · Medical Absence Petitions & Letters Overview</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dean/letters"
            className="bg-blue-800 hover:bg-blue-900 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>Letters In-Tray</span>
          </Link>
          <Link
            href="/dean/schedules"
            className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <span>FB Schedules</span>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Submissions', value: totalRecords, border: 'border-l-blue-400' },
          { label: 'Exam Absence Petitions', value: examRecords.length, border: 'border-l-purple-400' },
          { label: 'Awaiting Senate / FB Action', value: pendingFacultyBoard.length, border: 'border-l-amber-400' },
          { label: 'Approved Medicals', value: approvedTotal, border: 'border-l-emerald-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1 shadow-sm`}>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Letters to the Dean Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Letters to the Dean</h2>
          <Link href="/dean/letters" className="text-xs text-blue-800 hover:text-blue-600 font-medium">
            View All ({records.length}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type / Purpose</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Letter Document</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                    No student letters found.
                  </td>
                </tr>
              ) : (
                records.slice(0, 6).map(r => {
                  const docs = letterDocs[r.record_id] || []
                  const letterDoc = docs.find(d => d.document_type === 'letter_to_dean' || d.file_path.includes('letter-dean'))
                  const certDoc = docs.find(d => d.document_type === 'medical_certificate' || d.file_path.includes('med-cert'))

                  return (
                    <tr key={r.record_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-5 text-xs font-medium text-gray-800">{r.students?.full_name || 'Student'}</td>
                      <td className="py-3 px-5 text-xs text-gray-500 font-mono">{r.students?.index_no}</td>
                      <td className="py-3 px-5 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            r.submission_type === 'exam'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {r.submission_type === 'exam' ? 'Exam' : 'Coursework'}
                          </span>
                          <span className="truncate max-w-[200px]">{r.purpose}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-xs text-gray-500 font-mono">
                        {r.leave_start_date || r.issue_date} ({r.leave_days_count || 1} d)
                      </td>
                      <td className="py-3 px-5 text-xs">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-5 text-xs text-right space-x-2">
                        {letterDoc ? (
                          <button
                            onClick={() => handleOpenDoc(letterDoc.file_path)}
                            className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Read Letter
                          </button>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">In bundle</span>
                        )}
                        {certDoc && (
                          <button
                            onClick={() => handleOpenDoc(certDoc.file_path)}
                            className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Cert
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
