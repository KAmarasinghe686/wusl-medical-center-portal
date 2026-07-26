import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../lib/auth/authorize'
import { passwordSetupCallback } from '../../../../lib/http/origin'
import { retryFailedImportRows } from '../../../../lib/imports/onboarding'

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  const body: unknown = await request.json().catch(() => null)
  const jobId = body && typeof body === 'object' && typeof (body as { jobId?: unknown }).jobId === 'string'
    ? (body as { jobId: string }).jobId
    : ''
  if (!jobId) return NextResponse.json({ error: 'A valid import job ID is required.' }, { status: 400 })

  try {
    return NextResponse.json(
      await retryFailedImportRows(
        authorization.serviceClient,
        jobId,
        passwordSetupCallback(request)
      )
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to retry failed invitations.' },
      { status: 400 }
    )
  }
}
