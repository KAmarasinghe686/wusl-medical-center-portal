import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../lib/auth/authorize'
import { cleanText, isAppliedScienceStudentIndex, isIsoDate } from '../../lib/validation'

export async function POST(req: Request) {
  const authorization = await authorizeRequest(req, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }
  const values = body as Record<string, unknown>
  const fullName = cleanText(values.full_name, 120)
  const indexNo = cleanText(values.index_no, 80)
  const dob = cleanText(values.dob, 10)

  if (!fullName || !isAppliedScienceStudentIndex(indexNo) || (dob && !isIsoDate(dob))) {
    return NextResponse.json(
      { error: 'A full name and six-digit Applied Sciences index in format 2x2xxx are required.' },
      { status: 400 }
    )
  }

  const { data: existing } = await authorization.serviceClient
    .from('students')
    .select('student_id')
    .eq('index_no', indexNo)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Student with this index number already exists' }, { status: 409 })
  }

  const { data, error } = await authorization.serviceClient
    .from('students')
    .insert({
      full_name: fullName,
      index_no: indexNo,
      faculty: cleanText(values.faculty, 120) || null,
      academic_year: cleanText(values.academic_year, 30) || null,
      dob: dob || null,
      gender: cleanText(values.gender, 30) || null,
      contact_no: cleanText(values.contact_no, 30) || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true, student: data }, { status: 201 })
}
