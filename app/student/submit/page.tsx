'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudent } from '../hooks/useStudent'
import { MAX_MEDICAL_FILES, validateMedicalFile } from '../../lib/validation'

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
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setFiles(Array.from(e.target.files)) }
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
    setError('Please fill in all required fields.'); 
    return 
  }
  
  if (purpose === 'Other (Please specify)' && !customPurpose.trim()) {
    setError('Please specify the purpose or select another option.');
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
  
    setSubmitting(true); setError('')
    const payload = new FormData()
    payload.set('purpose', finalPurpose)
    payload.set('description', description)
    payload.set('issue_date', issueDate)
    files.forEach(file => payload.append('files', file))

    const response = await fetch('/api/student/records', { method: 'POST', body: payload })
    const result = await response.json()
    if (!response.ok) {
      setError(result.error || 'Unable to submit the medical record.')
      setSubmitting(false)
      return
    }
    setSubmitting(false); setSuccess(true)
    setTimeout(() => router.push('/student/recordss'), 1500)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Submit Medical Record</h1>
      <p className="text-sm text-gray-500 mb-6">Provide the necessary documentation for institutional health tracking.</p>

      {/* Student Information Card - Full Width */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Student Information</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[['Student Name', student?.full_name], ['Student ID', student?.index_no], ['Faculty', student?.faculty], ['Academic Year', `Year ${student?.academic_year}`]].map(([k, v]) => (
            <div key={k}>
              <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</div>
              <div className="text-sm font-medium text-gray-800">{v || 'N/A'}</div>
            </div>
          ))}
        </div>
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
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 w-full lg:w-48" />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
              <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} 
                placeholder="Describe your symptoms or reason for submission..."
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-800 resize-none" />
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
              <span className="border border-blue-800 text-blue-800 px-5 py-2 text-xs font-semibold rounded-lg hover:bg-blue-800 hover:text-white transition-colors">Browse Files</span>
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
          {success && <div className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 mb-4">Record submitted successfully! Redirecting...</div>}
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
