import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import { cleanText, isIsoDate } from '../../../lib/validation'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, ['student'])
  if (authorization.error) return authorization.error

  const { serviceClient, user } = authorization
  const { data: student } = await serviceClient
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })
  }

  const { data: notices, error } = await serviceClient
    .from('advance_medical_notices')
    .select('*')
    .eq('student_id', student.student_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ notices: notices || [] })
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['student'])
  if (authorization.error) return authorization.error

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Valid JSON payload is required.' }, { status: 400 })
  }

  const illnessStartDate = cleanText(body.illness_start_date, 20)
  const expectedEndDate = cleanText(body.expected_end_date, 20) || illnessStartDate
  const reason = cleanText(body.reason, 1000)
  const submissionType = body.submission_type === 'exam' ? 'exam' : 'general'
  const treatmentStatus = cleanText(body.treatment_status, 80) || 'Resting at Home'
  const hospitalName = cleanText(body.hospital_name, 150) || null
  const contactNumber = cleanText(body.contact_number, 30) || null
  const affectedCourses = Array.isArray(body.affected_courses) ? body.affected_courses : null

  if (!isIsoDate(illnessStartDate)) {
    return NextResponse.json({ error: 'A valid illness commencement date is required.' }, { status: 400 })
  }

  if (reason.length < 5) {
    return NextResponse.json({ error: 'Please describe the illness or reason (at least 5 characters).' }, { status: 400 })
  }

  if (submissionType === 'exam' && (!affectedCourses || affectedCourses.length === 0)) {
    return NextResponse.json({ error: 'Please specify at least one missed course unit / exam paper.' }, { status: 400 })
  }

  const { serviceClient, user } = authorization
  const { data: student, error: studentError } = await serviceClient
    .from('students')
    .select('student_id, full_name, index_no, faculty')
    .eq('user_id', user.id)
    .single()

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })
  }

  const { data: notice, error: insertError } = await serviceClient
    .from('advance_medical_notices')
    .insert({
      student_id: student.student_id,
      submission_type: submissionType,
      illness_start_date: illnessStartDate,
      expected_end_date: expectedEndDate,
      reason,
      treatment_status: treatmentStatus,
      hospital_name: hospitalName,
      affected_courses: affectedCourses,
      contact_number: contactNumber,
      status: 'pending',
    })
    .select('*')
    .single()

  if (insertError || !notice) {
    return NextResponse.json({ error: insertError?.message || 'Unable to register advance notice.' }, { status: 400 })
  }

  // Create notifications for Dean and Faculty
  const { data: facultyMembers } = await serviceClient
    .from('profiles')
    .select('id')
    .in('role', ['faculty', 'dean'])

  if (facultyMembers && facultyMembers.length > 0) {
    await serviceClient.from('notifications').insert(
      facultyMembers.map(({ id }) => ({
        user_id: id,
        title: 'Advance Medical Notice to Dean',
        message: `${student.full_name} (${student.index_no}) submitted an Advance Medical Notice for illness starting ${illnessStartDate}.`,
        type: 'advance_medical_notice',
      }))
    )
  }

  return NextResponse.json({ success: true, notice }, { status: 201 })
}
