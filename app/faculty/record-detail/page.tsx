'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no' | 'faculty' | 'dob'>
type DoctorSummary = Pick<TableRow<'doctors'>, 'full_name'>
type FacultyRecord = TableRow<'medical_records'> & {
  students: StudentSummary | null
  doctors: DoctorSummary | null
}

export default function FacultyRecordDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <FacultyRecordDetail />
    </Suspense>
  )
}

function FacultyRecordDetail() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const recordId = Number(id)
  const validRecordId = Number.isInteger(recordId) && recordId > 0
  const [record, setRecord] = useState<FacultyRecord | null>(null)
  const [images, setImages] = useState<TableRow<'record_images'>[]>([])
  const [loading, setLoading] = useState(validRecordId)
  const [downloading, setDownloading] = useState<number | null>(null)

  useEffect(() => {
    if (!validRecordId) return
    const fetchRecord = async () => {
      const { data } = await supabase
        .from('medical_records')
        .select('*, students(full_name, index_no, faculty, dob), doctors(full_name)')
        .eq('record_id', recordId)
        .eq('lifecycle_status', 'active')
        .single()
      if (data) {
        setRecord({
          ...data,
          students: Array.isArray(data.students) ? data.students[0] || null : data.students,
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

  // Download single file
  const downloadFile = async (image: TableRow<'record_images'>) => {
    try {
      setDownloading(image.image_id)
      const { data } = await supabase.storage
        .from('medical-documents')
        .createSignedUrl(image.file_path, 60)

      if (data?.signedUrl) {
        // Fetch the file
        const response = await fetch(data.signedUrl)
        const blob = await response.blob()
        
        // Create download link
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = image.file_path.split('/').pop() || 'document'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download file. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!record) return <div className="p-8 text-sm text-gray-400">Record not found.</div>
  const awaitingAdministrativeReview = record.status === 'pending' && record.workflow_stage === 'faculty_review'

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/faculty/records" className="text-xs text-gray-400 hover:text-blue-800">Approved Records</Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-blue-800 font-medium">REC-{record.record_id}</span>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Record Detail</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex flex-col items-center mb-4">
            <div className="w-14 h-14 bg-blue-800 text-white flex items-center justify-center text-xl font-bold rounded-full mb-3">
              {record.students?.full_name?.charAt(0)}
            </div>
            <div className="font-bold text-gray-900 text-sm">{record.students?.full_name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{record.students?.index_no}</div>
            <span className={`mt-2 border text-xs px-3 py-1 rounded-full font-semibold ${awaitingAdministrativeReview ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {awaitingAdministrativeReview ? 'Faculty Administrative Review' : record.status?.charAt(0).toUpperCase() + record.status?.slice(1)}
            </span>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {[['Faculty', record.students?.faculty || 'N/A'], ['Date of Birth', record.students?.dob || 'N/A'], ['Approved By', record.doctors?.full_name || 'N/A']].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-xs text-gray-400 uppercase font-semibold">{k}</span>
                <span className="text-xs text-gray-800 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Record Information</div>
            <div className="grid grid-cols-2 gap-4">
              {[['Record ID', `REC-${record.record_id}`], ['Purpose', record.purpose], ['Issue Date', record.issue_date], ['Submitted By', record.submitted_by]].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</div>
                  <div className="text-sm text-gray-800">{v || 'N/A'}</div>
                </div>
              ))}
            </div>
            {record.description && (
              <div className="mt-4">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Description</div>
                <div className="text-sm text-gray-500">{record.description}</div>
              </div>
            )}
            {record.resubmission_reason && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Latest Resubmission</div>
                <div className="text-sm text-gray-700">{record.resubmission_reason}</div>
                {record.resubmission_details && <div className="mt-2 text-sm text-gray-500">{record.resubmission_details}</div>}
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Attached Documents</div>
              <div className="flex flex-col gap-2">
                {images.map(img => {
                  const fileName = img.file_path.split('/').pop()
                  return (
                    <div key={img.image_id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs text-gray-700 truncate">{fileName}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">({img.file_size_kb}KB)</span>
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button 
                          onClick={async () => { 
                            const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60); 
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank') 
                          }}
                          className="text-xs text-blue-800  font-semibold hover:text-blue-600"
                        >
                          Preview
                        </button>
                        <button 
                          onClick={() => downloadFile(img)} 
                          disabled={downloading === img.image_id}
                          className="text-xs text-blue-800  font-semibold hover:text-blue-600"
                        >
                          {downloading === img.image_id ? 'Downloading...' : 'Download'}
                        </button>
                        
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {record.rejection_reason && (
            <div className="border border-red-200 bg-red-50 rounded-2xl p-5">
              <div className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Rejection Reason</div>
              <div className="text-sm text-red-600">{record.rejection_reason}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
