import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import { cleanText, isIsoDate, isPastOrToday, isPatientType } from '../../../lib/validation'

async function doctorIdFor(
  serviceClient: NonNullable<Awaited<ReturnType<typeof authorizeRequest>>['serviceClient']>,
  userId: string
) {
  const { data, error } = await serviceClient
    .from('doctors')
    .select('doctor_id')
    .eq('user_id', userId)
    .single()
  if (error || !data) throw new Error('Doctor profile not found.')
  return data.doctor_id
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['doctor'])
  if (authorization.error) return authorization.error

  const body: unknown = await request.json().catch(() => null)
  const values = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const patientType = values.patientType
  const patientIndex = cleanText(values.patientIndex, 80)
  const visitDate = cleanText(values.visitDate, 10)
  const reason = cleanText(values.reason, 1000)
  const notes = cleanText(values.notes, 4000) || null

  if (!isPatientType(patientType) || !patientIndex || !isIsoDate(visitDate) || !isPastOrToday(visitDate) || !reason) {
    return NextResponse.json(
      { error: 'Patient type, valid patient ID, non-future visit date, and reason are required.' },
      { status: 400 }
    )
  }

  const { serviceClient, user } = authorization
  const doctorId = await doctorIdFor(serviceClient, user.id).catch(() => null)
  if (!doctorId) return NextResponse.json({ error: 'Doctor profile not found.' }, { status: 409 })

  let patient: { userId: string; fullName: string; index: string } | null = null
  if (patientType === 'Student') {
    const { data, error: patientError } = await serviceClient
      .from('students')
      .select('user_id, full_name, index_no')
      .eq('index_no', patientIndex)
      .maybeSingle()
    if (patientError) {
      return NextResponse.json({ error: `Unable to validate the patient: ${patientError.message}` }, { status: 500 })
    }
    if (data?.user_id) patient = { userId: data.user_id, fullName: data.full_name, index: data.index_no }
  } else {
    const { data, error: patientError } = await serviceClient
      .from('profiles')
      .select('id, full_name, employee_index, role')
      .eq('employee_index', patientIndex)
      .in('role', ['worker', 'admin'])
      .maybeSingle()
    if (patientError) {
      return NextResponse.json({ error: `Unable to validate the patient: ${patientError.message}` }, { status: 500 })
    }
    if (data?.employee_index) {
      patient = {
        userId: data.id,
        fullName: data.full_name || 'University Staff',
        index: data.employee_index,
      }
    }
  }

  if (!patient) {
    return NextResponse.json({ error: `No linked ${patientType.toLowerCase()} account matches that ID.` }, { status: 404 })
  }

  const { data: visit, error } = await serviceClient
    .from('medical_visits')
    .insert({
      doctor_id: doctorId,
      user_id: patient.userId,
      visit_date: visitDate,
      reason,
      notes,
      status: 'completed',
      patient_name: patient.fullName,
      patient_index: patient.index,
      patient_type: patientType,
    })
    .select()
    .single()

  if (error || !visit) {
    return NextResponse.json({ error: error?.message || 'Unable to save the visit.' }, { status: 400 })
  }

  const { error: auditError } = await serviceClient.from('audit_logs').insert({
    action: 'INSERT',
    table_name: 'medical_visits',
    record_id: String(visit.visit_id),
    user_id: user.id,
    new_data: visit,
  })
  if (auditError) {
    const { error: rollbackError } = await serviceClient.from('medical_visits').delete().eq('visit_id', visit.visit_id)
    const message = rollbackError
      ? 'The visit audit and automatic rollback both failed. An administrator must reconcile this visit.'
      : 'The visit could not be audited and was rolled back.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, visit }, { status: 201 })
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, ['doctor'])
  if (authorization.error) return authorization.error

  const body: unknown = await request.json().catch(() => null)
  const values = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const visitId = Number(values.visitId)
  const action = values.action === 'void' ? 'void' : 'edit'
  const reason = cleanText(values.reason, 1000)
  const notes = cleanText(values.notes, 4000) || null
  const voidReason = cleanText(values.voidReason, 1000)
  if (!Number.isInteger(visitId) || visitId <= 0) {
    return NextResponse.json({ error: 'A valid visit is required.' }, { status: 400 })
  }
  if (action === 'edit' && !reason) {
    return NextResponse.json({ error: 'A visit reason is required.' }, { status: 400 })
  }
  if (action === 'void' && voidReason.length < 5) {
    return NextResponse.json({ error: 'Enter a clear void reason of at least 5 characters.' }, { status: 400 })
  }

  const { serviceClient, user } = authorization
  const doctorId = await doctorIdFor(serviceClient, user.id).catch(() => null)
  if (!doctorId) return NextResponse.json({ error: 'Doctor profile not found.' }, { status: 409 })

  const { data: previous, error: previousError } = await serviceClient
    .from('medical_visits')
    .select('*')
    .eq('visit_id', visitId)
    .eq('doctor_id', doctorId)
    .maybeSingle()
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 })
  if (!previous) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })
  if (previous.status === 'voided') {
    return NextResponse.json({ error: 'This visit has already been voided.' }, { status: 409 })
  }

  if (action === 'void') {
    const { error: voidError } = await serviceClient.rpc('void_medical_visit', {
      p_actor_id: user.id,
      p_visit_id: visitId,
      p_reason: voidReason,
    })
    if (voidError) {
      return NextResponse.json({ error: voidError.message || 'Unable to void the visit.' }, { status: 400 })
    }

    const { data: voided, error: readError } = await serviceClient
      .from('medical_visits')
      .select('*')
      .eq('visit_id', visitId)
      .single()
    if (readError || !voided) {
      return NextResponse.json(
        { error: 'The visit was voided, but its updated details could not be reloaded.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, visit: voided })
  }

  const { data: updated, error } = await serviceClient
    .from('medical_visits')
    .update({ reason, notes })
    .eq('visit_id', visitId)
    .eq('doctor_id', doctorId)
    .select()
    .single()
  if (error || !updated) return NextResponse.json({ error: error?.message || 'Unable to update the visit.' }, { status: 400 })

  const { error: auditError } = await serviceClient.from('audit_logs').insert({
    action: 'UPDATE',
    table_name: 'medical_visits',
    record_id: String(visitId),
    user_id: user.id,
    old_data: previous,
    new_data: updated,
  })
  if (auditError) {
    const { error: rollbackError } = await serviceClient
      .from('medical_visits')
      .update({ reason: previous.reason, notes: previous.notes })
      .eq('visit_id', visitId)
      .eq('doctor_id', doctorId)
    const message = rollbackError
      ? 'The visit audit and automatic rollback both failed. An administrator must reconcile this visit.'
      : 'The visit update could not be audited and was rolled back.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, visit: updated })
}
