'use client'

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import { extractBatchFromIndex, type ExamCourseEntry } from '../../lib/validation'

const supabase = createBrowserSupabaseClient()

type ExamRecordWithStudent = TableRow<'medical_records'> & {
  students: Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty'> | null
}

export default function ExamSchedulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading exam schedules...</div>}>
      <ExamSchedulesContent />
    </Suspense>
  )
}

function ExamSchedulesContent() {
  const [records, setRecords] = useState<ExamRecordWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('All')
  const [selectedSemester, setSelectedSemester] = useState<string>('All')
  const [selectedBatch, setSelectedBatch] = useState<string>('All')
  const [selectedDecision, setSelectedDecision] = useState<string>('All')

  // Memo header customization
  const [memoNo, setMemoNo] = useState('217')
  const [customTerm, setCustomTerm] = useState('')

  // Ratification state
  const [ratifying, setRatifying] = useState(false)
  const [ratifySuccess, setRatifySuccess] = useState('')

  const fetchExamRecords = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('medical_records')
      .select('*, students(full_name, index_no, faculty)')
      .eq('submission_type', 'exam')
      .eq('lifecycle_status', 'active')
      .order('issue_date', { ascending: true })

    if (fetchErr) {
      setError(fetchErr.message)
      setRecords([])
    } else {
      setRecords(
        (data || []).map(r => ({
          ...r,
          students: Array.isArray(r.students) ? r.students[0] || null : r.students,
        }))
      )
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchExamRecords()

    const channel = supabase
      .channel('faculty-exam-schedules-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => {
        void fetchExamRecords()
      })
      .subscribe()

    const onFocus = () => void fetchExamRecords()
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      void supabase.removeChannel(channel)
    }
  }, [fetchExamRecords])

  // Extract distinct academic years
  const availableAcademicYears = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => {
      if (r.exam_academic_year) set.add(r.exam_academic_year)
    })
    return ['All', ...Array.from(set).sort().reverse()]
  }, [records])

  // Extract distinct batches
  const availableBatches = useMemo(() => {
    const set = new Set<string>()
    records.forEach(r => {
      const b = extractBatchFromIndex(r.students?.index_no || '')
      if (b && b !== 'General') set.add(b)
    })
    return ['All', ...Array.from(set).sort()]
  }, [records])

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesYear = selectedAcademicYear === 'All' || r.exam_academic_year === selectedAcademicYear
      const matchesSem = selectedSemester === 'All' || r.exam_semester === selectedSemester
      const batch = extractBatchFromIndex(r.students?.index_no || '')
      const matchesBatch = selectedBatch === 'All' || batch === selectedBatch
      const matchesDecision = selectedDecision === 'All' || (r.faculty_board_decision || 'Pending') === selectedDecision
      return matchesYear && matchesSem && matchesBatch && matchesDecision
    })
  }, [records, selectedAcademicYear, selectedSemester, selectedBatch, selectedDecision])

  // Confirm and Ratify all filtered exam medicals by Faculty Board
  const handleRatifyByFacultyBoard = async () => {
    if (filteredRecords.length === 0 || ratifying) return
    const pendingCount = filteredRecords.filter(r => r.faculty_board_decision !== 'Approved').length
    if (pendingCount === 0) {
      alert('All selected records are already approved by Faculty Board.')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to ratify and officially approve ${pendingCount} exam medical record(s) under Memo FB/${memoNo}/?`
    )
    if (!confirmed) return

    setRatifying(true)
    setRatifySuccess('')

    const recordIds = filteredRecords.map(r => r.record_id)
    const today = new Date().toISOString().slice(0, 10)

    const { error: updateErr } = await supabase
      .from('medical_records')
      .update({
        faculty_board_decision: 'Approved',
        faculty_board_memo_no: `FB/${memoNo}/`,
        faculty_board_date: today,
        status: 'approved',
        workflow_stage: 'finalized',
      })
      .in('record_id', recordIds)

    setRatifying(false)

    if (updateErr) {
      alert(updateErr.message || 'Unable to ratify records.')
      return
    }

    setRatifySuccess(`Successfully ratified ${recordIds.length} examination medical(s) by Faculty Board under Memo FB/${memoNo}/!`)
    void fetchExamRecords()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('No examination records match the current filters to export.')
      return
    }

    const headers = [
      'No',
      'Memo No',
      'Academic Year',
      'Semester',
      'Batch',
      'Index No',
      'Student Name',
      'Degree Programme',
      'Subject Codes',
      'Examination Dates',
      'Timing of Illness',
      'Illness / Purpose',
      'UMO Recommendation',
      'Faculty Board Decision',
      'Concession',
      'Ratified Date',
    ]

    const rows = filteredRecords.map((r, idx) => {
      const courses: ExamCourseEntry[] = Array.isArray(r.exam_courses) ? (r.exam_courses as any) : []
      const subjectCodes = courses.map(c => `${c.course_code} (${c.course_name})`).join('; ')
      const examDates = courses.map(c => `${c.course_code}: ${c.exam_date}`).join('; ')
      const batch = extractBatchFromIndex(r.students?.index_no || '')

      return [
        idx + 1,
        r.faculty_board_memo_no || `FB/${memoNo}/`,
        r.exam_academic_year || 'N/A',
        r.exam_semester || 'N/A',
        batch || 'N/A',
        r.students?.index_no || 'N/A',
        `"${(r.students?.full_name || 'N/A').replace(/"/g, '""')}"`,
        `"${(r.exam_degree_programme || 'B.Sc. Joint Major / Honours').replace(/"/g, '""')}"`,
        `"${subjectCodes.replace(/"/g, '""')}"`,
        `"${examDates.replace(/"/g, '""')}"`,
        r.illness_timing === 'during_exam' ? 'Fell ill during exam' : 'Prior to exam',
        `"${(r.purpose || r.diagnosis || 'Medical Illness').replace(/"/g, '""')}"`,
        r.doctor_recommendation || 'Recommended',
        r.faculty_board_decision || 'Pending',
        'First Attempt',
        r.faculty_board_date || 'N/A',
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Faculty_Board_Memo_FB_${memoNo}_Exam_Absence_Schedule.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Format date to DD.MM.YYYY
  const formatDateDot = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-0">
      {/* Control Bar - Hidden during printing */}
      <div className="print:hidden bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
                Faculty Board & Senate
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">
              Examination Medical Absence Schedules (Memo FB)
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Excuses given by students for absence of examinations for Faculty Board review and condonation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => void fetchExamRecords()}
              className="h-9 border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={handleRatifyByFacultyBoard}
              disabled={ratifying || filteredRecords.length === 0}
              className="h-9 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {ratifying ? 'Ratifying...' : 'Confirm & Ratify (Faculty Board)'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="h-9 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="Download schedule in Excel / CSV format"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className="h-9 bg-blue-800 hover:bg-blue-900 text-white px-3.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Academic Year</label>
            <select
              value={selectedAcademicYear}
              onChange={e => setSelectedAcademicYear(e.target.value)}
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs focus:outline-none focus:border-blue-800"
            >
              {availableAcademicYears.map(y => (
                <option key={y} value={y}>{y === 'All' ? 'All Academic Years' : y}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Semester</label>
            <select
              value={selectedSemester}
              onChange={e => setSelectedSemester(e.target.value)}
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs focus:outline-none focus:border-blue-800"
            >
              <option value="All">All Semesters</option>
              <option value="Semester I">Semester I</option>
              <option value="Semester II">Semester II</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Batch Filter</label>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs focus:outline-none focus:border-blue-800"
            >
              {availableBatches.map(b => (
                <option key={b} value={b}>{b === 'All' ? 'All Batches' : b}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Memo No (FB/xxx/)</label>
            <input
              type="text"
              value={memoNo}
              onChange={e => setMemoNo(e.target.value)}
              placeholder="e.g. 217"
              className="h-9 border border-gray-200 rounded-lg px-3 bg-gray-50/50 text-xs focus:outline-none focus:border-blue-800 font-mono"
            />
          </div>
        </div>

        {/* Success Alert */}
        {ratifySuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{ratifySuccess}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="print:hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* OFFICIAL FACULTY BOARD MEMO DOCUMENT (Matches Physical Image 1 Format) */}
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
            Memo FB/{memoNo || '217'}/
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
            Level 1,2,3,4 - {selectedSemester !== 'All' ? selectedSemester : 'Semester I'} Examination - Academic Year {selectedAcademicYear !== 'All' ? selectedAcademicYear : '2024/2025'}
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
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-900 py-8 text-center text-gray-400 font-serif">
                    No examination medical records found matching selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, index) => {
                  const courses: ExamCourseEntry[] = Array.isArray(r.exam_courses) ? (r.exam_courses as unknown as ExamCourseEntry[]) : []
                  const moRemark = r.doctor_recommendation || (r.status === 'approved' ? 'Recommended' : 'Pending UMO Review')

                  return (
                    <tr key={r.record_id} className="border-b border-gray-900 align-top font-serif">
                      {/* Ser. No. */}
                      <td className="border border-gray-900 px-1.5 py-2 text-center font-medium">
                        {String(index + 1).padStart(2, '0')}.
                      </td>

                      {/* Name */}
                      <td className="border border-gray-900 px-2 py-2 font-medium text-gray-900">
                        {r.students?.full_name || 'Student'}
                      </td>

                      {/* Reg. No. */}
                      <td className="border border-gray-900 px-1.5 py-2 text-center font-mono font-semibold text-gray-900">
                        {r.students?.index_no || '-'}
                      </td>

                      {/* Date of Submission */}
                      <td className="border border-gray-900 px-2 py-2 text-center font-mono text-gray-800">
                        {formatDateDot(r.created_at || r.issue_date)}
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
                          <div className="font-mono">{formatDateDot(r.issue_date)} – General</div>
                        )}
                      </td>

                      {/* University MO's Remarks */}
                      <td className="border border-gray-900 px-2 py-2 text-center text-xs font-semibold">
                        <div className={moRemark === 'Recommended' ? 'text-emerald-900 print:text-black font-bold' : moRemark === 'Not Recommended' ? 'text-red-800 print:text-black font-bold' : 'text-gray-500'}>
                          {moRemark}
                        </div>
                        {r.doctor_remarks && (
                          <div className="text-[10px] text-gray-600 font-normal mt-0.5 italic">
                            {r.doctor_remarks}
                          </div>
                        )}
                        {r.faculty_board_decision === 'Approved' && (
                          <div className="text-[10px] text-blue-900 print:text-black font-bold mt-0.5">
                            [FB Confirmed]
                          </div>
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
