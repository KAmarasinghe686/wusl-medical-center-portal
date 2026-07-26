import type { User } from '@supabase/supabase-js'
import type { authorizeRequest } from '../auth/authorize'
import type { ImportType, Json, TableRow } from '../supabase/database.types'
import { invitePortalUser } from '../users/invite'
import type {
  PersonnelImportData,
  StudentImportData,
  ValidatedImportRow,
} from './validation'

type ServiceClient = NonNullable<Awaited<ReturnType<typeof authorizeRequest>>['serviceClient']>
type ImportRow = ValidatedImportRow<StudentImportData | PersonnelImportData>
type RowOutcome = {
  status: 'invited' | 'skipped' | 'failed'
  message: string | null
  userId: string | null
}
export const IMPORT_CHUNK_SIZE = 20

async function allAuthUsers(client: ServiceClient) {
  const users: User[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

export async function addExistingAccountErrors(client: ServiceClient, type: ImportType, rows: ImportRow[]) {
  const users = await allAuthUsers(client)
  const userByEmail = new Map(
    users.filter(user => user.email).map(user => [user.email!.toLowerCase(), user])
  )

  if (type === 'students') {
    const identifiers = rows.map(row => (row.data as StudentImportData).index_no)
    const { data: students, error } = await client
      .from('students')
      .select('index_no, user_id')
      .in('index_no', identifiers)
    if (error) throw error
    const studentByIndex = new Map(students.map(student => [student.index_no, student]))

    rows.forEach(row => {
      const student = row.data as StudentImportData
      const existingStudent = studentByIndex.get(student.index_no)
      const existingEmailUser = userByEmail.get(student.email)
      if (existingStudent?.user_id) row.errors.push('Student index is already linked to an account.')
      if (existingEmailUser && existingEmailUser.id !== existingStudent?.user_id) {
        row.errors.push('Email is already registered to another account.')
      }
    })
    return rows
  }

  const identifiers = rows.map(row => (row.data as PersonnelImportData).employee_index)
  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, employee_index')
    .in('employee_index', identifiers)
  if (error) throw error
  const profileByIdentifier = new Map(profiles.map(profile => [profile.employee_index, profile]))
  rows.forEach(row => {
    const person = row.data as PersonnelImportData
    const existingProfile = profileByIdentifier.get(person.employee_index)
    const existingEmailUser = userByEmail.get(person.email)
    if (existingProfile) row.errors.push('Employee index is already registered.')
    if (existingEmailUser && existingEmailUser.id !== existingProfile?.id) {
      row.errors.push('Email is already registered to another account.')
    }
  })
  return rows
}

async function processStudent(
  client: ServiceClient,
  data: StudentImportData,
  redirectTo: string
): Promise<RowOutcome> {
  const { data: existing, error: lookupError } = await client
    .from('students')
    .select('student_id, user_id')
    .eq('index_no', data.index_no)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing?.user_id) {
    const { data: authUser } = await client.auth.admin.getUserById(existing.user_id)
    return authUser.user?.email?.toLowerCase() === data.email
      ? { status: 'skipped', message: 'Student is already registered.', userId: existing.user_id }
      : { status: 'failed', message: 'Student index is linked to a different account.', userId: null }
  }

  let studentId = existing?.student_id || null
  let createdStudent = false
  if (!studentId) {
    const { data: created, error } = await client
      .from('students')
      .insert({
        full_name: data.full_name,
        index_no: data.index_no,
        faculty: data.faculty,
        academic_year: data.academic_year,
        dob: data.dob,
        gender: data.gender,
        contact_no: data.contact_no,
      })
      .select('student_id')
      .single()
    if (error || !created) throw error || new Error('Unable to create student roster record.')
    studentId = created.student_id
    createdStudent = true
  }

  try {
    const user = await invitePortalUser(client, {
      email: data.email,
      role: 'student',
      fullName: data.full_name,
      studentId,
      redirectTo,
    })
    return { status: 'invited', message: null, userId: user.id }
  } catch (error) {
    if (createdStudent) await client.from('students').delete().eq('student_id', studentId)
    throw error
  }
}

async function processPersonnel(
  client: ServiceClient,
  data: PersonnelImportData,
  redirectTo: string
): Promise<RowOutcome> {
  const { data: existing, error: lookupError } = await client
    .from('profiles')
    .select('id, role')
    .eq('employee_index', data.employee_index)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing) {
    const { data: authUser } = await client.auth.admin.getUserById(existing.id)
    return authUser.user?.email?.toLowerCase() === data.email && existing.role === data.role
      ? { status: 'skipped', message: 'Personnel account is already registered.', userId: existing.id }
      : { status: 'failed', message: 'Employee index is linked to a different account.', userId: null }
  }

  const user = await invitePortalUser(client, {
    email: data.email,
    role: data.role,
    fullName: data.full_name,
    employeeIndex: data.employee_index,
    specialisation: data.specialisation,
    redirectTo,
  })
  return { status: 'invited', message: null, userId: user.id }
}

async function processImportData(
  client: ServiceClient,
  type: ImportType,
  data: StudentImportData | PersonnelImportData,
  redirectTo: string
) {
  return type === 'students'
    ? processStudent(client, data as StudentImportData, redirectTo)
    : processPersonnel(client, data as PersonnelImportData, redirectTo)
}

