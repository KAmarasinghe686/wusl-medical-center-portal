import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../lib/auth/authorize'
import { invitePortalUser } from '../../lib/users/invite'
import { cleanText, isEmail } from '../../lib/validation'
import { passwordSetupCallback } from '../../lib/http/origin'

export async function POST(req: Request) {
  const authorization = await authorizeRequest(req, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await req.json().catch(() => null)
  const values = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const fullName = cleanText(values.full_name, 120)
  const email = cleanText(values.email, 254).toLowerCase()

  if (!fullName || !isEmail(email)) {
    return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 })
  }

  try {
    const user = await invitePortalUser(authorization.serviceClient, {
      email,
      role: 'faculty',
      fullName,
      employeeIndex: cleanText(values.employee_index, 80) || null,
      redirectTo: passwordSetupCallback(req),
    })
    return NextResponse.json({ success: true, user_id: user.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to invite faculty member.' },
      { status: 400 }
    )
  }
}
