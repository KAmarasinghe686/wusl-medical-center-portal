import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../lib/auth/authorize'

const PORTAL_ROLES = ['student', 'faculty', 'doctor', 'admin', 'worker'] as const

type CountedRole = (typeof PORTAL_ROLES)[number]

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, PORTAL_ROLES)
  if (authorization.error) return authorization.error

  const { data, error } = await authorization.serviceClient
    .from('profiles')
    .select('role')
    .in('role', [...PORTAL_ROLES])

  if (error) {
    return NextResponse.json({ error: 'Unable to load user counts.' }, { status: 500 })
  }

  const counts: Record<CountedRole, number> = {
    student: 0,
    faculty: 0,
    doctor: 0,
    admin: 0,
    worker: 0,
  }

  for (const profile of data || []) {
    if (PORTAL_ROLES.includes(profile.role as CountedRole)) {
      counts[profile.role as CountedRole] += 1
    }
  }

  return NextResponse.json(
    {
      counts: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        students: counts.student,
        faculty: counts.faculty,
        doctors: counts.doctor,
        admins: counts.admin,
        staff: counts.worker,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