async function updateJobTotals(client: ServiceClient, jobId: string) {
  const { data: rows, error } = await client
    .from('onboarding_import_rows')
    .select('status')
    .eq('job_id', jobId)
  if (error) throw error

  const successfulRows = rows.filter(row => row.status === 'invited').length
  const skippedRows = rows.filter(row => row.status === 'skipped').length
  const failedRows = rows.filter(row => row.status === 'failed').length
  const pendingRows = rows.filter(row => row.status === 'pending').length
  const status = pendingRows > 0
    ? 'processing'
    : failedRows === 0
      ? 'completed'
      : successfulRows + skippedRows === 0
        ? 'failed'
        : 'partial'

  const { error: updateError } = await client
    .from('onboarding_imports')
    .update({
      status,
      successful_rows: successfulRows,
      skipped_rows: skippedRows,
      failed_rows: failedRows,
      completed_at: pendingRows > 0 ? null : new Date().toISOString(),
    })
    .eq('job_id', jobId)
  if (updateError) throw updateError

  return { status, successfulRows, skippedRows, failedRows, pendingRows }
}

export async function runOnboardingImport(
  client: ServiceClient,
  actorId: string,
  type: ImportType,
  sourceFile: string | null,
  rows: ImportRow[],
  redirectTo: string
) {
  const { data: job, error: jobError } = await client
    .from('onboarding_imports')
    .insert({
      import_type: type,
      source_file: sourceFile,
      status: 'processing',
      total_rows: rows.length,
      created_by: actorId,
    })
    .select('job_id')
    .single()
  if (jobError || !job) throw jobError || new Error('Unable to create the import job.')

  const { error: rowsError } = await client
    .from('onboarding_import_rows')
    .insert(rows.map(row => ({
      job_id: job.job_id,
      row_number: row.rowNumber,
      email: row.data.email,
      identifier: type === 'students'
        ? (row.data as StudentImportData).index_no
        : (row.data as PersonnelImportData).employee_index,
      payload: row.data as unknown as Json,
      status: row.errors.length > 0 ? 'failed' as const : 'pending' as const,
      error_message: row.errors.length > 0 ? row.errors.join(' ') : null,
    })))
  if (rowsError) {
    await client.from('onboarding_imports').delete().eq('job_id', job.job_id)
    throw rowsError
  }

  const processed = await processPendingImportRows(client, job.job_id, redirectTo)
  const totals = {
    status: processed.job.status,
    successfulRows: processed.job.successful_rows,
    skippedRows: processed.job.skipped_rows,
    failedRows: processed.job.failed_rows,
    pendingRows: processed.job.total_rows -
      processed.job.successful_rows -
      processed.job.skipped_rows -
      processed.job.failed_rows,
  }
  await client.from('audit_logs').insert({
    action: 'IMPORT',
    table_name: 'onboarding_imports',
    record_id: job.job_id,
    user_id: actorId,
    new_data: { type, sourceFile, totalRows: rows.length, ...totals },
  })

  return processed
}

export async function getImportJob(client: ServiceClient, jobId: string) {
  const { data: job, error: jobError } = await client
    .from('onboarding_imports')
    .select('*')
    .eq('job_id', jobId)
    .single()
  if (jobError) throw jobError
  const { data: rows, error: rowsError } = await client
    .from('onboarding_import_rows')
    .select('*')
    .eq('job_id', jobId)
    .order('row_number')
  if (rowsError) throw rowsError
  return { job, rows }
}

export async function retryFailedImportRows(
  client: ServiceClient,
  jobId: string,
  redirectTo: string
) {
  const { data: job, error: jobError } = await client
    .from('onboarding_imports')
    .select('job_id, import_type')
    .eq('job_id', jobId)
    .single()
  if (jobError || !job) throw jobError || new Error('Import job not found.')

  const { data: rows, error: rowsError } = await client
    .from('onboarding_import_rows')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'failed')
    .gt('attempt_count', 0)
    .order('row_number')
    .limit(IMPORT_CHUNK_SIZE)
  if (rowsError) throw rowsError

  for (const row of rows) {
    let outcome: RowOutcome
    try {
      outcome = await processImportData(
        client,
        job.import_type,
        row.payload as unknown as StudentImportData | PersonnelImportData,
        redirectTo
      )
    } catch (error) {
      outcome = {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unable to retry this user.',
        userId: null,
      }
    }
    await client
      .from('onboarding_import_rows')
      .update({
        status: outcome.status,
        error_message: outcome.message,
        auth_user_id: outcome.userId,
        attempt_count: row.attempt_count + 1,
      })
      .eq('row_id', row.row_id)
  }

  await updateJobTotals(client, jobId)
  return getImportJob(client, jobId)
}

export async function processPendingImportRows(
  client: ServiceClient,
  jobId: string,
  redirectTo: string
) {
  const { data: job, error: jobError } = await client
    .from('onboarding_imports')
    .select('job_id, import_type')
    .eq('job_id', jobId)
    .single()
  if (jobError || !job) throw jobError || new Error('Import job not found.')

  const { data: rows, error: rowsError } = await client
    .from('onboarding_import_rows')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('row_number')
    .limit(IMPORT_CHUNK_SIZE)
  if (rowsError) throw rowsError

  for (const row of rows) {
    let outcome: RowOutcome
    try {
      outcome = await processImportData(
        client,
        job.import_type,
        row.payload as unknown as StudentImportData | PersonnelImportData,
        redirectTo
      )
    } catch (error) {
      outcome = {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unable to register this user.',
        userId: null,
      }
    }
    await client
      .from('onboarding_import_rows')
      .update({
        status: outcome.status,
        error_message: outcome.message,
        auth_user_id: outcome.userId,
        attempt_count: row.attempt_count + 1,
      })
      .eq('row_id', row.row_id)
  }

  await updateJobTotals(client, jobId)
  return getImportJob(client, jobId)
}

export type ImportJobWithRows = {
  job: TableRow<'onboarding_imports'>
  rows: TableRow<'onboarding_import_rows'>[]
}
