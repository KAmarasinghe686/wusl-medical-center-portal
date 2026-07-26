export type CsvRow = {
  rowNumber: number
  values: Record<string, string>
}

export type ParsedCsv = {
  headers: string[]
  rows: CsvRow[]
}

const MAX_CSV_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_ROWS = 500

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function parseCsv(text: string): ParsedCsv {
  if (new Blob([text]).size > MAX_CSV_BYTES) {
    throw new Error('CSV files must not exceed 2 MB.')
  }

  const matrix: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new Error('CSV contains an unexpected quote.')
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some(value => value.trim() !== '')) matrix.push(row)
      row = []
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.')
  row.push(field)
  if (row.some(value => value.trim() !== '')) matrix.push(row)
  if (matrix.length < 2) throw new Error('CSV must contain a header and at least one data row.')

  const headers = matrix[0].map(normalizeHeader)
  if (headers.some(header => !header)) throw new Error('CSV headers cannot be blank.')
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.')
  if (matrix.length - 1 > MAX_IMPORT_ROWS) {
    throw new Error(`A single import can contain at most ${MAX_IMPORT_ROWS} rows.`)
  }

  return {
    headers,
    rows: matrix.slice(1).map((values, rowIndex) => ({
      rowNumber: rowIndex + 2,
      values: Object.fromEntries(headers.map((header, columnIndex) => [
        header,
        values[columnIndex]?.trim() || '',
      ])),
    })),
  }
}

export function csvTemplate(headers: string[], example: string[]) {
  return `${headers.join(',')}\r\n${example.join(',')}\r\n`
}
