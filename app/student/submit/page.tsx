'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStudent } from '../hooks/useStudent'
import {
  MAX_MEDICAL_FILES,
  VALID_MEDICAL_ISSUERS,
  calculateLeaveDays,
  generateAcademicYears,
  getCurrentAcademicYear,
  isWithinSevenCalendarDays,
  validateMedicalFile,
  type ExamCourseEntry,
} from '../../lib/validation'

const GENERAL_PURPOSES = [
  'Fever',
  'Cold & Flu',
  'Headache / Migraine',
  'Stomach Pain / Nausea',
  'Injury / Accident',
  'Skin Condition / Rash',
  'Eye / Ear Problem',
  'Dental Issue',
  'Back / Joint Pain',
  'Allergic Reaction',
  'Mental Health / Stress',
  'Chronic Condition',
  'Medication Request',
  'Lab Test / Report',
  'Routine Checkup',
  'Other (Please specify)',
]

export default function SubmitMedicalRecord() {
  const { student, loading } = useStudent()
  const router = useRouter()

  // Dynamic Academic Year list based on calendar year
  const dynamicAcademicYears = generateAcademicYears(5)

  // Submission Type: 'general' | 'exam'
  const [submissionType, setSubmissionType] = useState<'general' | 'exam'>('general')

  // Common Fields
  const [purpose, setPurpose] = useState('')
  const [customPurpose, setCustomPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const [holidays, setHolidays] = useState(0)
  const [issuerType, setIssuerType] = useState<string>('government_hospital')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Exam Fields with auto-calculated current academic year
  const [examAcademicYear, setExamAcademicYear] = useState(() => getCurrentAcademicYear())
  const [examSemester, setExamSemester] = useState('Semester I')
  const [illnessTiming, setIllnessTiming] = useState<'before_exam' | 'during_exam'>('before_exam')
  const [examCourses, setExamCourses] = useState<ExamCourseEntry[]>([
    { course_code: '', course_name: '', exam_date: '' },
  ])

  const actualStart = leaveStartDate || issueDate
  const actualEnd = leaveEndDate || actualStart
  const computedLeaveDays = actualStart && actualEnd && actualStart <= actualEnd
    ? calculateLeaveDays(actualStart, actualEnd)
    : 1

  const sevenDayCheck = isWithinSevenCalendarDays(actualStart)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }
  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index))

  const addCourseRow = () => {
    setExamCourses(prev => [...prev, { course_code: '', course_name: '', exam_date: '' }])
  }
  const removeCourseRow = (index: number) => {
    if (examCourses.length <= 1) return
    setExamCourses(prev => prev.filter((_, i) => i !== index))
  }
  const updateCourseRow = (index: number, field: keyof ExamCourseEntry, val: string) => {
    setExamCourses(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: val }
      return copy
    })
  }

  const getFinalPurpose = () => {
    if (submissionType === 'exam') return 'Absence at the Examination'
    if (purpose === 'Other (Please specify)') return customPurpose.trim() || 'Other'
    return purpose
  }

  const handleSubmit = async () => {
    if (!student) return

    const finalPurpose = getFinalPurpose()
    if (!finalPurpose || !issueDate) {
      setError('Please fill in all required fields.')
      return
    }

    if (submissionType === 'general' && purpose === 'Other (Please specify)' && !customPurpose.trim()) {
      setError('Please specify the purpose or select another option.')
      return
    }

    const start = leaveStartDate || issueDate
    const end = leaveEndDate || start
    if (start > end) {
      setError('Leave start date cannot be after leave end date.')
      return
    }

    if (submissionType === 'exam') {
      const validCourses = examCourses.filter(c => c.course_code.trim() && c.exam_date)
      if (validCourses.length === 0) {
        setError('Please add at least one missed course unit (Course Code and Exam Date).')
        return
      }
    }

    if (files.length === 0) {
      setError('Please attach at least one supporting medical document.')
      return
    }
    if (files.length > MAX_MEDICAL_FILES) {
      setError(`You can attach up to ${MAX_MEDICAL_FILES} documents.`)
      return
    }
    for (const file of files) {
      const validationError = validateMedicalFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setSubmitting(true)
    setError('')
    const payload = new FormData()
    payload.set('submission_type', submissionType)
    payload.set('purpose', finalPurpose)
    payload.set('description', description)
    payload.set('issue_date', issueDate)
    payload.set('leave_start_date', start)
    payload.set('leave_end_date', end)
    payload.set('number_of_holidays', String(Math.max(0, holidays || 0)))
    payload.set('issuer_type', issuerType)

    if (submissionType === 'exam') {
      payload.set('exam_academic_year', examAcademicYear)
      payload.set('exam_semester', examSemester)
      payload.set('illness_timing', illnessTiming)
      payload.set('exam_courses', JSON.stringify(examCourses.filter(c => c.course_code.trim())))
    }

    files.forEach(file => payload.append('files', file))

    const response = await fetch('/api/student/records', { method: 'POST', body: payload })
    const result = await response.json()
    if (!response.ok) {
      setError(result.error || 'Unable to submit the medical record.')
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setSuccess(true)
    setTimeout(() => router.push('/student/recordss'), 1500)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading student profile...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Medical Certificate</h1>
        <p className="text-xs text-gray-500 mt-1">
          Submit medical documentation for coursework attendance or examination absence under university bylaws.
        </p>
      </div>

      {/* Student Verification Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span>
            Submitting as: <strong className="font-semibold text-gray-900">{student?.full_name || 'Student'}</strong> (Index: <span className="font-mono">{student?.index_no}</span>)
          </span>
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span className="text-gray-600 hidden sm:inline">{student?.faculty || 'Applied Sciences'}</span>
        </div>
        {!student?.contact_no && (
          <Link href="/student/profile" className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 font-medium">
            <span>Add contact number in profile</span>
          </Link>
        )}
      </div>

      {/* Purpose Switcher: Harmonious Theme-Matching Styling */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2.5">
          Select Purpose of Medical Submission <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Coursework */}
          <button
            type="button"
            onClick={() => setSubmissionType('general')}
            style={{
              backgroundColor: submissionType === 'general' ? '#f4f9f9' : '#ffffff',
              borderColor: submissionType === 'general' ? '#218f8c' : '#e2e8f0',
              borderWidth: submissionType === 'general' ? '1.5px' : '1px',
            }}
            className="p-4 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer shadow-xs hover:opacity-95"
          >
            <div className="mt-0.5 flex-shrink-0">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  border: submissionType === 'general' ? '2px solid #218f8c' : '1.5px solid #cbd5e1',
                  backgroundColor: submissionType === 'general' ? '#218f8c' : '#ffffff',
                }}
              >
                {submissionType === 'general' && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffffff' }} />
                )}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#0c1425' }}>
                Coursework & Lecture Medical
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#59606d' }}>
                For daily lectures, laboratory practicals, and tutorial attendance.
              </p>
            </div>
          </button>

          {/* Card 2: Examination */}
          <button
            type="button"
            onClick={() => setSubmissionType('exam')}
            style={{
              backgroundColor: submissionType === 'exam' ? '#f4f9f9' : '#ffffff',
              borderColor: submissionType === 'exam' ? '#218f8c' : '#e2e8f0',
              borderWidth: submissionType === 'exam' ? '1.5px' : '1px',
            }}
            className="p-4 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer shadow-xs hover:opacity-95"
          >
            <div className="mt-0.5 flex-shrink-0">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  border: submissionType === 'exam' ? '2px solid #218f8c' : '1.5px solid #cbd5e1',
                  backgroundColor: submissionType === 'exam' ? '#218f8c' : '#ffffff',
                }}
              >
                {submissionType === 'exam' && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffffff' }} />
                )}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#0c1425' }}>
                Examination Absence Medical
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#59606d' }}>
                For missed semester examinations to request First Attempt concession.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Prominent 7-Day Deadline Regulation Alert Banner */}
      {submissionType === 'exam' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
          <div className="font-bold flex items-center gap-2 text-amber-950">
            <svg className="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            University Examination Regulation (7-Calendar-Day Rule)
          </div>
          <p className="leading-relaxed text-amber-900">
            Under University By-laws, a Medical Certificate supporting examination absence must be submitted within <strong>seven (07) calendar days</strong> of the commencement of the illness. Submissions beyond 7 days will be flagged for Senate / Faculty Board consideration.
          </p>
          {actualStart && !sevenDayCheck.withinDays && (
            <div className="bg-white/80 border border-amber-300 rounded-lg px-3 py-1.5 font-medium text-[11px] text-amber-900">
              Note: This submission is {sevenDayCheck.daysDifference} days from illness commencement.
            </div>
          )}
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Details */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {submissionType === 'exam' ? 'Examination & Illness Details' : 'Medical Details'}
          </h2>

          {/* General Medical Purpose Selector */}
          {submissionType === 'general' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Purpose / Symptoms <span className="text-red-500">*</span>
              </label>
              <select
                value={purpose}
                onChange={e => {
                  setPurpose(e.target.value)
                  if (e.target.value !== 'Other (Please specify)') setCustomPurpose('')
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800"
              >
                <option value="">Select illness / reason...</option>
                {GENERAL_PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {purpose === 'Other (Please specify)' && (
                <input
                  type="text"
                  value={customPurpose}
                  onChange={e => setCustomPurpose(e.target.value)}
                  placeholder="Specify illness reason..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-800 mt-2"
                />
              )}
            </div>
          )}

          {/* Exam Medical Specific Fields */}
          {submissionType === 'exam' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Academic Year</label>
                  <select
                    value={examAcademicYear}
                    onChange={e => setExamAcademicYear(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800"
                  >
                    {dynamicAcademicYears.map(ay => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Semester</label>
                  <select
                    value={examSemester}
                    onChange={e => setExamSemester(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800"
                  >
                    <option value="Semester I">Semester I</option>
                    <option value="Semester II">Semester II</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  When did the illness occur? <span className="text-red-500">*</span>
                </label>
                <select
                  value={illnessTiming}
                  onChange={e => setIllnessTiming(e.target.value as 'before_exam' | 'during_exam')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800"
                >
                  <option value="before_exam">Prior to Exam (Did not attend)</option>
                  <option value="during_exam">During Exam (Fell sick after receiving question paper)</option>
                </select>
              </div>

              {/* Dynamic Missed Course Units Table */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Missed Course Units / Papers <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addCourseRow}
                    className="text-xs text-blue-800 hover:text-blue-900 font-semibold cursor-pointer"
                  >
                    + Add Course Paper
                  </button>
                </div>

                <div className="space-y-2">
                  {examCourses.map((c, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                        <span>Paper #{idx + 1}</span>
                        {examCourses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCourseRow(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Code (e.g. CMIS 1131)"
                          value={c.course_code}
                          onChange={e => updateCourseRow(idx, 'course_code', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-800 uppercase font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Paper Title (e.g. Data Structures)"
                          value={c.course_name}
                          onChange={e => updateCourseRow(idx, 'course_name', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-800"
                        />
                        <input
                          type="date"
                          placeholder="Exam Date"
                          value={c.exam_date}
                          onChange={e => updateCourseRow(idx, 'exam_date', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-800 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Medical Issuer */}
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Issuing Medical Authority <span className="text-red-500">*</span>
            </label>
            <select
              value={issuerType}
              onChange={e => setIssuerType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800"
            >
              {VALID_MEDICAL_ISSUERS.map(i => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          {/* Certificate Issue Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Certificate Issue Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={e => {
                const val = e.target.value
                setIssueDate(val)
                if (!leaveStartDate) setLeaveStartDate(val)
                if (!leaveEndDate) setLeaveEndDate(val)
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800 font-mono"
            />
          </div>

          {/* Duration of Leave */}
          <div className="border border-gray-200 bg-gray-50/50 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Valid Leave Duration</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-full">
                {computedLeaveDays} {computedLeaveDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">From Date</label>
                <input
                  type="date"
                  value={leaveStartDate || issueDate}
                  onChange={e => setLeaveStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">To Date</label>
                <input
                  type="date"
                  value={leaveEndDate || leaveStartDate || issueDate}
                  onChange={e => setLeaveEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-800 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Statement & Uploads */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clinical Statement & Documents</h2>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Ailment / Clinical Statement (Optional)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the medical diagnosis, symptoms, or hospital admission details..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-800 focus:bg-white focus:border-blue-800 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Document Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Upload Medical Certificate <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-200 hover:border-blue-800 rounded-xl p-4 text-center bg-gray-50/30 transition-colors">
              <input
                type="file"
                id="med-files"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="med-files" className="cursor-pointer flex flex-col items-center gap-1">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs font-semibold text-blue-800">Browse documents</span>
                <span className="text-[10px] text-gray-400">PDF, JPG, or PNG (up to 5 files, 10MB each)</span>
              </label>
            </div>

            {/* Selected File List */}
            {files.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700">
                    <span className="truncate max-w-[200px]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              Medical certificate submitted successfully! Redirecting to My Records...
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 py-3 text-xs font-semibold text-white shadow-sm transition-colors"
          >
            {submitting ? 'Submitting Application...' : 'Submit Medical Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
