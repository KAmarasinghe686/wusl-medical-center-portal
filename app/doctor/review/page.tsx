'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDoctor } from '../hooks/useDoctor'
import type { RecordStatus } from '../../lib/supabase/database.types'
import { VALID_MEDICAL_ISSUERS, type ExamCourseEntry } from '../../lib/validation'

type StudentSummary = {
  full_name: string
  index_no: string
  faculty: string | null
  dob: string | null
  address: string | null
  contact_no: string | null
  academic_year: string | null
  gender: string | null
}

type MedicalRecord = {
  record_id: number
  purpose: string
  issue_date: string
  leave_start_date: string | null
  leave_end_date: string | null
  leave_days_count: number
  number_of_holidays: number
  previous_leave_summary: string | null
  status: RecordStatus
  workflow_stage: string
  submission_type: 'general' | 'exam'
  issuer_type: string | null
  doctor_name: string | null
  illness_timing: string | null
  exam_academic_year: string | null
  exam_semester: string | null
  exam_degree_programme: string | null
  exam_courses: ExamCourseEntry[] | null
  doctor_recommendation: string | null
  doctor_remarks: string | null
  faculty_board_decision: string | null
  description: string | null
  rejection_reason: string | null
  diagnosis: string | null
  observation_notes: string | null
  recommendation: string | null
  resubmission_reason: string | null
  resubmission_details: string | null
  resubmission_count: number
  students: StudentSummary | null
}

type RecordImage = {
  image_id: number
  file_path: string
  file_size_kb: number
  document_type?: string | null
}

export default function ReviewRecordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <ReviewRecord />
    </Suspense>
  )
}

