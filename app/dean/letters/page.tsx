'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty' | 'academic_year' | 'contact_no'>
type RecordWithStudent = TableRow<'medical_records'> & {
  students: StudentSummary | null
}

export default function DeanLettersInTray() {
  const [records, setRecords] = useState<RecordWithStudent[]>([])
  const [documents, setDocuments] = useState<Record<number, TableRow<'record_images'>[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'exam' | 'general'>('all')

  useEffect(() => {
    const fetchData = async () => {
      const { data: recs } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty, academic_year, contact_no)')
        .eq('lifecycle_status', 'active')
        .order('created_at', { ascending: false })

      const mapped = (recs || []).map(r => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] || null : r.students,
      }))
      setRecords(mapped)

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
          setDocuments(map)
        }
      }
      setLoading(false)
    }

    void fetchData()
  }, [])

  const handleOpenDoc = async (filePath: string) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(filePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const filtered = records.filter(r => {
    const matchesSearch =
      (r.students?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.students?.index_no || '').toLowerCase().includes(search.toLowerCase()) ||
      r.purpose.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (filterType === 'exam') return r.submission_type === 'exam'
    if (filterType === 'general') return r.submission_type === 'general'
    return true
  })

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading Dean In-Tray...</div>

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Dean's In-Tray · Letters to the Dean</h1>
          <p className="text-sm text-gray-500">
            Review formal student covering letters and medical absence requests addressed to the Dean.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search student name, index..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-800 w-full sm:w-72 shadow-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'exam', 'general'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterType === t
                ? 'bg-blue-800 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'all'
              ? `All Letters (${records.length})`
              : t === 'exam'
              ? `Exam Absences (${records.filter(r => r.submission_type === 'exam').length})`
              : `Coursework (${records.filter(r => r.submission_type === 'general').length})`}
          </button>
        ))}
      </div>

      {/* List of Letters to the Dean Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-xs text-gray-400 shadow-sm">
            No letters matching the selected criteria found.
          </div>
        ) : (
          filtered.map(record => {
            const docs = documents[record.record_id] || []
            const letterDocs = docs.filter(d => d.document_type === 'letter_to_dean' || d.file_path.includes('letter-dean'))
            const certDocs = docs.filter(d => d.document_type === 'medical_certificate' || d.file_path.includes('med-cert') || (!d.file_path.includes('letter-dean') && d.document_type !== 'letter_to_dean'))
            const isExam = record.submission_type === 'exam'

            return (
              <div
                key={record.record_id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-gray-300 transition-all"
              >
                {/* Top Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold flex items-center justify-center text-sm">
                      {record.students?.full_name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{record.students?.full_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-700">{record.students?.index_no}</span>
                        <span>·</span>
                        <span>{record.students?.faculty || 'Applied Sciences'}</span>
                        {record.students?.academic_year && (
                          <>
                            <span>·</span>
                            <span>Year {record.students.academic_year}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isExam
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {isExam ? 'Examination Absence' : 'Coursework Absence'}
                    </span>
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      REC-{record.record_id}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Column 1: Absence Summary */}
                  <div className="space-y-1.5 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                    <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Absence Request</div>
                    <div className="font-semibold text-gray-900">{record.purpose}</div>
                    <div className="text-gray-600 font-mono text-xs">
                      Duration: {record.leave_start_date || record.issue_date} to {record.leave_end_date || record.leave_start_date || record.issue_date} ({record.leave_days_count || 1} d)
                    </div>
                    {record.description && (
                      <div className="text-gray-600 italic text-xs pt-1 border-t border-gray-200/60">
                        "{record.description}"
                      </div>
                    )}
                  </div>

                  {/* Column 2: Clinical Clearance */}
                  <div className="space-y-1.5 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                    <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Medical Officer Evaluation</div>
                    <div>
                      <span className="text-gray-500">Doctor / Practitioner:</span>{' '}
                      <strong className="text-gray-800">{record.doctor_name || 'Registered Practitioner'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">UMO Decision:</span>{' '}
                      {record.doctor_recommendation ? (
                        <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                          record.doctor_recommendation === 'Recommended'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {record.doctor_recommendation}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 capitalize">{record.status}</span>
                      )}
                    </div>
                    {record.doctor_remarks && (
                      <div className="text-gray-600 text-xs pt-1 border-t border-gray-200/60">
                        UMO Remark: {record.doctor_remarks}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Attached Documents */}
                  <div className="space-y-2 bg-blue-50/30 p-3.5 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-900 uppercase tracking-wider text-[10px] flex items-center justify-between">
                      <span>Attached Documents</span>
                      <span className="text-[10px] text-blue-700 font-medium">{docs.length} file(s)</span>
                    </div>

                    {/* Letter to the Dean Button */}
                    {letterDocs.length > 0 ? (
                      letterDocs.map((ld, i) => (
                        <button
                          key={ld.image_id || i}
                          onClick={() => handleOpenDoc(ld.file_path)}
                          className="w-full flex items-center justify-between bg-blue-800 hover:bg-blue-900 text-white font-semibold px-3 py-2 rounded-lg text-xs shadow-sm transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">View Letter to Dean</span>
                          </div>
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">PDF/Image</span>
                        </button>
                      ))
                    ) : (
                      <div className="text-xs text-gray-400 italic">No separate letter file (attached in bundle)</div>
                    )}

                    {/* Medical Certificate Button */}
                    {certDocs.map((cd, i) => (
                      <button
                        key={cd.image_id || i}
                        onClick={() => handleOpenDoc(cd.file_path)}
                        className="w-full flex items-center justify-between bg-white hover:bg-gray-50 text-gray-700 font-medium px-3 py-1.5 rounded-lg text-xs border border-gray-200 transition-colors cursor-pointer"
                      >
                        <span className="truncate text-xs">View Medical Certificate</span>
                        <span className="text-[10px] text-gray-400 font-mono">({cd.file_size_kb}KB)</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
