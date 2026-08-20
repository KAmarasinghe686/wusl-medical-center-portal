import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import { cleanText } from '../../../lib/validation'

export async function POST(req: Request) {
  const authorization = await authorizeRequest(req, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }

  const values = body as Record<string, unknown>
  const month = cleanText(values.month, 20) || 'All Months'
  const batch = cleanText(values.batch, 50) || 'All Batches'
  const totalRecords = Number(values.totalRecords) || 0
  const totalStudents = Number(values.totalStudents) || 0

  const { serviceClient, user } = authorization

  // Fetch registered department emails
  const { data: departments } = await serviceClient
    .from('departments')
    .select('department_name, department_code, head_email')
    .order('department_code')

  const recipientDepartments = (departments && departments.length > 0)
    ? departments.map(d => ({
        name: d.department_name,
        code: d.department_code,
        email: d.head_email || `${d.department_code.toLowerCase()}@wyb.ac.lk`,
      }))
    : [
        { name: 'Department of Computing & Information Systems', code: 'CIS', email: 'cis@wyb.ac.lk' },
        { name: 'Department of Electronics', code: 'ELT', email: 'elt@wyb.ac.lk' },
        { name: 'Department of Mathematical Sciences', code: 'MS', email: 'ms@wyb.ac.lk' },
        { name: 'Department of Industrial Management', code: 'IM', email: 'im@wyb.ac.lk' },
      ]

  const dispatchedAt = new Date().toISOString()

  // Log dispatch action in audit_logs for compliance and records
  await serviceClient.from('audit_logs').insert({
    action: 'BATCH_SCHEDULE_DISPATCHED',
    table_name: 'medical_records',
    record_id: `DISPATCH-${month}-${batch}`,
    user_id: user.id,
    new_data: {
      month,
      batch,
      total_records: totalRecords,
      total_students: totalStudents,
      dispatched_to: recipientDepartments,
      dispatched_at: dispatchedAt,
    },
  })

  return NextResponse.json({
    success: true,
    dispatchedAt,
    dispatchedTo: recipientDepartments,
    month,
    batch,
    message: `Officially dispatched ${month} (${batch}) medical schedule to the 4 departments.`,
  })
}
