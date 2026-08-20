'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../../lib/supabase/browser'
import type { TableRow } from '../../../lib/supabase/database.types'
import { MAX_MEDICAL_FILES, validateMedicalFile } from '../../../lib/validation'

const supabase = createBrowserSupabaseClient()

function StatusBadge({ status, workflowStage }: { status: string; workflowStage: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`text-xs px-3 py-1 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status === 'pending'
        ? workflowStage === 'faculty_review' ? 'Faculty Administrative Review' : 'Awaiting UMO Review'
        : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

type ReviewingDoctor = Pick<TableRow<'doctors'>, 'full_name'>
type MedicalRecordDetail = TableRow<'medical_records'> & {
  doctors: ReviewingDoctor | null
}

export default function RecordDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <RecordDetail />
    </Suspense>
  )
}

function RecordDetail() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const recordId = Number(id)
  const validRecordId = Number.isInteger(recordId) && recordId > 0
  const [record, setRecord] = useState<MedicalRecordDetail | null>(null)
  const [images, setImages] = useState<TableRow<'record_images'>[]>([])
  const [loading, setLoading] = useState(validRecordId)
  const [resubmissionReason, setResubmissionReason] = useState('')
  const [resubmissionDetails, setResubmissionDetails] = useState('')
  const [resubmissionFiles, setResubmissionFiles] = useState<File[]>([])
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmissionError, setResubmissionError] = useState('')
  const [resubmissionSuccess, setResubmissionSuccess] = useState('')

  useEffect(() => {
    if (!validRecordId) return
    const fetchRecord = async () => {
      const { data } = await supabase
        .from('medical_records')
        .select('*, doctors(full_name)')
        .eq('record_id', recordId)
        .single()
      if (data) {
        setRecord({
          ...data,
          doctors: Array.isArray(data.doctors) ? data.doctors[0] || null : data.doctors,
        })
      }
      const { data: imagesData } = await supabase
        .from('record_images')
        .select('*')
        .eq('record_id', recordId)
        .eq('disposal_status', 'retained')
      setImages(imagesData || [])
      setLoading(false)
    }
    void fetchRecord()
  }, [recordId, validRecordId])

  const handleDownload = async (filePath: string) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(filePath, 60)
    if (data?.signedUrl) {
      const response = await fetch(data.signedUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split('/').pop() || 'document'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }
  }

  const submitResubmission = async () => {
    if (!record || resubmitting) return
    if (resubmissionReason.trim().length < 5) {
      setResubmissionError('Explain the reason for resubmission in at least 5 characters.')
      return
    }
    if (!resubmissionDetails.trim() && resubmissionFiles.length === 0) {
      setResubmissionError('Add further details or at least one additional supporting document.')
      return
    }
    if (resubmissionFiles.length > MAX_MEDICAL_FILES) {
      setResubmissionError(`Attach up to ${MAX_MEDICAL_FILES} additional documents.`)
      return
    }
    for (const file of resubmissionFiles) {
      const validationError = validateMedicalFile(file)
      if (validationError) {
        setResubmissionError(validationError)
        return
      }
    }

    setResubmitting(true)
    setResubmissionError('')
    const payload = new FormData()
    payload.set('reason', resubmissionReason.trim())
    payload.set('details', resubmissionDetails.trim())
    resubmissionFiles.forEach(file => payload.append('files', file))
    const response = await fetch(`/api/student/records/${record.record_id}/resubmit`, { method: 'POST', body: payload })
    const result = await response.json().catch(() => ({}))
    setResubmitting(false)
    if (!response.ok) {
      setResubmissionError(result.error || 'The medical record could not be resubmitted.')
      return
    }
    setResubmissionSuccess('Resubmitted for Faculty Administrative Review. Refreshing…')
    window.setTimeout(() => window.location.reload(), 800)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading record details...</div>
  if (!record) return <div className="p-8 text-sm text-gray-400">Record not found.</div>

  const isRejected = record.status === 'rejected' && record.lifecycle_status === 'active'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/student/recordss" className="hover:text-blue-800 transition-colors">
              ← My Records
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-semibold">REC-{record.record_id}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Record Details</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={record.status} workflowStage={record.workflow_stage} />
        </div>
      </div>

      {/* Inactive / Invalidated Record Alert */}
      {record.lifecycle_status !== 'active' && (
        <div
          className={`rounded-xl border p-4 ${
            record.lifecycle_status === 'invalidated'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider">
            Record {record.lifecycle_status}
          </div>
          <div className="mt-1 text-sm">
            {record.lifecycle_reason || 'Contact the Medical Center administration for details.'}
          </div>
        </div>
      )}

      {/* Main Content Grid: Balanced 2-Column layout when rejected, or 2/3 + 1/3 when standard */}
      <div className={`grid grid-cols-1 ${isRejected ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6 items-start`}>
        {/* Left Column: Record Info & Documents */}
        <div className={`${isRejected ? 'space-y-6' : 'lg:col-span-2 space-y-6'}`}>
          {/* Information Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Submission Overview</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Record ID</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">REC-{record.record_id}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Purpose</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{record.purpose}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Submission Date</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">
                  {new Date(record.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Duration of Leave</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">
                  {record.leave_start_date && record.leave_end_date
                    ? record.leave_start_date === record.leave_end_date
                      ? record.leave_start_date.replace(/-/g, '/')
                      : `${record.leave_start_date.replace(/-/g, '/')} to ${record.leave_end_date.replace(/-/g, '/')}`
                    : record.issue_date?.replace(/-/g, '/') || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Leave Days</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">
                  {record.leave_days_count || 1} {(record.leave_days_count || 1) === 1 ? 'day' : 'days'}
                </div>
              </div>
              {record.reviewed_by && (
                <div>
                  <div className="text-[11px] text-gray-400 uppercase font-semibold">Reviewed By</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {record.doctors?.full_name || 'University Medical Officer'}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {record.description && (
              <div className="border-t border-gray-100 pt-3">
                <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Illness / Symptoms</div>
                <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {record.description}
                </div>
              </div>
            )}

            {/* Rejection Alert Box */}
            {record.rejection_reason && (
              <div className="border border-red-200 bg-red-50/80 rounded-xl p-3.5 space-y-1">
                <div className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Rejection Reason from Medical Officer
                </div>
                <div className="text-xs text-red-700 pl-5">
                  {record.rejection_reason}
                </div>
              </div>
            )}

            {/* Resubmission History */}
            {record.resubmission_reason && (
              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3.5 space-y-1">
                <div className="text-xs font-bold text-blue-900">Latest Resubmission Statement</div>
                <div className="text-xs text-gray-800">{record.resubmission_reason}</div>
                {record.resubmission_details && (
                  <div className="text-xs text-gray-500 mt-1">{record.resubmission_details}</div>
                )}
              </div>
            )}
          </div>

          {/* Attached Documents Card */}
          {images.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attached Documents</h2>
              <div className="flex flex-col gap-2">
                {images.map(img => (
                  <div
                    key={img.image_id}
                    className="flex items-center justify-between border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/70 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-xs font-medium text-gray-800 truncate">{img.file_path.split('/').pop()}</span>
                      <span className="text-[10px] text-gray-400 font-mono">({img.file_size_kb} KB)</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={async () => {
                          const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60)
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                        }}
                        className="text-xs text-blue-800 hover:text-blue-900 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(img.file_path)}
                        className="text-xs text-gray-600 hover:text-gray-900 font-semibold px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Resubmit Form (If rejected) or Status Card (If standard) */}
        {isRejected ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resubmit Medical Record
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Provide clarifications or additional documents. Your submission will return to Faculty Administrative Review.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Reason for Resubmission <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={resubmissionReason}
                  onChange={e => setResubmissionReason(e.target.value)}
                  placeholder="Explain why this record should be reviewed again..."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-800 focus:bg-white focus:border-blue-800 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Additional Details (Optional)
                </label>
                <textarea
                  rows={2}
                  value={resubmissionDetails}
                  onChange={e => setResubmissionDetails(e.target.value)}
                  placeholder="Add any extra information that supports your request..."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-800 focus:bg-white focus:border-blue-800 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Attach Clarified Documents
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={e => setResubmissionFiles(Array.from(e.target.files || []))}
                  className="mt-1 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-800 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-[11px] text-gray-400">PDF, JPG, or PNG (up to {MAX_MEDICAL_FILES} files, 10MB each).</p>
                {resubmissionFiles.length > 0 && (
                  <p className="mt-1 text-xs text-emerald-700 font-medium">{resubmissionFiles.length} file(s) selected.</p>
                )}
              </div>

              {resubmissionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600" role="alert">
                  {resubmissionError}
                </div>
              )}
              {resubmissionSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  {resubmissionSuccess}
                </div>
              )}

              <button
                onClick={() => void submitResubmission()}
                disabled={resubmitting}
                className="w-full rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                {resubmitting ? 'Submitting Resubmission...' : 'Resubmit for Faculty Review'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Record Status</h2>
            <div>
              <StatusBadge status={record.status} workflowStage={record.workflow_stage} />
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <div>
                <div className="text-[11px] text-gray-400 uppercase font-semibold">Created Date</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">
                  {new Date(record.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
              {record.status !== 'pending' && record.reviewed_by && (
                <div>
                  <div className="text-[11px] text-gray-400 uppercase font-semibold">Decision By</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    {record.doctors?.full_name || 'University Medical Officer'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
