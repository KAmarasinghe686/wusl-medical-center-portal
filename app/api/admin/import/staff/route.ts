import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../lib/auth/authorize'
import { passwordSetupCallback } from '../../../../lib/http/origin'
import { runOnboardingImport } from '../../../../lib/imports/onboarding'
import { importRowsFromRequest } from '../../../../lib/imports/request'
import { validatePersonnelImportRows } from '../../../../lib/imports/validation'

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  try {
    const parsed = await importRowsFromRequest(request)
    const rows = validatePersonnelImportRows(parsed.rows)
    const result = await runOnboardingImport(
      authorization.serviceClient,
      authorization.user.id,
      'personnel',
      parsed.sourceFile,
      rows,
      passwordSetupCallback(request)
    )
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import personnel.' },
      { status: 400 }
    )
  }
}
