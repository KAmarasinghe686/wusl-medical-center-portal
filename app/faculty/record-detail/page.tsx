'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'
import { VALID_MEDICAL_ISSUERS, type ExamCourseEntry } from '../../lib/validation'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<
  TableRow<'students'>,
  'full_name' | 'index_no' | 'faculty' | 'dob' | 'address' | 'contact_no' | 'academic_year' | 'gender'
>
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
        .select('*, students(full_name, index_no, faculty, dob, address, contact_no, academic_year, gender), doctors(full_name)')
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

  const downloadFile = async (image: TableRow<'record_images'>) => {
    try {
      setDownloading(image.image_id)
      const { data } = await supabase.storage
        .from('medical-documents')
        .createSignedUrl(image.file_path, 60)

      if (data?.signedUrl) {
        const response = await fetch(data.signedUrl)
        const blob = await response.blob()
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

  const isExam = record.submission_type === 'exam'
  const courses: ExamCourseEntry[] = Array.isArray(record.exam_courses) ? (record.exam_courses as unknown as ExamCourseEntry[]) : []
  const issuerLabel = VALID_MEDICAL_ISSUERS.find(i => i.value === record.issuer_type)?.label || record.issuer_type || 'Authorized Medical Practitioner'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/faculty/review" className="hover:text-blue-800 transition-colors">
              ← Administrative Review
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-semibold">REC-{record.record_id}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isExam ? 'Examination Medical Application' : 'Medical Record Detail'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isExam ? (
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-900 rounded-full border border-amber-200">
              Exam Medical
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-900 rounded-full border border-blue-200">
              Coursework Medical
            </span>
          )}
          <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
            {record.workflow_stage === 'faculty_review'
              ? 'Awaiting Faculty Review'
              : record.workflow_stage === 'umo_review'
              ? 'At Medical Center (UMO)'
              : record.workflow_stage === 'faculty_board'
              ? 'At Faculty Board'
              : record.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Student Profile Card (Left 1 col) */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Student Profile</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-800 text-white flex items-center justify-center text-lg font-bold rounded-full flex-shrink-0">
              {record.students?.full_name?.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{record.students?.full_name}</div>
              <div className="text-xs text-gray-400 font-mono">{record.students?.index_no}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs">
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

        {/* Record & Examination Details (Right 2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Exam Medical Specific Course Units Card */}
          {isExam && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Examination Details & Registered Papers
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs pb-3 border-b border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Academic Year</span>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{record.exam_academic_year || '2024/2025'}</div>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Semester</span>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">{record.exam_semester || 'Semester I'}</div>
                </div>
              </div>

              {/* Table of Missed Papers */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">Missed Course Papers:</div>
                {courses.length > 0 ? (
                  courses.map((c, idx) => (
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

              {/* UMO Recommendation Badge */}
              {record.doctor_recommendation && (
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">University MO's Remark:</span>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    record.doctor_recommendation === 'Recommended'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {record.doctor_recommendation}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submission Info Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Submission Information</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Record ID</span>
                <div className="font-bold text-gray-900 font-mono">REC-{record.record_id}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Purpose</span>
                <div className="font-medium text-gray-800">{record.purpose}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Issue Date</span>
                <div className="font-medium text-gray-800">{record.issue_date}</div>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Medical Issuer</span>
                <div className="font-medium text-gray-800">{issuerLabel}</div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Leave Duration</span>
                <div className="font-mono text-gray-800 text-[11px]">
                  {record.leave_start_date || record.issue_date} TO {record.leave_end_date || record.leave_start_date || record.issue_date}
                </div>
              </div>
              <div>
                <span className="text-gray-400 uppercase font-semibold text-[10px]">Leave Days</span>
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

          {/* Uploaded Documents */}
          {images.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attached Documents</h2>
              <div className="flex flex-col gap-2">
                {images.map(img => {
                  const fileName = img.file_path.split('/').pop()
                  return (
                    <div key={img.image_id} className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <svg className="w-4 h-4 text-blue-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs text-gray-700 truncate">{fileName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">({img.file_size_kb}KB)</span>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from('medical-documents').createSignedUrl(img.file_path, 60)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }}
                          className="text-xs text-blue-800 hover:text-blue-900 font-semibold px-2 py-1 rounded bg-blue-50"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => downloadFile(img)}
                          disabled={downloading === img.image_id}
                          className="text-xs text-gray-600 hover:text-gray-900 font-semibold px-2 py-1 rounded bg-gray-100"
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
        </div>
      </div>
    </div>
  )
}
