'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStudent } from '../hooks/useStudent'
import type { ExamCourseEntry } from '../../lib/validation'

type AdvanceNotice = {
  notice_id: number
  submission_type: 'general' | 'exam'
  illness_start_date: string
  expected_end_date: string | null
  reason: string
  treatment_status: string | null
  hospital_name: string | null
  affected_courses: ExamCourseEntry[] | null
  contact_number: string | null
  status: 'pending' | 'acknowledged' | 'medical_submitted'
  created_at: string
}

export default function InformDeanPage() {
  const { student, loading: studentLoading } = useStudent()
  const router = useRouter()

  const [notices, setNotices] = useState<AdvanceNotice[]>([])
  const [loadingNotices, setLoadingNotices] = useState(true)

  // Form State
  const [submissionType, setSubmissionType] = useState<'general' | 'exam'>('exam')
  const [illnessStartDate, setIllnessStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [treatmentStatus, setTreatmentStatus] = useState('Resting at Home / Outpatient')
  const [hospitalName, setHospitalName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [examCourses, setExamCourses] = useState<ExamCourseEntry[]>([
    { course_code: '', course_name: '', exam_date: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const fetchNotices = async () => {
    try {
      const res = await fetch('/api/student/advance-notice')
      const data = await res.json()
      if (res.ok) setNotices(data.notices || [])
    } catch {
      // ignore
    } finally {
      setLoadingNotices(false)
    }
  }

  useEffect(() => {
    void fetchNotices()
  }, [])

  useEffect(() => {
    if (student?.contact_no) {
      setContactNumber(student.contact_no)
    }
  }, [student])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return

    if (!illnessStartDate) {
      setError('Please provide the illness start date.')
      return
    }
    if (reason.trim().length < 5) {
      setError('Please provide a brief description of symptoms / reason (at least 5 characters).')
      return
    }

    if (submissionType === 'exam') {
      const validCourses = examCourses.filter(c => c.course_code.trim())
      if (validCourses.length === 0) {
        setError('Please list at least one missed exam course unit / paper.')
        return
      }
    }

    setSubmitting(true)
    setError('')

    const payload = {
      submission_type: submissionType,
      illness_start_date: illnessStartDate,
      expected_end_date: expectedEndDate || illnessStartDate,
      reason: reason.trim(),
      treatment_status: treatmentStatus,
      hospital_name: hospitalName.trim() || null,
      contact_number: contactNumber.trim() || null,
      affected_courses: submissionType === 'exam' ? examCourses.filter(c => c.course_code.trim()) : null,
    }

    try {
      const res = await fetch('/api/student/advance-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Failed to submit advance notice.')
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setReason('')
      setHospitalName('')
      void fetchNotices()
      setTimeout(() => setSuccess(false), 5000)
    } catch {
      setError('Network error submitting notice.')
    } finally {
      setSubmitting(false)
    }
  }

  if (studentLoading) return <div className="p-8 text-xs text-slate-400">Loading student profile...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Inform Dean of Illness (Advance Medical Notice)</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Official early notification protocol for students unable to attend lectures or examinations due to sudden illness.
        </p>
      </div>

      {/* Protocol Alert Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
        <div className="font-bold flex items-center gap-2 text-indigo-900">
          <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Why submit an Advance Notice?
        </div>
        <p className="text-indigo-900/90 leading-relaxed">
          If hospital medical certificates take time to be issued, submitting this digital notice immediately creates an official, timestamped intimation in the Dean's register. This satisfies university early notification requirements while you obtain and upload the physical medical certificate within 7 calendar days.
        </p>
      </div>

      {/* Main Grid: Form (Left) & Past Notices (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Submit Early Illness Intimation
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Purpose Switcher */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Absence Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSubmissionType('exam')}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                    submissionType === 'exam'
                      ? 'bg-purple-50 border-purple-500 text-purple-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>Examination Absence</div>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5">Missed semester papers</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSubmissionType('general')}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                    submissionType === 'general'
                      ? 'bg-blue-50 border-blue-500 text-blue-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>Coursework / Lectures</div>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5">Daily attendance</p>
                </button>
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Illness Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={illnessStartDate}
                  onChange={e => setIllnessStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  value={expectedEndDate}
                  onChange={e => setExpectedEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>
            </div>

            {/* Treatment Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Current Treatment Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={treatmentStatus}
                  onChange={e => setTreatmentStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                >
                  <option value="Resting at Home / Outpatient">Resting at Home / Outpatient</option>
                  <option value="Hospital Inward Admission">Hospital Inward Admission</option>
                  <option value="Government Hospital OPD">Government Hospital OPD</option>
                  <option value="Private Medical Center">Private Medical Center</option>
                  <option value="Quarantine / Isolation">Quarantine / Isolation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Hospital / Clinic Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Teaching Hospital Kurunegala"
                  value={hospitalName}
                  onChange={e => setHospitalName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Exam Missed Papers (if exam) */}
            {submissionType === 'exam' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Missed Exam Paper(s) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addCourseRow}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    + Add Paper
                  </button>
                </div>

                <div className="space-y-2">
                  {examCourses.map((c, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Paper #{idx + 1}</span>
                        {examCourses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCourseRow(idx)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Course Code (e.g. CMIS 2122)"
                          value={c.course_code}
                          onChange={e => updateCourseRow(idx, 'course_code', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-600 uppercase font-mono"
                        />
                        <input
                          type="date"
                          value={c.exam_date}
                          onChange={e => updateCourseRow(idx, 'exam_date', e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-600 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason / Symptoms Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Symptoms / Reason for Absence <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Briefly state symptoms, medical condition, or reasons preventing attendance..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none transition-colors resize-none"
                required
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Emergency Contact Number
              </label>
              <input
                type="text"
                placeholder="e.g. 0771234567"
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono"
              />
            </div>

            {/* Error / Success Feedback */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                Advance Medical Notice successfully sent to the Dean's office! Remember to upload your physical Medical Certificate within 7 days.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 py-3 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              {submitting ? 'Sending Notice to Dean...' : 'Send Advance Notice to Dean'}
            </button>
          </form>
        </div>

        {/* Right Column: History of Advance Notices (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              My Advance Notices on Record
            </h2>
            <p className="text-[11px] text-slate-500">
              Receipts of your early intimations sent to the Dean.
            </p>

            {loadingNotices ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading notices...</div>
            ) : notices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No advance notices submitted yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {notices.map(n => (
                  <div key={n.notice_id} className="border border-slate-200 bg-slate-50/60 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-slate-900">ADV-{n.notice_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        n.status === 'medical_submitted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {n.status === 'medical_submitted' ? 'Medical Uploaded & Linked' : 'Intimation Recorded'}
                      </span>
                    </div>

                    <div className="text-slate-800 font-medium">{n.reason}</div>
                    <div className="text-slate-500 text-[11px] font-mono">
                      Illness: {n.illness_start_date} {n.expected_end_date ? `to ${n.expected_end_date}` : ''}
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span>Submitted: {new Date(n.created_at).toLocaleDateString()}</span>
                      {n.status !== 'medical_submitted' && (
                        <Link
                          href="/student/submit"
                          className="text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Upload Medical Cert →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
