import { parseCsv } from './csv'

export async function importRowsFromRequest(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) {
      throw new Error('Attach a valid CSV file.')
    }
    return { ...parseCsv(await file.text()), sourceFile: file.name }
  }

  const body: unknown = await request.json()
  if (!body || typeof body !== 'object') throw new Error('A valid import payload is required.')
  const values = body as { csv?: unknown; sourceFile?: unknown }
  if (typeof values.csv !== 'string') throw new Error('The import payload must include CSV text.')
  return {
    ...parseCsv(values.csv),
    sourceFile: typeof values.sourceFile === 'string' ? values.sourceFile.slice(0, 255) : null,
  }
}
