import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../../../lib/auth/authorize'
import { addExistingAccountErrors } from '../../../../../lib/imports/onboarding'
import { importRowsFromRequest } from '../../../../../lib/imports/request'
import { publicValidationResult, validatePersonnelImportRows } from '../../../../../lib/imports/validation'

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error

  try {
    const parsed = await importRowsFromRequest(request)
    const rows = validatePersonnelImportRows(parsed.rows)
    await addExistingAccountErrors(authorization.serviceClient, 'personnel', rows)
    return NextResponse.json({
      sourceFile: parsed.sourceFile,
      ...publicValidationResult(rows),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to validate the personnel import.' },
      { status: 400 }
    )
  }
}
