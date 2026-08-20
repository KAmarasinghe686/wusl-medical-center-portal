'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStudent } from '../hooks/useStudent'
import { MAX_MEDICAL_FILES, calculateLeaveDays, validateMedicalFile } from '../../lib/validation'

// Predefined purposes
const PURPOSES = [
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
  const [purpose, setPurpose] = useState('')
  const [customPurpose, setCustomPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')
  const [holidays, setHolidays] = useState(0)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const actualStart = leaveStartDate || issueDate
  const actualEnd = leaveEndDate || actualStart
  const computedLeaveDays = actualStart && actualEnd && actualStart <= actualEnd
    ? calculateLeaveDays(actualStart, actualEnd)
    : 1

  const academicYear = student?.academic_year
    ? /^\d+$/.test(student.academic_year) ? `Year ${student.academic_year}` : student.academic_year
    : 'N/A'
  const dateOfBirth = student?.dob
    ? new Date(`${student.dob}T00:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }
  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index))

  // Get final purpose value
  const getFinalPurpose = () => {
    if (purpose === 'Other (Please specify)') {
      return customPurpose.trim() || 'Other'
    }
    return purpose
  }

  const handleSubmit = async () => {
    if (!student) return

    const finalPurpose = getFinalPurpose()
    if (!finalPurpose || !issueDate) {
      setError('Please fill in all required fields.')
      return
    }

    if (purpose === 'Other (Please specify)' && !customPurpose.trim()) {
      setError('Please specify the purpose or select another option.')
      return
    }

    const start = leaveStartDate || issueDate
    const end = leaveEndDate || start
    if (start > end) {
      setError('Leave start date cannot be after leave end date.')
      return
    }

    if (files.length === 0) {
      setError('Please attach at least one supporting document.')
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
    payload.set('purpose', finalPurpose)
    payload.set('description', description)
    payload.set('issue_date', issueDate)
    payload.set('leave_start_date', start)
    payload.set('leave_end_date', end)
    payload.set('number_of_holidays', String(Math.max(0, holidays || 0)))
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

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Submit Medical Record</h1>
      <p className="text-sm text-gray-500 mb-6">Provide the necessary documentation for institutional health tracking.</p>

      {/* Compact Student Verification Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-2.5 mb-6 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span>
            Submitting as: <strong className="font-semibold text-gray-900">{student?.full_name || 'Student'}</strong> (Index: <span className="font-mono">{student?.index_no}</span>)
          </span>
          <span className="text-blue-400 hidden sm:inline">·</span>
          <span className="text-blue-700 hidden sm:inline">{student?.faculty || 'Applied Sciences'}</span>
        </div>
        {!student?.contact_no && (
          <Link href="/student/profile" className="text-[11px] text-amber-800 hover:underline flex items-center gap-1 font-medium">
            <span>⚠️ Add contact no in profile</span>
          </Link>
        )}
      </div>

      {/* Two Column Layout - Form Left, Documents Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Record Details</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose <span className="text-red-500">*</span></label>
              <select
                value={purpose}
                onChange={e => {
                  setPurpose(e.target.value)
                  if (e.target.value !== 'Other (Please specify)') {
                    setCustomPurpose('')
                  }
                }}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 bg-white"
              >
                <option value="">Select a purpose...</option>
                {PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Custom purpose input - only shows when "Other" is selected */}
            {purpose === 'Other (Please specify)' && (
              <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Please Specify <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customPurpose}
                  onChange={e => setCustomPurpose(e.target.value)}
                  placeholder="Enter the purpose of this submission..."
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800"
                  autoFocus
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Issue Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={issueDate}
                onChange={e => {
                  const val = e.target.value
                  setIssueDate(val)
                  if (!leaveStartDate) setLeaveStartDate(val)
                  if (!leaveEndDate) setLeaveEndDate(val)
                }}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 w-full lg:w-48"
              />
            </div>

            {/* Leave Duration Section */}
            <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Duration of Leave</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-800 text-white rounded-full">
                  {computedLeaveDays} {computedLeaveDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">From Date</label>
                  <input
                    type="date"
                    value={leaveStartDate || issueDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-gray-600">To Date</label>
                  <input
                    type="date"
                    value={leaveEndDate || leaveStartDate || issueDate}
                    onChange={e => setLeaveEndDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-white"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[11px] font-semibold text-gray-600">Number of Holidays (if any during leave)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={holidays}
                  onChange={e => setHolidays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-white w-24"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your symptoms or reason for submission..."
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column - File Upload */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Attachments</h2>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Scanned Documents / Images <span className="text-red-500">*</span>
            </label>
            <label className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-800 hover:bg-blue-50 transition-all bg-gray-50 min-h-[200px]">
              <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-gray-500 mb-1 font-medium">Drag and drop or click to upload</p>
              <p className="text-xs text-gray-400 mb-4">PDF, JPG, PNG (Max 10MB each)</p>
              <span className="medical-file-browse border border-blue-800 text-blue-800 px-5 py-2 text-xs font-semibold rounded-lg transition-colors">Browse Files</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={handleFileChange} />
            </label>

            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Selected Files ({files.length})</h3>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">({Math.round(file.size / 1024)}KB)</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Full Width */}
      {(error || success) && (
        <div className="mt-6">
          {error && <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>}
          {success && <div className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 mb-4">Record submitted for Faculty Administrative Review. Redirecting...</div>}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={handleSubmit} disabled={submitting}
          className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Record'}
        </button>
        <button onClick={() => router.back()}
          className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
