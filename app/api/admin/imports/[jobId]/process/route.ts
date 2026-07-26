import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../../lib/auth/authorize'
import { passwordSetupCallback } from '../../../../../lib/http/origin'
import { processPendingImportRows } from '../../../../../lib/imports/onboarding'

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  try {
    const { jobId } = await context.params
    return NextResponse.json(
      await processPendingImportRows(
        authorization.serviceClient,
        jobId,
        passwordSetupCallback(request)
      )
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to continue this import.' },
      { status: 400 }
    )
  }
}
