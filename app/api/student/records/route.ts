import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import {
  MAX_MEDICAL_FILES,
  calculateLeaveDays,
  cleanText,
  isIsoDate,
  isPastOrToday,
  isValidDateRange,
  safeFileName,
  validateMedicalFile,
} from '../../../lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['student'])
  if (authorization.error) return authorization.error

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'A valid multipart submission is required.' }, { status: 400 })
  }

  const purpose = cleanText(formData.get('purpose'), 160)
  const description = cleanText(formData.get('description'), 4000) || null
  const issueDateValue = formData.get('issue_date')
  const issueDate = typeof issueDateValue === 'string' ? issueDateValue : ''
  const leaveStartDateValue = formData.get('leave_start_date')
  const leaveStartDate = typeof leaveStartDateValue === 'string' && isIsoDate(leaveStartDateValue) ? leaveStartDateValue : issueDate
  const leaveEndDateValue = formData.get('leave_end_date')
  const leaveEndDate = typeof leaveEndDateValue === 'string' && isIsoDate(leaveEndDateValue) ? leaveEndDateValue : leaveStartDate
  const rawHolidays = parseInt(String(formData.get('number_of_holidays') || '0'), 10)
  const numberOfHolidays = Math.max(0, isNaN(rawHolidays) ? 0 : rawHolidays)
  const leaveDaysCount = Math.max(1, calculateLeaveDays(leaveStartDate, leaveEndDate))

  const rawSubmissionType = cleanText(formData.get('submission_type'), 20)
  const submissionType = rawSubmissionType === 'exam' ? 'exam' : 'general'
  const issuerType = cleanText(formData.get('issuer_type'), 80) || null
  const doctorName = cleanText(formData.get('doctor_name'), 120) || null
  const illnessTiming = cleanText(formData.get('illness_timing'), 30) || 'before_exam'
  const examAcademicYear = cleanText(formData.get('exam_academic_year'), 30) || null
  const examSemester = cleanText(formData.get('exam_semester'), 30) || null
  const examDegreeProgramme = cleanText(formData.get('exam_degree_programme'), 120) || 'B.Sc. (General/ Joint Major/Honours/ Special) Degree Programmes'

  let examCourses: Array<{ course_code: string; course_name: string; exam_date: string }> | null = null
  if (submissionType === 'exam') {
    const rawCoursesJson = formData.get('exam_courses')
    try {
      const parsed = typeof rawCoursesJson === 'string' ? JSON.parse(rawCoursesJson) : []
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return NextResponse.json({ error: 'Please add at least one missed exam paper/course unit.' }, { status: 400 })
      }
      examCourses = parsed.map((item: { course_code?: unknown; course_name?: unknown; exam_date?: unknown }) => ({
        course_code: cleanText(item.course_code, 30).toUpperCase(),
        course_name: cleanText(item.course_name, 120),
        exam_date: cleanText(item.exam_date, 20),
      }))
    } catch {
      return NextResponse.json({ error: 'Invalid exam courses format.' }, { status: 400 })
    }
  }

  const rawMedicalFiles = formData.getAll('medical_files').filter((value): value is File => value instanceof File)
  const rawLetterFiles = formData.getAll('letter_files').filter((value): value is File => value instanceof File)
  const fallbackFiles = formData.getAll('files').filter((value): value is File => value instanceof File)

  const medicalFiles = rawMedicalFiles.length > 0 ? rawMedicalFiles : (fallbackFiles.length > 0 ? [fallbackFiles[0]] : [])
  const letterFiles = rawLetterFiles.length > 0 ? rawLetterFiles : (fallbackFiles.length > 1 ? fallbackFiles.slice(1) : [])

  if (!purpose || !isIsoDate(issueDate) || !isPastOrToday(issueDate)) {
    return NextResponse.json({ error: 'A valid purpose and non-future issue date are required.' }, { status: 400 })
  }
  if (!doctorName) {
    return NextResponse.json({ error: 'Please specify the issuing doctor / medical practitioner name.' }, { status: 400 })
  }
  if (!isValidDateRange(leaveStartDate, leaveEndDate)) {
    return NextResponse.json({ error: 'Leave start date must be on or before leave end date.' }, { status: 400 })
  }
  if (medicalFiles.length < 1 || medicalFiles.length > MAX_MEDICAL_FILES) {
    return NextResponse.json({ error: `Attach between 1 and ${MAX_MEDICAL_FILES} medical certificates.` }, { status: 400 })
  }
  if (rawLetterFiles.length === 0 && rawMedicalFiles.length > 0) {
    return NextResponse.json({ error: 'Please attach the Letter to the Dean requesting absence consideration.' }, { status: 400 })
  }
  if (letterFiles.length > MAX_MEDICAL_FILES) {
    return NextResponse.json({ error: `Attach up to ${MAX_MEDICAL_FILES} letter documents.` }, { status: 400 })
  }

  for (const file of medicalFiles) {
    const validationError = validateMedicalFile(file)
    if (validationError) return NextResponse.json({ error: `Medical Certificate: ${validationError}` }, { status: 400 })
  }
  for (const file of letterFiles) {
    const validationError = validateMedicalFile(file)
    if (validationError) return NextResponse.json({ error: `Letter to Dean: ${validationError}` }, { status: 400 })
  }

  const { serviceClient, user } = authorization
  const { data: student, error: studentError } = await serviceClient
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single()

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 409 })
  }

  // Look up any matching advance notice from student
  let advanceNoticeId: number | null = null
  try {
    const { data: matchedNotice } = await serviceClient
      .from('advance_medical_notices')
      .select('notice_id')
      .eq('student_id', student.student_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (matchedNotice) {
      advanceNoticeId = matchedNotice.notice_id
    }
  } catch {
    // advance_medical_notices table might not be initialized yet
  }

  const { data: record, error: recordError } = await serviceClient
    .from('medical_records')
    .insert({
      student_id: student.student_id,
      purpose,
      description,
      issue_date: issueDate,
      leave_start_date: leaveStartDate,
      leave_end_date: leaveEndDate,
      leave_days_count: leaveDaysCount,
      number_of_holidays: numberOfHolidays,
      status: 'pending',
      workflow_stage: 'faculty_review',
      submitted_by: 'student',
      submission_type: submissionType,
      issuer_type: issuerType,
      doctor_name: doctorName,
      illness_timing: illnessTiming,
      exam_academic_year: examAcademicYear,
      exam_semester: examSemester,
      exam_degree_programme: examDegreeProgramme,
      exam_courses: examCourses,
      faculty_board_decision: 'Pending',
      advance_notice_id: advanceNoticeId,
    })
    .select('record_id')
    .single()

  if (advanceNoticeId) {
    await serviceClient
      .from('advance_medical_notices')
      .update({ status: 'medical_submitted' })
      .eq('notice_id', advanceNoticeId)
  }

  if (recordError || !record) {
    return NextResponse.json({ error: recordError?.message || 'Unable to create the record.' }, { status: 400 })
  }

  const uploadedPaths: string[] = []
  let auditId: number | null = null
  let notificationIds: number[] = []
  try {
    // 1. Upload Medical Certificates
    for (const file of medicalFiles) {
      const path = `${user.id}/${record.record_id}/med-cert-${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await serviceClient.storage
        .from('medical-documents')
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)

      const { error: metadataError } = await serviceClient.from('record_images').insert({
        record_id: record.record_id,
        file_path: path,
        file_type: file.type,
        file_size_kb: Math.max(1, Math.ceil(file.size / 1024)),
        document_type: 'medical_certificate',
      })
      if (metadataError) {
        // Fallback without document_type if column is not yet in PostgREST cache
        await serviceClient.from('record_images').insert({
          record_id: record.record_id,
          file_path: path,
          file_type: file.type,
          file_size_kb: Math.max(1, Math.ceil(file.size / 1024)),
        })
      }
    }

    // 2. Upload Letter to the Dean
    for (const file of letterFiles) {
      const path = `${user.id}/${record.record_id}/letter-dean-${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error: uploadError } = await serviceClient.storage
        .from('medical-documents')
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)

      const { error: metadataError } = await serviceClient.from('record_images').insert({
        record_id: record.record_id,
        file_path: path,
        file_type: file.type,
        file_size_kb: Math.max(1, Math.ceil(file.size / 1024)),
        document_type: 'letter_to_dean',
      })
      if (metadataError) {
        // Fallback without document_type if column is not yet in PostgREST cache
        await serviceClient.from('record_images').insert({
          record_id: record.record_id,
          file_path: path,
          file_type: file.type,
          file_size_kb: Math.max(1, Math.ceil(file.size / 1024)),
        })
      }
    }

    const { data: audit, error: auditError } = await serviceClient
      .from('audit_logs')
      .insert({
        action: 'INSERT',
        table_name: 'medical_records',
        record_id: String(record.record_id),
        user_id: user.id,
        new_data: { record_id: record.record_id, student_id: student.student_id, status: 'pending', workflow_stage: 'faculty_review' },
      })
      .select('audit_id')
      .single()
    if (auditError || !audit) throw auditError || new Error('Unable to write the audit entry.')
    auditId = audit.audit_id

    const { data: faculty, error: facultyError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('role', 'faculty')
    if (facultyError) throw facultyError

    if (faculty.length > 0) {
      const { data: notifications, error: notificationError } = await serviceClient
        .from('notifications')
        .insert(
          faculty.map(({ id }) => ({
            user_id: id,
            title: 'Faculty Administrative Review required',
            message: `Medical record REC-${record.record_id} is awaiting Faculty Administrative Review.`,
            type: 'record_faculty_review',
          }))
        )
        .select('notification_id')
      if (notificationError) throw notificationError
      notificationIds = notifications.map(({ notification_id }) => notification_id)
    }

    return NextResponse.json({ success: true, record_id: record.record_id }, { status: 201 })
  } catch (error) {
    if (notificationIds.length > 0) {
      await serviceClient.from('notifications').delete().in('notification_id', notificationIds)
    }
    if (auditId !== null) {
      await serviceClient.from('audit_logs').delete().eq('audit_id', auditId)
    }
    if (uploadedPaths.length > 0) {
      await serviceClient.storage.from('medical-documents').remove(uploadedPaths)
    }
    await serviceClient.from('medical_records').delete().eq('record_id', record.record_id)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The submission could not be completed.' },
      { status: 500 }
    )
  }
}
