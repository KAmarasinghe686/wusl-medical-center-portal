import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../../lib/auth/authorize'
import {
  MAX_MEDICAL_FILES,
  cleanText,
  safeFileName,
  validateMedicalFile,
} from '../../../../../lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ recordId: string }> }) {
  const authorization = await authorizeRequest(request, ['student'])
  if (authorization.error) return authorization.error

  const { recordId: recordIdValue } = await context.params
  const recordId = Number(recordIdValue)
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return NextResponse.json({ error: 'A valid medical record is required.' }, { status: 400 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'A valid multipart resubmission is required.' }, { status: 400 })
  }

  const reason = cleanText(formData.get('reason'), 1000)
  const details = cleanText(formData.get('details'), 4000) || null
  const files = formData.getAll('files').filter((value): value is File => value instanceof File)
  if (reason.length < 5) {
    return NextResponse.json({ error: 'Explain the reason for resubmission in at least 5 characters.' }, { status: 400 })
  }
  if (!details && files.length === 0) {
    return NextResponse.json({ error: 'Add further details or at least one additional supporting document.' }, { status: 400 })
  }
  if (files.length > MAX_MEDICAL_FILES) {
    return NextResponse.json({ error: `Attach up to ${MAX_MEDICAL_FILES} additional documents.` }, { status: 400 })
  }
  for (const file of files) {
    const validationError = validateMedicalFile(file)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const { serviceClient, user } = authorization
  const [{ data: student, error: studentError }, { data: record, error: recordError }] = await Promise.all([
    serviceClient.from('students').select('student_id').eq('user_id', user.id).single(),
    serviceClient.from('medical_records').select('*').eq('record_id', recordId).single(),
  ])
  if (studentError || !student || recordError || !record || record.student_id !== student.student_id) {
    return NextResponse.json({ error: 'Medical record not found.' }, { status: 404 })
  }
  if (record.lifecycle_status !== 'active' || record.status !== 'rejected') {
    return NextResponse.json({ error: 'Only an active rejected medical record can be resubmitted.' }, { status: 409 })
  }

  const uploadedPaths: string[] = []
  const uploadedImageIds: number[] = []
  const notificationIds: number[] = []
  let recordReset = false
  try {
    for (const file of files) {
      const path = `${user.id}/${record.record_id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await serviceClient.storage
        .from('medical-documents')
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)

      const { data: image, error: metadataError } = await serviceClient
        .from('record_images')
        .insert({
          record_id: record.record_id,
          file_path: path,
          file_type: file.type,
          file_size_kb: Math.max(1, Math.ceil(file.size / 1024)),
        })
        .select('image_id')
        .single()
      if (metadataError || !image) throw metadataError || new Error('Unable to record the additional document.')
      uploadedImageIds.push(image.image_id)
    }

    const { data: resetRecord, error: resetError } = await serviceClient
      .from('medical_records')
      .update({
        status: 'pending',
        workflow_stage: 'faculty_review',
        reviewed_by: null,
        diagnosis: null,
        observation_notes: null,
        recommendation: null,
        resubmission_reason: reason,
        resubmission_details: details,
        resubmitted_at: new Date().toISOString(),
        resubmission_count: record.resubmission_count + 1,
      })
      .eq('record_id', record.record_id)
      .eq('status', 'rejected')
      .select('record_id')
      .maybeSingle()
    if (resetError || !resetRecord) throw resetError || new Error('This record is no longer available for resubmission.')
    recordReset = true

    const { error: auditError } = await serviceClient.from('audit_logs').insert({
      action: 'RESUBMITTED',
      table_name: 'medical_records',
      record_id: String(record.record_id),
      user_id: user.id,
      old_data: {
        status: record.status,
        workflow_stage: record.workflow_stage,
        rejection_reason: record.rejection_reason,
      },
      new_data: {
        status: 'pending',
        workflow_stage: 'faculty_review',
        resubmission_reason: reason,
        resubmission_details: details,
        added_document_count: files.length,
      },
    })
    if (auditError) throw auditError

    const { data: faculty, error: facultyError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('role', 'faculty')
      .eq('is_active', true)
    if (facultyError) throw facultyError
    if (faculty.length > 0) {
      const { data: notifications, error: notificationError } = await serviceClient
        .from('notifications')
        .insert(faculty.map(({ id }) => ({
          user_id: id,
          title: 'Resubmitted medical record requires review',
          message: `Medical record REC-${record.record_id} was resubmitted and is awaiting Faculty Administrative Review.`,
          type: 'record_resubmitted',
        })))
        .select('notification_id')
      if (notificationError) throw notificationError
      notificationIds.push(...notifications.map(({ notification_id }) => notification_id))
    }

    return NextResponse.json({ success: true, record_id: record.record_id })
  } catch (error) {
    if (notificationIds.length > 0) {
      await serviceClient.from('notifications').delete().in('notification_id', notificationIds)
    }
    if (recordReset) {
      await serviceClient.from('medical_records').update({
        status: record.status,
        workflow_stage: record.workflow_stage,
        reviewed_by: record.reviewed_by,
        diagnosis: record.diagnosis,
        observation_notes: record.observation_notes,
        recommendation: record.recommendation,
        resubmission_reason: record.resubmission_reason,
        resubmission_details: record.resubmission_details,
        resubmitted_at: record.resubmitted_at,
        resubmission_count: record.resubmission_count,
      }).eq('record_id', record.record_id)
    }
    if (uploadedImageIds.length > 0) {
      await serviceClient.from('record_images').delete().in('image_id', uploadedImageIds)
    }
    if (uploadedPaths.length > 0) {
      await serviceClient.storage.from('medical-documents').remove(uploadedPaths)
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The medical record could not be resubmitted.' },
      { status: 500 }
    )
  }
}
