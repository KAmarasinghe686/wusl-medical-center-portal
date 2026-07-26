'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../../lib/supabase/browser'
import type { TableRow } from '../../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`text-xs px-3 py-1 font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

type MedicalRecordDetail = TableRow<'medical_records'> & { can_resubmit?: boolean }

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

  useEffect(() => {
    if (!validRecordId) return
    const fetchRecord = async () => {
      const { data } = await supabase.from('medical_records').select('*').eq('record_id', recordId).single()
      setRecord(data)
      const { data: imagesData } = await supabase.from('record_images').select('*').eq('record_id', recordId)
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

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!record) return <div className="p-8 text-sm text-gray-400">Record not found.</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <div className="flex items-center gap-2">
          <Link href="/student/recordss" className="text-xs text-gray-400 hover:text-blue-800">My Records</Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-blue-800 font-medium">REC-{record.record_id}</span>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Record Detail</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Record Information</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[['Record ID', `REC-${record.record_id}`], ['Purpose', record.purpose], ['Issue Date', record.issue_date], ['Submitted By', record.submitted_by]].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</div>
                  <div className="text-sm font-medium text-gray-800">{v || 'N/A'}</div>
                </div>
              ))}
            </div>
            {record.description && (
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Description</div>
                <div className="text-sm text-gray-600">{record.description}</div>
              </div>
            )}
            {record.rejection_reason && (
              <div className="border-t border-gray-100 pt-4 mt-4 bg-red-50 rounded-xl p-3">
                <div className="text-xs text-red-500 uppercase font-semibold mb-2">Rejection Reason</div>
                <div className="text-sm text-red-600">{record.rejection_reason}</div>
              </div>
            )}
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
                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60)
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                        }}
                        className="text-xs text-blue-800  font-semibold hover:text-blue-600">
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(img.file_path)}
                        className="text-xs text-blue-800  font-semibold hover:text-blue-600">
                      
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Status</h2>
          <StatusBadge status={record.status} />
          <div className="mt-4 text-xs text-gray-400 uppercase font-semibold">Created</div>
          <div className="text-sm font-medium text-gray-800 mt-1">{new Date(record.created_at).toLocaleDateString()}</div>
          {record.can_resubmit && (
            <Link href="/student/submit" className="mt-4 block text-center bg-blue-800 text-white text-xs px-3 py-2 rounded-lg font-semibold hover:bg-blue-900 transition-colors">
              Resubmit Record
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
