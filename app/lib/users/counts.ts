export type PortalUserCounts = {
  total: number
  students: number
  faculty: number
  doctors: number
  admins: number
  staff: number
}

export const EMPTY_PORTAL_USER_COUNTS: PortalUserCounts = {
  total: 0,
  students: 0,
  faculty: 0,
  doctors: 0,
  admins: 0,
  staff: 0,
}

export async function fetchPortalUserCounts(accessToken?: string): Promise<PortalUserCounts> {
  const headers = new Headers()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch('/api/user-counts', {
    headers,
    cache: 'no-store',
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Unable to load user counts.')
  }

  return result.counts as PortalUserCounts
}
