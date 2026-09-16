'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import { generateAcademicYears, getCurrentAcademicYear, type ExamCourseEntry } from '../../lib/validation'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty' | 'academic_year'>
type ExamRecord = TableRow<'medical_records'> & {
  students: StudentSummary | null
}

export default function DeanExamSchedulesPage() {
  const dynamicAcademicYears = generateAcademicYears(5)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(() => getCurrentAcademicYear())
  const [selectedSemester, setSelectedSemester] = useState('Semester I')
  const [records, setRecords] = useState<ExamRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty, academic_year)')
        .eq('submission_type', 'exam')
        .eq('lifecycle_status', 'active')
        .order('created_at', { ascending: false })

      setRecords((data || []).map(r => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] || null : r.students,
      })))
      setLoading(false)
    }

    void fetchSchedules()
  }, [])

  const filtered = records.filter(r => {
    const ayMatch = !selectedAcademicYear || r.exam_academic_year === selectedAcademicYear
    const semMatch = !selectedSemester || r.exam_semester === selectedSemester
    return ayMatch && semMatch
  })

  const handleExportExcel = () => {
    const headers = [
      'Record ID',
      'Student Name',
      'Index No',
      'Faculty',
      'Academic Year',
      'Semester',
      'Illness Timing',
      'Missed Course Papers',
      'Leave Start Date',
      'Leave End Date',
      'Leave Days',
      'Issuing Doctor',
      'UMO Recommendation',
      'UMO Remarks',
      'Faculty Board Decision',
    ]

    const csvRows = [
      headers.join(','),
      ...filtered.map(r => {
        const courses = (Array.isArray(r.exam_courses) ? (r.exam_courses as unknown as ExamCourseEntry[]) : [])
          .map(c => `${c.course_code} (${c.exam_date})`)
          .join('; ')

        return [
          `"REC-${r.record_id}"`,
          `"${(r.students?.full_name || '').replace(/"/g, '""')}"`,
          `"${(r.students?.index_no || '').replace(/"/g, '""')}"`,
          `"${(r.students?.faculty || 'Applied Sciences').replace(/"/g, '""')}"`,
          `"${(r.exam_academic_year || '').replace(/"/g, '""')}"`,
          `"${(r.exam_semester || '').replace(/"/g, '""')}"`,
          `"${r.illness_timing === 'during_exam' ? 'During Exam' : 'Prior to Exam'}"`,
          `"${courses.replace(/"/g, '""')}"`,
          `"${r.leave_start_date || r.issue_date}"`,
          `"${r.leave_end_date || r.leave_start_date || r.issue_date}"`,
          `"${r.leave_days_count || 1}"`,
          `"${(r.doctor_name || '').replace(/"/g, '""')}"`,
          `"${(r.doctor_recommendation || 'Pending').replace(/"/g, '""')}"`,
          `"${(r.doctor_remarks || '').replace(/"/g, '""')}"`,
          `"${(r.faculty_board_decision || 'Pending').replace(/"/g, '""')}"`,
        ].join(',')
      }),
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Dean_Faculty_Board_Absence_Schedule_${selectedAcademicYear.replace(/\//g, '-')}_${selectedSemester.replace(/\s+/g, '_')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDateDot = (d?: string | null) => {
    if (!d) return '-'
    try {
      const parts = d.split('T')[0].split('-')
      if (parts.length === 3) return `${parts[0]}.${parts[1]}.${parts[2]}`
    } catch {
      // fallback
    }
    return d
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-0">
      {/* Header & Controls - Hidden on print */}
      <div className="print:hidden flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Faculty Board & Senate Absence Schedules</h1>
          <p className="text-sm text-gray-500">
            Official Examination Absence Schedules prepared with University Medical Officer recommendations for Faculty Board ratification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="border border-emerald-700 bg-emerald-50 hover:bg-emerald-700 hover:text-white text-emerald-800 text-xs px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Excel (.csv)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="border border-blue-800 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-800 text-xs px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print Memo (A4 Landscape)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar - Hidden on print */}
      <div className="print:hidden bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Academic Year</label>
          <select
            value={selectedAcademicYear}
            onChange={e => setSelectedAcademicYear(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-800 shadow-sm"
          >
            {dynamicAcademicYears.map(ay => (
              <option key={ay} value={ay}>{ay}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Semester</label>
          <select
            value={selectedSemester}
            onChange={e => setSelectedSemester(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-800 shadow-sm"
          >
            <option value="Semester I">Semester I</option>
            <option value="Semester II">Semester II</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-gray-500 font-medium pt-3">
          Showing <strong>{filtered.length}</strong> examination absence candidates
        </div>
      </div>

      {/* OFFICIAL FACULTY BOARD MEMO DOCUMENT SHEET */}
      <div className="bg-white p-6 sm:p-10 rounded-none border-0 shadow-none print:p-0 print:m-0 print-doc-sheet">
        <style>{`
          @media print {
            body { background: white !important; font-size: 9pt !important; color: black !important; }
            .portal-sidebar, .portal-header, .portal-footer, aside, header, footer { display: none !important; }
            .portal-shell, .portal-frame, .portal-content { margin: 0 !important; padding: 0 !important; }
            .print-doc-sheet, .print-doc-sheet * { box-shadow: none !important; border-radius: 0 !important; }
            .print-doc-sheet { border: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; background: transparent !important; }
            @page { size: A4 landscape; margin: 8mm 8mm 8mm 8mm; }
            .print-table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
            .print-table th, .print-table td { border: 1px solid black !important; }
          }
        `}</style>

        {/* Top Right Memo Box */}
        <div className="flex justify-end mb-3">
          <div className="border border-black px-4 py-1 text-xs font-serif font-bold text-black tracking-wider">
            Memo FB/217/
          </div>
        </div>

        {/* Document Header Block */}
        <div className="text-center mb-5 space-y-1">
          <div className="font-serif italic text-sm text-gray-900">Faculty of Applied Sciences</div>
          <div className="font-serif italic text-sm text-gray-900">Wayamba University of Sri Lanka</div>
          <div className="font-serif italic text-xs text-gray-800">Kuliyapitiya</div>

          <h2 className="text-base sm:text-lg font-serif font-bold text-gray-900 pt-2">
            Excuses Given by the Students for Absence of Examinations
          </h2>

          <div className="font-serif font-bold text-xs sm:text-sm text-gray-900">
            B.Sc. (General/ Joint Major/Honours/ Special) Degree Programmes
          </div>

          <div className="font-serif font-bold text-xs sm:text-sm text-gray-900 underline pt-0.5">
            Level 1,2,3,4 - {selectedSemester} Examination - Academic Year {selectedAcademicYear}
          </div>
        </div>

        {/* Official 6-Column Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-900 text-xs text-left print-table">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 print:bg-transparent font-serif font-bold text-gray-900 border-b border-gray-900 text-center">
                <th className="border border-gray-900 px-1.5 py-2 text-center" style={{ width: '5%' }}>
                  Ser. No.
                </th>
                <th className="border border-gray-900 px-2 py-2 text-center" style={{ width: '22%' }}>
                  Name
                </th>
                <th className="border border-gray-900 px-1.5 py-2 text-center" style={{ width: '12%' }}>
                  Reg. No.
                </th>
                <th className="border border-gray-900 px-2 py-2 text-center" style={{ width: '16%' }}>
                  Date of Submission of Medical Certificate
                </th>
                <th className="border border-gray-900 px-2 py-2 text-center" style={{ width: '27%' }}>
                  Date on which Exam was held & Code of Paper
                </th>
                <th className="border border-gray-900 px-2 py-2 text-center" style={{ width: '18%' }}>
                  University MO's Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="border border-gray-900 py-8 text-center text-gray-400 font-serif">
                    Loading examination excuses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-900 py-8 text-center text-gray-400 font-serif">
                    No examination absence records registered for {selectedAcademicYear} - {selectedSemester}.
                  </td>
                </tr>
              ) : (
                filtered.map((record, index) => {
                  const courses: ExamCourseEntry[] = Array.isArray(record.exam_courses)
                    ? (record.exam_courses as unknown as ExamCourseEntry[])
                    : []
                  const moRemark = record.doctor_recommendation || (record.status === 'approved' ? 'Recommended' : 'Pending UMO Review')

                  return (
                    <tr key={record.record_id} className="border-b border-gray-900 align-top font-serif">
                      {/* Ser. No. */}
                      <td className="border border-gray-900 px-1.5 py-2 text-center font-medium">
                        {String(index + 1).padStart(2, '0')}.
                      </td>

                      {/* Name */}
                      <td className="border border-gray-900 px-2 py-2 font-medium text-gray-900">
                        {record.students?.full_name || 'Student'}
                      </td>

                      {/* Reg. No. */}
                      <td className="border border-gray-900 px-1.5 py-2 text-center font-mono font-semibold text-gray-900">
                        {record.students?.index_no || '-'}
                      </td>

                      {/* Date of Submission */}
                      <td className="border border-gray-900 px-2 py-2 text-center font-mono text-gray-800">
                        {formatDateDot(record.created_at || record.issue_date)}
                      </td>

                      {/* Date of Exam & Code of Paper */}
                      <td className="border border-gray-900 px-2 py-2 text-xs text-gray-900">
                        {courses.length > 0 ? (
                          <div className="space-y-1">
                            {courses.map((c, cIdx) => (
                              <div key={cIdx} className="font-mono">
                                {formatDateDot(c.exam_date)} – <span className="font-bold">{c.course_code}</span>
                                {c.course_name && <span className="font-serif text-[11px] text-gray-600 ml-1">({c.course_name})</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="font-mono">{formatDateDot(record.issue_date)} – General</div>
                        )}
                      </td>

                      {/* University MO's Remarks */}
                      <td className="border border-gray-900 px-2 py-2 text-center">
                        <span className="font-semibold text-gray-900">{moRemark}</span>
                        {record.doctor_remarks && (
                          <div className="text-[10px] text-gray-600 mt-0.5 italic">{record.doctor_remarks}</div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Official Document Signatures Block */}
        <div className="mt-8 pt-4 flex justify-between items-start text-xs font-serif text-gray-900 print-avoid-break">
          <div className="w-64 space-y-1">
            <div className="border-t border-black pt-1.5 mb-1 w-56"></div>
            <div className="font-bold text-xs text-gray-900">Senior Assistant Registrar</div>
            <div className="text-gray-700 text-[11px]">Examination Branch / Faculty of Applied Sciences</div>
            <div className="text-gray-600 text-[10px]">Wayamba University of Sri Lanka</div>
          </div>

          <div className="w-64 space-y-1 text-right">
            <div className="border-t border-black pt-1.5 mb-1 w-56 ml-auto"></div>
            <div className="font-bold text-xs text-gray-900">Dean / Faculty Board</div>
            <div className="text-gray-700 text-[11px]">Faculty of Applied Sciences</div>
            <div className="text-gray-600 text-[10px]">Wayamba University of Sri Lanka</div>
          </div>
        </div>
      </div>
    </div>
  )
}
