'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDoctor } from '../hooks/useDoctor'
import type { RecordStatus } from '../../lib/supabase/database.types'

type StudentSummary = {
  full_name: string
  index_no: string
  faculty: string | null
  dob: string | null
}

type MedicalRecord = {
  record_id: number
  purpose: string
  issue_date: string
  status: RecordStatus
  description: string | null
  rejection_reason: string | null
  diagnosis: string | null
  observation_notes: string | null
  recommendation: string | null
  students: StudentSummary | null
}

type RecordImage = {
  image_id: number
  file_path: string
  file_size_kb: number
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
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reversalReason, setReversalReason] = useState('')
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
        .select('*, students(full_name, index_no, faculty, dob)')
        .eq('record_id', recordId)
        .or(`status.eq.pending,reviewed_by.eq.${doctorId}`)
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
      })
      setDiagnosis(data.diagnosis || '')
      setNotes(data.observation_notes || '')
      setRecommendation(data.recommendation || '')
      const { data: imagesData } = await supabase.from('record_images').select('*').eq('record_id', recordId)
      if (!active) return
      setImages(imagesData || [])
      setRecordError('')
      setRecordLoading(false)
    }

    void fetchRecord()
    return () => { active = false }
  }, [doctorId, recordId, supabase])

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
      <p className="text-sm text-gray-500">Please select a record to review from <a href="/doctor/records" className="text-blue-800 underline">Assigned Records</a>.</p>
    </div>
  )
  if (recordLoading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (recordError) return <div className="p-8 text-sm text-red-600">{recordError}</div>
  if (!record) return <div className="p-8 text-sm text-gray-400">Record not found.</div>

  const isPending = record.status === 'pending'
  const isApproved = record.status === 'approved'
  const isRejected = record.status === 'rejected'
  const assessmentFields = [
    { label: 'Diagnosis', value: diagnosis, setValue: setDiagnosis, rows: 3 },
    { label: 'Observation Notes', value: notes, setValue: setNotes, rows: 3 },
    { label: 'Recommendation', value: recommendation, setValue: setRecommendation, rows: 2 },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/doctor/records" className="text-xs text-gray-400 hover:text-blue-800">Assigned Records</Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs text-blue-800 font-medium">Review REC-{record.record_id}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Review Medical Record</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Student Profile</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-800 text-white flex items-center justify-center text-lg font-bold rounded-full">
                {record.students?.full_name?.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{record.students?.full_name}</div>
                <div className="text-xs text-gray-400">{record.students?.index_no}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['Faculty', record.students?.faculty || 'N/A'], ['Date of Birth', record.students?.dob || 'N/A']].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</div>
                  <div className="text-sm text-gray-800">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Record Details</h2>
            <div className="flex flex-col gap-3">
              {[['Record ID', `REC-${record.record_id}`], ['Purpose', record.purpose], ['Issue Date', record.issue_date], ['Status', record.status]].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</div>
                  <div className="text-sm text-gray-800 capitalize">{v}</div>
                </div>
              ))}
              {record.description && (
                <div>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Description</div>
                  <div className="text-sm text-gray-500">{record.description}</div>
                </div>
              )}
              {record.rejection_reason && (
                <div>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Rejection Reason</div>
                  <div className="text-sm text-red-600">{record.rejection_reason}</div>
                </div>
              )}
            </div>
          </div>

          {images.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Uploaded Documents</h2>
              <div className="flex flex-col gap-2">
                {images.map(img => (
                  <div key={img.image_id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-xs text-gray-600">{img.file_path.split('/').pop()}</span>
                      <span className="text-xs text-gray-400">({img.file_size_kb}KB)</span>
                    </div>
                    <button onClick={async () => { const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }}
                      className="text-xs text-blue-800 underline font-semibold">View</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Doctor Assessment</h2>
          <div className="flex flex-col gap-4">
            {actionError && (
              <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2" role="alert">
                {actionError}
              </div>
            )}
            {assessmentFields.map(field => (
              <div key={field.label} className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{field.label}</label>
                <textarea rows={field.rows} value={field.value} onChange={e => field.setValue(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 resize-none bg-gray-50" />
              </div>
            ))}

            {/* Already approved — can only reverse to rejected */}
            {isApproved && (
              <>
                <div className="text-xs px-4 py-3 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
                  ⚠️ This record has already been <span className="font-bold">approved</span>. You can reverse it to rejected below.
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reversal Reason <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={reversalReason} onChange={e => setReversalReason(e.target.value)}
                    placeholder="Why are you reversing this decision?"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 resize-none bg-gray-50" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rejection Reason <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none bg-gray-50" />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <button onClick={handleReject} disabled={submitting || !doctorId}
                    className="w-full border border-red-300 text-red-600 py-3 text-sm font-semibold rounded-lg hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50">
                    {submitting ? 'Processing...' : 'Reverse to Rejected'}
                  </button>
                  <button onClick={() => router.push('/doctor/records')}
                    className="w-full border border-gray-200 text-gray-600 py-3 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                    Back to Records
                  </button>
                </div>
              </>
            )}

            {/* Already rejected — can only reverse to approved */}
            {isRejected && (
              <>
                <div className="text-xs px-4 py-3 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
                  ⚠️ This record has already been <span className="font-bold">rejected</span>. You can reverse it to approved below.
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reversal Reason <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={reversalReason} onChange={e => setReversalReason(e.target.value)}
                    placeholder="Why are you reversing this decision?"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 resize-none bg-gray-50" />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <button onClick={handleApprove} disabled={submitting || !doctorId}
                    className="w-full bg-blue-800 hover:bg-blue-900 text-white py-3 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {submitting ? 'Processing...' : 'Reverse to Approved'}
                  </button>
                  <button onClick={() => router.push('/doctor/records')}
                    className="w-full border border-gray-200 text-gray-600 py-3 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                    Back to Records
                  </button>
                </div>
              </>
            )}

            {/* Pending — normal approve/reject */}
            {isPending && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rejection Reason <span className="text-red-500">(if rejecting)</span></label>
                  <textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none bg-gray-50" />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <button onClick={handleApprove} disabled={submitting || !doctorId}
                    className="w-full bg-blue-800 hover:bg-blue-900 text-white py-3 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {submitting ? 'Processing...' : 'Approve Record'}
                  </button>
                  <button onClick={handleReject} disabled={submitting || !doctorId}
                    className="w-full border border-red-300 text-red-600 py-3 text-sm font-semibold rounded-lg hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50">
                    {submitting ? 'Processing...' : 'Reject & Notify'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
