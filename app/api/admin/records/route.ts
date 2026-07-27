import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import { cleanText } from '../../../lib/validation'
import type { RecordLifecycleStatus } from '../../../lib/supabase/database.types'

const lifecycleStatuses = new Set<RecordLifecycleStatus>(['active', 'archived', 'invalidated'])

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  const { data, error } = await authorization.serviceClient
    .from('medical_records')
    .select('*, students(full_name, index_no), doctors(full_name), record_images(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await request.json().catch(() => null)
  const values = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const action = values.action
  const reason = cleanText(values.reason, 1000)
  if (reason.length < 5) {
    return NextResponse.json({ error: 'Enter a clear reason of at least 5 characters.' }, { status: 400 })
  }

  if (action === 'change-lifecycle') {
    const recordId = Number(values.recordId)
    const newStatus = values.newStatus
    if (!Number.isInteger(recordId) || recordId <= 0 || typeof newStatus !== 'string' ||
        !lifecycleStatuses.has(newStatus as RecordLifecycleStatus)) {
      return NextResponse.json({ error: 'A valid record and lifecycle status are required.' }, { status: 400 })
    }

    const { error } = await authorization.serviceClient.rpc('admin_change_medical_record_lifecycle', {
      p_actor_id: authorization.user.id,
      p_record_id: recordId,
      p_new_status: newStatus as RecordLifecycleStatus,
      p_reason: reason,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'dispose-document') {
    const imageId = Number(values.imageId)
    if (!Number.isInteger(imageId) || imageId <= 0) {
      return NextResponse.json({ error: 'A valid document is required.' }, { status: 400 })
    }

    const { serviceClient, user } = authorization
    const { data: image, error: imageError } = await serviceClient
      .from('record_images')
      .select('*')
      .eq('image_id', imageId)
      .maybeSingle()
    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 })
    if (!image) return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    if (image.disposal_status !== 'retained') {
      return NextResponse.json({ error: 'This document is already in a disposal workflow.' }, { status: 409 })
    }

    const { data: record, error: recordError } = await serviceClient
      .from('medical_records')
      .select('record_id, lifecycle_status')
      .eq('record_id', image.record_id)
      .single()
    if (recordError || !record) {
      return NextResponse.json({ error: recordError?.message || 'Medical record not found.' }, { status: 404 })
    }
    if (record.lifecycle_status !== 'archived') {
      return NextResponse.json(
        { error: 'Documents can be disposed only after the medical record has been archived.' },
        { status: 409 }
      )
    }

    const { error: pendingError } = await serviceClient
      .from('record_images')
      .update({
        disposal_status: 'disposal_pending',
        disposal_reason: reason,
        disposed_by: user.id,
      })
      .eq('image_id', imageId)
      .eq('disposal_status', 'retained')
    if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 400 })

    const { error: authorizationAuditError } = await serviceClient.from('audit_logs').insert({
      action: 'DOCUMENT_DISPOSAL_AUTHORIZED',
      table_name: 'record_images',
      record_id: String(imageId),
      user_id: user.id,
      old_data: image,
      new_data: {
        record_id: image.record_id,
        disposal_status: 'disposal_pending',
        reason,
      },
    })
    if (authorizationAuditError) {
      await serviceClient
        .from('record_images')
        .update({
          disposal_status: 'retained',
          disposal_reason: null,
          disposed_by: null,
        })
        .eq('image_id', imageId)
      return NextResponse.json({ error: 'The disposal could not be audited and was cancelled.' }, { status: 500 })
    }

    const { error: storageError } = await serviceClient.storage
      .from('medical-documents')
      .remove([image.file_path])
    if (storageError) {
      await serviceClient
        .from('record_images')
        .update({
          disposal_status: 'retained',
          disposal_reason: null,
          disposed_by: null,
        })
        .eq('image_id', imageId)
      await serviceClient.from('audit_logs').insert({
        action: 'DOCUMENT_DISPOSAL_FAILED',
        table_name: 'record_images',
        record_id: String(imageId),
        user_id: user.id,
        new_data: { reason, error: storageError.message },
      })
      return NextResponse.json({ error: `Storage disposal failed: ${storageError.message}` }, { status: 500 })
    }

    const disposedAt = new Date().toISOString()
    const { error: finalizeError } = await serviceClient
      .from('record_images')
      .update({
        disposal_status: 'disposed',
        disposal_reason: reason,
        disposed_at: disposedAt,
        disposed_by: user.id,
      })
      .eq('image_id', imageId)
      .eq('disposal_status', 'disposal_pending')
    if (finalizeError) {
      return NextResponse.json(
        { error: 'The file was removed, but disposal metadata requires administrator reconciliation.' },
        { status: 500 }
      )
    }

    await serviceClient.from('audit_logs').insert({
      action: 'DOCUMENT_DISPOSED',
      table_name: 'record_images',
      record_id: String(imageId),
      user_id: user.id,
      old_data: { file_path: image.file_path, file_type: image.file_type, file_size_kb: image.file_size_kb },
      new_data: { record_id: image.record_id, disposal_status: 'disposed', disposed_at: disposedAt, reason },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
}
