import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createCookieClient, createServiceClient } from '../supabase/server'
import type { UserRole } from '../supabase/database.types'

type AuthorizationSuccess = {
  user: User
  role: UserRole
  serviceClient: ReturnType<typeof createServiceClient>
  error: null
}

type AuthorizationFailure = {
  user: null
  role: null
  serviceClient: null
  error: NextResponse
}

export type AuthorizationResult = AuthorizationSuccess | AuthorizationFailure

export async function authorizeRequest(
  request: Request,
  allowedRoles: readonly UserRole[]
): Promise<AuthorizationResult> {
  const serviceClient = createServiceClient()
  const authorizationHeader = request.headers.get('authorization')
  const accessToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]

  const userResult = accessToken
    ? await serviceClient.auth.getUser(accessToken)
    : await (await createCookieClient()).auth.getUser()

  const user = userResult.data.user
  if (!user) {
    return {
      user: null,
      role: null,
      serviceClient: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !profile.is_active || !allowedRoles.includes(profile.role)) {
    return {
      user: null,
      role: null,
      serviceClient: null,
      error: NextResponse.json(
        { error: profile && !profile.is_active ? 'This account has been deactivated.' : 'Forbidden' },
        { status: 403 }
      ),
    }
  }

  return { user, role: profile.role, serviceClient, error: null }
}
