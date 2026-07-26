import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../lib/auth/authorize'
import { invitePortalUser } from '../../lib/users/invite'
import { passwordSetupCallback } from '../../lib/http/origin'
import { cleanText, isAppliedScienceStudentIndex, isEmail, isUserRole } from '../../lib/validation'

export async function POST(req: Request) {
  const authorization = await authorizeRequest(req, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const values = body as Record<string, unknown>
  const email = cleanText(values.email, 254).toLowerCase()
  const fullName = cleanText(values.full_name, 120)
  const role = values.role
  const employeeIndex = cleanText(values.employee_index, 80) || null
  const specialisation = cleanText(values.specialisation, 120) || null
  const studentIndex = cleanText(values.student_index, 80)
  let studentId = Number(values.student_id)

  if (!isEmail(email) || !fullName || !isUserRole(role)) {
    return NextResponse.json({ error: 'A valid email, full name, and role are required.' }, { status: 400 })
  }
  if (role !== 'student' && !employeeIndex) {
    return NextResponse.json({ error: 'An employee ID is required for personnel and administrators.' }, { status: 400 })
  }
  if (role === 'doctor' && !specialisation) {
    return NextResponse.json({ error: 'A specialisation is required for doctors.' }, { status: 400 })
  }
  if (role === 'student' && (!Number.isInteger(studentId) || studentId <= 0)) {
    if (!isAppliedScienceStudentIndex(studentIndex)) {
      return NextResponse.json({ error: 'A valid six-digit student index in format 2x2xxx is required.' }, { status: 400 })
    }
    const { data: student, error: studentError } = await authorization.serviceClient
      .from('students')
      .select('student_id, user_id')
      .eq('index_no', studentIndex)
      .maybeSingle()
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 })
    if (!student) return NextResponse.json({ error: 'Create the student roster record before sending an invitation.' }, { status: 404 })
    if (student.user_id) return NextResponse.json({ error: 'This student record is already linked to an account.' }, { status: 409 })
    studentId = student.student_id
  }

  try {
    const user = await invitePortalUser(authorization.serviceClient, {
      email,
      role,
      fullName,
      employeeIndex,
      specialisation,
      studentId: role === 'student' ? studentId : null,
      redirectTo: passwordSetupCallback(req),
    })
    return NextResponse.json({ success: true, user_id: user.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to invite this user.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