function ReviewRecord() {
  const { doctor, loading, error: doctorError, supabase, refetch } = useDoctor()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const recordId = id ? Number(id) : null
  const router = useRouter()
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [images, setImages] = useState<RecordImage[]>([])
  
  // General assessment states
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reversalReason, setReversalReason] = useState('')

  // Exam medical recommendation states
  const [examDecision, setExamDecision] = useState<'Recommended' | 'Not Recommended'>('Recommended')
  const [examRemarks, setExamRemarks] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [recordLoading, setRecordLoading] = useState(true)
  const [recordError, setRecordError] = useState('')
  const [actionError, setActionError] = useState('')
  const doctorId = doctor?.doctor_id

  useEffect(() => {
    if (!recordId || !doctorId) return
    let active = true

    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty, dob, address, contact_no, academic_year, gender)')
        .eq('record_id', recordId)
        .eq('lifecycle_status', 'active')
        .single()

      if (!active) return
      if (error || !data) {
        setRecordError(error?.message || 'Record not found or no longer available for review.')
        setRecordLoading(false)
        return
      }

      setRecord({
        ...data,
        students: Array.isArray(data.students) ? data.students[0] || null : data.students,
        exam_courses: Array.isArray(data.exam_courses) ? data.exam_courses : null,
      })
      setDiagnosis(data.diagnosis || '')
      setNotes(data.observation_notes || '')
      setRecommendation(data.recommendation || '')
      setExamDecision((data.doctor_recommendation as 'Recommended' | 'Not Recommended') || 'Recommended')
      setExamRemarks(data.doctor_remarks || '')

      const { data: imagesData } = await supabase
        .from('record_images')
        .select('*')
        .eq('record_id', recordId)
        .eq('disposal_status', 'retained')
      setImages(imagesData || [])
      setRecordLoading(false)
    }

    void fetchRecord()
    return () => { active = false }
  }, [doctorId, recordId, supabase])

  // General Medical: Approve Handler
  const handleApprove = async () => {
    if (!record || submitting) return
    if (!doctorId) {
      setActionError('Your doctor profile is not ready. Please retry before reviewing this record.')
      return
    }
    if (record.status !== 'pending' && !reversalReason.trim()) {
      alert('Please provide a reason for reversing this decision.')
      return
    }
    setSubmitting(true)
    setActionError('')
    const { error } = await supabase.rpc('review_medical_record', {
      p_record_id: record.record_id,
      p_expected_status: record.status,
      p_new_status: 'approved',
      p_diagnosis: diagnosis.trim() || null,
      p_observation_notes: notes.trim() || null,
      p_recommendation: recommendation.trim() || null,
      p_rejection_reason: null,
      p_reversal_reason: reversalReason.trim() || null,
    })
    setSubmitting(false)

    if (error) {
      setActionError(error.message || 'This record was updated by another doctor. Return to the records list and try again.')
      return
    }
    router.push('/doctor/records')
  }

  // General Medical: Reject Handler
  const handleReject = async () => {
    if (!record || submitting) return
    if (!doctorId) {
      setActionError('Your doctor profile is not ready. Please retry before reviewing this record.')
      return
    }
    if (record.status !== 'pending' && !reversalReason.trim()) {
      alert('Please provide a reason for reversing this decision.')
      return
    }
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.')
      return
    }
    setSubmitting(true)
    setActionError('')
    const { error } = await supabase.rpc('review_medical_record', {
      p_record_id: record.record_id,
      p_expected_status: record.status,
      p_new_status: 'rejected',
      p_diagnosis: diagnosis.trim() || null,
      p_observation_notes: notes.trim() || null,
      p_recommendation: recommendation.trim() || null,
      p_rejection_reason: rejectionReason.trim(),
      p_reversal_reason: reversalReason.trim() || null,
    })
    setSubmitting(false)

    if (error) {
      setActionError(error.message || 'This record was updated by another doctor. Return to the records list and try again.')
      return
    }
    router.push('/doctor/records')
  }

  // Exam Medical: Submit Medical Officer Recommendation to Faculty Board
  const handleExamMedicalSubmit = async () => {
    if (!record || submitting || !doctorId) return

    if (examDecision === 'Not Recommended' && !examRemarks.trim()) {
      alert('Under university regulations, entering a clinical reason for "Not Recommended" is mandatory.')
      return
    }

    setSubmitting(true)
    setActionError('')

    const { error: updateError } = await supabase
      .from('medical_records')
      .update({
        doctor_recommendation: examDecision,
        doctor_remarks: examRemarks.trim() || null,
        reviewed_by: doctorId,
        workflow_stage: 'faculty_board',
        diagnosis: diagnosis.trim() || null,
        observation_notes: notes.trim() || null,
      })
      .eq('record_id', record.record_id)

    setSubmitting(false)

    if (updateError) {
      setActionError(updateError.message || 'Unable to submit recommendation.')
      return
    }

    alert(`Successfully recorded MO Recommendation: ${examDecision}. Forwarded to Faculty Board.`)
    router.push('/doctor/records')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!doctorId) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Doctor Profile Unavailable</h1>
      <p className="text-sm text-gray-500 mb-2">Your doctor profile could not be loaded. Retry before reviewing a medical record.</p>
      {doctorError && <p className="text-xs text-red-600 mb-4">{doctorError}</p>}
      <button onClick={() => { void refetch() }} className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 text-sm font-semibold rounded-lg transition-colors">
        Retry
      </button>
    </div>
  )
  if (!id) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Record</h1>
      <p className="text-sm text-gray-500">Please select a record from the <Link href="/doctor/records" className="text-blue-800 underline">Review Queue</Link>.</p>
    </div>
  )
  if (recordLoading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (recordError) return <div className="p-8 text-sm text-red-600">{recordError}</div>
  if (!record) return <div className="p-8 text-sm text-gray-400">Record not found.</div>

  const isExam = record.submission_type === 'exam'
  const isPending = record.status === 'pending'
  const isApproved = record.status === 'approved'
  const isRejected = record.status === 'rejected'

  const issuerLabel = VALID_MEDICAL_ISSUERS.find(i => i.value === record.issuer_type)?.label || record.issuer_type || 'Authorized Medical Practitioner'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link href="/doctor/records" className="hover:text-blue-800">Review Queue</Link>
          <span>/</span>
          <span className="text-blue-800 font-medium">REC-{record.record_id}</span>
        </div>
        {isExam ? (
          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-900 rounded-full border border-amber-200">
            Examination Medical
          </span>
        ) : (
          <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-900 rounded-full border border-blue-200">
            Coursework Medical
          </span>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">
        {isExam ? 'Evaluate Examination Medical Application' : 'Review Medical Record'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Student & Record Details */}
        <div className="space-y-5">
          {/* Student Profile Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Student Profile</h2>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-800 text-white flex items-center justify-center text-base font-bold rounded-full flex-shrink-0">
                {record.students?.full_name?.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{record.students?.full_name}</div>
                <div className="text-xs text-gray-500 font-mono">{record.students?.index_no}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Faculty</span>
                <div className="font-medium text-gray-800">{record.students?.faculty || 'Applied Sciences'}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Academic Year</span>
                <div className="font-medium text-gray-800">
                  {record.students?.academic_year ? `Year ${record.students.academic_year}` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Contact No</span>
                <div className="font-medium text-gray-800">{record.students?.contact_no || 'Not provided'}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Date of Birth</span>
                <div className="font-medium text-gray-800">{record.students?.dob || 'N/A'}</div>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Residential Address</span>
                <div className="font-medium text-gray-800 mt-0.5 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100 text-[11px]">
                  {record.students?.address || 'Address not updated in student profile'}
                </div>
              </div>
            </div>
          </div>

          {/* Exam Medical Missed Course Units Card */}
          {isExam && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Missed Examination Papers
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs pb-3 border-b border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Academic Year</span>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{record.exam_academic_year || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Semester</span>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{record.exam_semester || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Illness Occurrence Timing</span>
                  <div className="text-xs font-medium text-gray-800 mt-0.5">
                    {record.illness_timing === 'during_exam' ? 'During Examination (after receiving question paper)' : 'Prior to Examination'}
                  </div>
                </div>
              </div>

              {/* Table of Missed Papers */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">Registered Papers Missed:</div>
                {record.exam_courses && record.exam_courses.length > 0 ? (
                  record.exam_courses.map((c, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-900 font-mono">{c.course_code}</span>
                        {c.course_name && <span className="text-gray-700 ml-2 font-medium">— {c.course_name}</span>}
                      </div>
                      <div className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">
                        {c.exam_date.replace(/-/g, '.')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 italic">No specific course codes listed.</div>
                )}
              </div>
            </div>
          )}

          {/* Submission Details Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Medical Certificate Info</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Record ID</span>
                <div className="font-bold text-gray-900 font-mono">REC-{record.record_id}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Issue Date</span>
                <div className="font-medium text-gray-800">{record.issue_date}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Issuing Medical Authority</span>
                <div className="font-medium text-gray-800">{issuerLabel}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Issuing Doctor / Practitioner</span>
                <div className="font-medium text-gray-800">{record.doctor_name || 'Not specified'}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Valid Duration</span>
                <div className="font-mono text-gray-800 text-[11px]">
                  {record.leave_start_date || record.issue_date} TO {record.leave_end_date || record.leave_start_date || record.issue_date}
                </div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Duration Count</span>
                <div className="font-medium text-gray-800">{record.leave_days_count || 1} day(s)</div>
              </div>
            </div>

            {record.description && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Reported Symptoms / Diagnosis</span>
                <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-1">
                  {record.description}
                </div>
              </div>
            )}
          </div>

          {/* Uploaded Documents - Strictly Medical Certificates Only (Privacy Filtered) */}
          {images.filter(img =>
            img.document_type === 'medical_certificate' ||
            img.file_path.includes('med-cert') ||
            (!img.file_path.includes('letter-dean') && img.document_type !== 'letter_to_dean')
          ).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                  Medical Certificate (Clinical Record)
                </h2>
                <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  Clinical Document
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {images
                  .filter(img =>
                    img.document_type === 'medical_certificate' ||
                    img.file_path.includes('med-cert') ||
                    (!img.file_path.includes('letter-dean') && img.document_type !== 'letter_to_dean')
                  )
                  .map(img => (
                    <div key={img.image_id} className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs text-gray-700 truncate">{img.file_path.split('/').pop()}</span>
                        <span className="text-[10px] text-gray-400">({img.file_size_kb}KB)</span>
                      </div>
                      <button
                        onClick={async () => {
                          const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60)
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                        }}
                        className="text-xs text-blue-800 hover:text-blue-900 font-semibold px-2 py-1 rounded bg-blue-50"
                      >
                        View Document
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Doctor Assessment / Recommendation Form */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {isExam ? 'UMO Recommendation for Faculty Board' : 'Medical Officer Assessment'}
          </h2>

          {actionError && (
            <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-xl p-3" role="alert">
              {actionError}
            </div>
          )}

          {/* Clinical Assessment Notes */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Diagnosis / Condition</label>
              <textarea
                rows={2}
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="Confirmed diagnosis..."
                className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Observation Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Clinical observations regarding incapacity duration..."
                className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:border-blue-800 resize-none"
              />
            </div>
          </div>

          {/* EXAM MEDICAL DECISION */}
          {isExam ? (
            <div className="space-y-4 pt-3 border-t border-gray-100">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  University MO's Recommendation <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExamDecision('Recommended')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${
                      examDecision === 'Recommended'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-600/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamDecision('Not Recommended')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${
                      examDecision === 'Not Recommended'
                        ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600/20'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Not Recommended
                  </button>
                </div>
              </div>

              {/* Mandatory remarks when Not Recommended */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Remarks / Grounds for Recommendation{' '}
                  {examDecision === 'Not Recommended' && <span className="text-red-500">* (Mandatory)</span>}
                </label>
                <textarea
                  rows={3}
                  value={examRemarks}
                  onChange={e => setExamRemarks(e.target.value)}
                  placeholder={
                    examDecision === 'Not Recommended'
                      ? 'Specify clinical grounds for non-recommendation (e.g. invalid dates, lack of clinic stamp, insufficient clinical proof)...'
                      : 'Additional remarks for Faculty Board (Optional)...'
                  }
                  className={`w-full border rounded-xl p-2.5 text-xs bg-gray-50/50 focus:bg-white focus:outline-none resize-none ${
                    examDecision === 'Not Recommended' && !examRemarks.trim()
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-blue-800'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleExamMedicalSubmit}
                disabled={submitting || !doctorId}
                className="w-full bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white py-3 text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                {submitting ? 'Submitting Recommendation...' : 'Submit Recommendation to Faculty Board'}
              </button>
            </div>
          ) : (
            /* GENERAL MEDICAL DECISION (Approve / Reject) */
            <div className="space-y-4 pt-3 border-t border-gray-100">
              {isPending && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Rejection Reason <span className="text-red-500">(if rejecting)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-red-400 resize-none bg-gray-50 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      onClick={handleApprove}
                      disabled={submitting || !doctorId}
                      className="w-full bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Processing...' : 'Approve Record'}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={submitting || !doctorId}
                      className="w-full border border-red-300 text-red-600 py-2.5 text-xs font-semibold rounded-xl hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Processing...' : 'Reject & Notify'}
                    </button>
                  </div>
                </>
              )}

              {isApproved && (
                <div className="space-y-3">
                  <div className="text-xs px-3.5 py-2.5 rounded-xl border bg-amber-50 text-amber-800 border-amber-200">
                    ⚠️ This record is currently <strong>Approved</strong>.
                  </div>
                  <textarea
                    rows={2}
                    value={reversalReason}
                    onChange={e => setReversalReason(e.target.value)}
                    placeholder="Reason for reversing decision..."
                    className="border border-gray-200 rounded-xl p-2.5 text-xs w-full bg-gray-50"
                  />
                  <button
                    onClick={handleReject}
                    disabled={submitting || !doctorId}
                    className="w-full border border-red-300 text-red-600 py-2.5 text-xs font-semibold rounded-xl hover:bg-red-600 hover:text-white transition-colors"
                  >
                    Reverse to Rejected
                  </button>
                </div>
              )}

              {isRejected && (
                <div className="space-y-3">
                  <div className="text-xs px-3.5 py-2.5 rounded-xl border bg-amber-50 text-amber-800 border-amber-200">
                    ⚠️ This record is currently <strong>Rejected</strong>.
                  </div>
                  <textarea
                    rows={2}
                    value={reversalReason}
                    onChange={e => setReversalReason(e.target.value)}
                    placeholder="Reason for reversing decision..."
                    className="border border-gray-200 rounded-xl p-2.5 text-xs w-full bg-gray-50"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={submitting || !doctorId}
                    className="w-full bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Reverse to Approved
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
