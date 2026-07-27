import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.local')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appUrl = process.env.SMOKE_APP_URL || 'http://localhost:3000'

if (!url || !anonKey || !serviceKey) {
  throw new Error('Supabase environment variables are missing.')
}

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const token = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
const password = `Smoke-${crypto.randomUUID()}`
const studentEmail = `codex-smoke-student-${token}@example.invalid`
const doctorEmail = `codex-smoke-doctor-${token}@example.invalid`

let studentUserId
let doctorUserId
let studentId
let doctorId
let recordId
let visitId
let studentClient

const passed = []

function check(condition, label) {
  if (!condition) throw new Error(label)
  passed.push(label)
  console.log(`PASS: ${label}`)
}

async function createUser(email, role, fullName) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  })
  if (error || !data.user) throw error || new Error(`Unable to create ${role} test user.`)
  return data.user.id
}

async function cleanup() {
  try {
    if (studentUserId) {
      await service.auth.admin.updateUserById(studentUserId, { ban_duration: 'none' })
    }

    if (recordId) {
      const { data: images } = await service
        .from('record_images')
        .select('file_path')
        .eq('record_id', recordId)
      const paths = (images || []).map(({ file_path }) => file_path)
      if (paths.length) await service.storage.from('medical-documents').remove(paths)

      await service.from('medical_record_lifecycle_history').delete().eq('record_id', recordId)
      await service.from('medical_record_reviews').delete().eq('record_id', recordId)
      await service.from('record_images').delete().eq('record_id', recordId)
      await service.from('notifications').delete().like('message', `%REC-${recordId}%`)
      await service.from('medical_records').delete().eq('record_id', recordId)
    }
    if (visitId) await service.from('medical_visits').delete().eq('visit_id', visitId)
    if (studentUserId) {
      await service.from('account_status_history').delete().eq('user_id', studentUserId)
    }
    if (doctorId) {
      await service.from('doctor_availability').delete().eq('doctor_id', doctorId)
      await service.from('doctors').delete().eq('doctor_id', doctorId)
    }
    if (studentId) await service.from('students').delete().eq('student_id', studentId)

    const auditFilters = []
    if (studentUserId) auditFilters.push(`user_id.eq.${studentUserId}`)
    if (doctorUserId) auditFilters.push(`user_id.eq.${doctorUserId}`)
    if (recordId) auditFilters.push(`and(table_name.eq.medical_records,record_id.eq.${recordId})`)
    if (visitId) auditFilters.push(`and(table_name.eq.medical_visits,record_id.eq.${visitId})`)
    if (auditFilters.length) await service.from('audit_logs').delete().or(auditFilters.join(','))

    if (studentUserId) await service.auth.admin.deleteUser(studentUserId)
    if (doctorUserId) await service.auth.admin.deleteUser(doctorUserId)
  } catch (error) {
    console.error(`CLEANUP WARNING: ${error instanceof Error ? error.message : String(error)}`)
  }
}

