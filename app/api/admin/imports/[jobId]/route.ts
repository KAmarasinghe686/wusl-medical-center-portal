import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../lib/auth/authorize'
import { getImportJob } from '../../../../lib/imports/onboarding'

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  try {
    const { jobId } = await context.params
    return NextResponse.json(await getImportJob(authorization.serviceClient, jobId))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import job not found.' },
      { status: 404 }
    )
  }
}