try {
  const { data: admin, error: adminError } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (adminError || !admin) throw adminError || new Error('No active administrator exists.')

  studentUserId = await createUser(studentEmail, 'student', 'Lifecycle Test Student')
  doctorUserId = await createUser(doctorEmail, 'doctor', 'Lifecycle Test Doctor')

  const studentIndex = `292${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  const { data: student, error: studentError } = await service
    .from('students')
    .insert({
      user_id: studentUserId,
      full_name: 'Lifecycle Test Student',
      index_no: studentIndex,
      faculty: 'Applied Sciences',
      academic_year: '2026/2027',
      dob: '2002-01-01',
      gender: 'Other',
      contact_no: '0700000000',
    })
    .select('student_id')
    .single()
  if (studentError || !student) throw studentError || new Error('Unable to create test student roster.')
  studentId = student.student_id

  const { error: studentProfileError } = await service
    .from('profiles')
    .update({ role: 'student', full_name: 'Lifecycle Test Student' })
    .eq('id', studentUserId)
  if (studentProfileError) throw studentProfileError

  const { data: doctor, error: doctorError } = await service
    .from('doctors')
    .insert({
      user_id: doctorUserId,
      full_name: 'Lifecycle Test Doctor',
      specialisation: 'General Medicine',
    })
    .select('doctor_id')
    .single()
  if (doctorError || !doctor) throw doctorError || new Error('Unable to create test doctor.')
  doctorId = doctor.doctor_id

  const { error: doctorProfileError } = await service
    .from('profiles')
    .update({
      role: 'doctor',
      full_name: 'Lifecycle Test Doctor',
      employee_index: `WUSL/EMP/SMOKE-${token}`,
    })
    .eq('id', doctorUserId)
  if (doctorProfileError) throw doctorProfileError

  studentClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const doctorClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: studentLogin, error: studentLoginError } =
    await studentClient.auth.signInWithPassword({ email: studentEmail, password })
  check(!studentLoginError && Boolean(studentLogin.session), 'student login succeeds')

  const { data: doctorLogin, error: doctorLoginError } =
    await doctorClient.auth.signInWithPassword({ email: doctorEmail, password })
  check(!doctorLoginError && Boolean(doctorLogin.session), 'doctor login succeeds')

  const { data: profile, error: profileError } = await studentClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', studentUserId)
    .single()
  check(!profileError && profile?.role === 'student' && profile.is_active, 'login profile and active status load')

  const form = new FormData()
  form.set('purpose', 'Lifecycle smoke-test record')
  form.set('description', 'Temporary record used to verify the complete submission and review workflow.')
  form.set('issue_date', new Date().toISOString().slice(0, 10))
  form.append(
    'files',
    new File(
      [new TextEncoder().encode('%PDF-1.4\n% lifecycle smoke test\n%%EOF')],
      'lifecycle-smoke-test.pdf',
      { type: 'application/pdf' }
    )
  )
  const submissionResponse = await fetch(`${appUrl}/api/student/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentLogin.session.access_token}` },
    body: form,
  })
  const submission = await submissionResponse.json()
  check(submissionResponse.status === 201 && Number.isInteger(submission.record_id), 'medical record submission succeeds')
  recordId = submission.record_id

  const { data: studentRecords, error: studentRecordsError } = await studentClient
    .from('medical_records')
    .select('record_id, status')
    .eq('record_id', recordId)
  check(!studentRecordsError && studentRecords?.[0]?.status === 'pending', 'student can read the submitted record')

  const { data: doctorRecords, error: doctorRecordsError } = await doctorClient
    .from('medical_records')
    .select('record_id, status')
    .eq('record_id', recordId)
  check(!doctorRecordsError && doctorRecords?.[0]?.status === 'pending', 'doctor review queue receives the pending record')

  const { error: approveError } = await doctorClient.rpc('review_medical_record', {
    p_record_id: recordId,
    p_expected_status: 'pending',
    p_new_status: 'approved',
    p_diagnosis: 'Temporary smoke-test diagnosis',
    p_observation_notes: 'Submission was readable and complete.',
    p_recommendation: 'No action required; this is test data.',
    p_rejection_reason: null,
    p_reversal_reason: null,
  })
  check(!approveError, 'doctor approval succeeds')

  const { error: reverseError } = await doctorClient.rpc('review_medical_record', {
    p_record_id: recordId,
    p_expected_status: 'approved',
    p_new_status: 'rejected',
    p_diagnosis: 'Temporary smoke-test diagnosis',
    p_observation_notes: 'Decision changed solely to verify reversal handling.',
    p_recommendation: 'No action required; this is test data.',
    p_rejection_reason: 'Temporary rejection used to verify the reversal workflow.',
    p_reversal_reason: 'Correcting the temporary approval during an authorized smoke test.',
  })
  check(!reverseError, 'doctor decision reversal succeeds')

  const { data: reviews, error: reviewsError } = await service
    .from('medical_record_reviews')
    .select('from_status, to_status, reversal_reason')
    .eq('record_id', recordId)
    .order('review_id')
  check(
    !reviewsError &&
      reviews?.length === 2 &&
      reviews[0].to_status === 'approved' &&
      reviews[1].to_status === 'rejected' &&
      Boolean(reviews[1].reversal_reason),
    'approval and reversal history is preserved'
  )

  const { data: visit, error: visitError } = await service
    .from('medical_visits')
    .insert({
      doctor_id: doctorId,
      user_id: studentUserId,
      visit_date: new Date().toISOString().slice(0, 10),
      reason: 'Temporary lifecycle smoke-test consultation',
      notes: 'Test data',
      status: 'completed',
      patient_name: 'Lifecycle Test Student',
      patient_index: studentIndex,
      patient_type: 'Student',
    })
    .select('visit_id')
    .single()
  if (visitError || !visit) throw visitError || new Error('Unable to create test visit.')
  visitId = visit.visit_id

  const { error: voidError } = await service.rpc('void_medical_visit', {
    p_actor_id: doctorUserId,
    p_visit_id: visitId,
    p_reason: 'Duplicate temporary visit created during lifecycle smoke testing.',
  })
  check(!voidError, 'visit voiding succeeds')

  const { data: voidedVisit, error: voidedVisitError } = await service
    .from('medical_visits')
    .select('status, void_reason, voided_at, voided_by')
    .eq('visit_id', visitId)
    .single()
  check(
    !voidedVisitError &&
      voidedVisit?.status === 'voided' &&
      Boolean(voidedVisit.void_reason) &&
      Boolean(voidedVisit.voided_at) &&
      voidedVisit.voided_by === doctorUserId,
    'voided visit retains its reason, doctor, and timestamp'
  )

  const { error: banError } = await service.auth.admin.updateUserById(studentUserId, {
    ban_duration: '876000h',
  })
  if (banError) throw banError
  const { error: deactivateError } = await service.rpc('admin_set_account_status', {
    p_actor_id: admin.id,
    p_user_id: studentUserId,
    p_is_active: false,
    p_reason: 'Temporary account deactivation lifecycle smoke test.',
  })
  check(!deactivateError, 'account deactivation succeeds with a reason')

  const { data: inactiveProfile, error: inactiveProfileError } = await service
    .from('profiles')
    .select('is_active')
    .eq('id', studentUserId)
    .single()
  check(
    !inactiveProfileError && inactiveProfile?.is_active === false,
    'deactivated profile status is persisted'
  )

  const { data: inaccessibleRecords, error: inactiveReadError } = await studentClient
    .from('medical_records')
    .select('record_id')
    .eq('record_id', recordId)
  check(
    Boolean(inactiveReadError) || inaccessibleRecords?.length === 0,
    'existing session immediately loses protected data access'
  )

  const blockedClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: blockedLoginError } = await blockedClient.auth.signInWithPassword({
    email: studentEmail,
    password,
  })
  check(Boolean(blockedLoginError), 'deactivated account cannot create a new login session')

  const { error: reactivateError } = await service.rpc('admin_set_account_status', {
    p_actor_id: admin.id,
    p_user_id: studentUserId,
    p_is_active: true,
    p_reason: 'Temporary account restored after lifecycle smoke testing.',
  })
  if (reactivateError) throw reactivateError
  const { error: unbanError } = await service.auth.admin.updateUserById(studentUserId, {
    ban_duration: 'none',
  })
  if (unbanError) throw unbanError

  const restoredClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: restoredLogin, error: restoredLoginError } =
    await restoredClient.auth.signInWithPassword({ email: studentEmail, password })
  check(!restoredLoginError && Boolean(restoredLogin.session), 'reactivated account can log in again')

  const { error: invalidateError } = await service.rpc('admin_change_medical_record_lifecycle', {
    p_actor_id: admin.id,
    p_record_id: recordId,
    p_new_status: 'invalidated',
    p_reason: 'Temporary lifecycle invalidation smoke test.',
  })
  check(!invalidateError, 'medical record invalidation succeeds without deletion')

  const { data: lifecycleHistory, error: lifecycleError } = await service
    .from('medical_record_lifecycle_history')
    .select('previous_status, new_status, reason')
    .eq('record_id', recordId)
  check(
    !lifecycleError &&
      lifecycleHistory?.length === 1 &&
      lifecycleHistory[0].new_status === 'invalidated',
    'medical record lifecycle history is preserved'
  )

  console.log(`\nLifecycle smoke test passed: ${passed.length} checks.`)
} catch (error) {
  console.error(`\nLifecycle smoke test failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await cleanup()
  console.log('Temporary smoke-test data cleanup completed.')
}
