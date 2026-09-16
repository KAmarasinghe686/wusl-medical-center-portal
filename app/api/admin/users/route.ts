import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { authorizeRequest } from '../../../lib/auth/authorize'
import type { TableRow } from '../../../lib/supabase/database.types'
import { cleanText, isEmail } from '../../../lib/validation'

type ProfileRow = Pick<
  TableRow<'profiles'>,
  'id' | 'full_name' | 'role' | 'faculty_sub_role' | 'employee_index' | 'is_active' | 'status_reason' | 'status_changed_at' | 'created_at'
>

type RoleNameRow = {
  user_id: string | null
  full_name: string | null
  index_no?: string
}

async function listAllAuthUsers(serviceClient: NonNullable<Awaited<ReturnType<typeof authorizeRequest>>['serviceClient']>) {
  const users: User[] = []
  let page = 1

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
    page += 1
  }

  return users
}

async function listAllProfiles(serviceClient: NonNullable<Awaited<ReturnType<typeof authorizeRequest>>['serviceClient']>) {
  const profiles: ProfileRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await serviceClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + 999)

    if (error) throw error
    profiles.push(...(data || []))
    if (!data || data.length < 1000) break
    from += 1000
  }

  return profiles
}

async function listAllRoleNames(
  serviceClient: NonNullable<Awaited<ReturnType<typeof authorizeRequest>>['serviceClient']>,
  table: 'students' | 'doctors'
) {
  const rows: RoleNameRow[] = []
  let from = 0

  while (true) {
    if (table === 'students') {
      const { data, error } = await serviceClient
        .from('students')
        .select('user_id, full_name, index_no')
        .range(from, from + 999)
      if (error) throw error
      rows.push(...data)
      if (data.length < 1000) break
    } else {
      const { data, error } = await serviceClient
        .from('doctors')
        .select('user_id, full_name')
        .range(from, from + 999)
      if (error) throw error
      rows.push(...data)
      if (data.length < 1000) break
    }
    from += 1000
  }

  return rows
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error
  const { serviceClient } = authorization

  try {
    const [authUsers, profiles, students, doctors] = await Promise.all([
      listAllAuthUsers(serviceClient),
      listAllProfiles(serviceClient),
      listAllRoleNames(serviceClient, 'students'),
      listAllRoleNames(serviceClient, 'doctors'),
    ])
    const profilesById = new Map(profiles.map(profile => [profile.id, profile]))
    const studentsById = new Map(
      students.filter(row => row.user_id).map(row => [row.user_id as string, row])
    )
    const doctorNamesById = new Map(
      doctors.filter(row => row.user_id).map(row => [row.user_id as string, row.full_name])
    )

    const users = authUsers
      .map(user => {
        const profile = profilesById.get(user.id)
        const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : Number.NaN
        const roleSpecificName = profile?.role === 'student'
          ? studentsById.get(user.id)?.full_name
          : profile?.role === 'doctor'
            ? doctorNamesById.get(user.id)
            : null
        return {
          id: user.id,
          email: user.email || '',
          full_name: roleSpecificName || profile?.full_name || user.user_metadata?.full_name || null,
          role: profile?.role || 'unassigned',
          employee_index: profile?.role === 'student'
            ? studentsById.get(user.id)?.index_no || null
            : profile?.employee_index || null,
          is_active: profile?.is_active !== false && (Number.isNaN(bannedUntil) || bannedUntil <= Date.now()),
          status_reason: profile?.status_reason || null,
          status_changed_at: profile?.status_changed_at || null,
          created_at: profile?.created_at || user.created_at,
        }
      })
      .sort((left, right) => new Date(String(right.created_at)).getTime() - new Date(String(left.created_at)).getTime())

    return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load users.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest(request, ['admin'])
  if (authorization.error) return authorization.error
  const { serviceClient } = authorization

  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 })
  }
  const values = body as Record<string, unknown>
  if (typeof values.id !== 'string') {
    return NextResponse.json({ error: 'A user ID is required.' }, { status: 400 })
  }

  if (values.action === 'toggle-active') {
    if (typeof values.is_active !== 'boolean') {
      return NextResponse.json({ error: 'A valid account status is required.' }, { status: 400 })
    }

    if (!values.is_active && authorization.user.id === values.id) {
      return NextResponse.json({ error: 'You cannot deactivate your own administrator account.' }, { status: 400 })
    }

    const reason = cleanText(values.reason, 500)
    if (reason.length < 5) {
      return NextResponse.json({ error: 'Enter a clear reason of at least 5 characters.' }, { status: 400 })
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('is_active')
      .eq('id', values.id)
      .maybeSingle()
    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
    }

    const { error: authError } = await serviceClient.auth.admin.updateUserById(values.id, {
      ban_duration: values.is_active ? 'none' : '876000h',
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const { error: statusError } = await serviceClient.rpc('admin_set_account_status', {
      p_actor_id: authorization.user.id,
      p_user_id: values.id,
      p_is_active: values.is_active,
      p_reason: reason,
    })
    if (statusError) {
      await serviceClient.auth.admin.updateUserById(values.id, {
        ban_duration: targetProfile.is_active ? 'none' : '876000h',
      })
      return NextResponse.json({ error: statusError.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  if (values.action === 'update-email') {
    const email = cleanText(values.email, 254).toLowerCase()
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'A valid real login email is required.' }, { status: 400 })
    }

    const { data: existingAuth, error: existingAuthError } = await serviceClient.auth.admin.getUserById(values.id)
    if (existingAuthError || !existingAuth.user) {
      return NextResponse.json({ error: 'Authentication account not found.' }, { status: 404 })
    }

    const oldEmail = existingAuth.user.email || ''
    const emailChanged = oldEmail.toLowerCase() !== email
    if (!emailChanged) {
      return NextResponse.json({ success: true, email_changed: false })
    }

    let authUsers: User[]
    try {
      authUsers = await listAllAuthUsers(serviceClient)
    } catch {
      return NextResponse.json(
        { error: 'Unable to verify whether the login email is available. Please try again.' },
        { status: 500 }
      )
    }

    const emailOwner = authUsers.find(user =>
      user.id !== values.id && user.email?.toLowerCase() === email
    )
    if (emailOwner) {
      return NextResponse.json(
        {
          error: 'This email is already the login email for another account. Use a different email or manage the existing account instead.',
          code: 'EMAIL_ALREADY_IN_USE',
        },
        { status: 409 }
      )
    }

    const { error: emailError } = await serviceClient.auth.admin.updateUserById(values.id, { email })
    if (emailError) {
      return NextResponse.json(
        { error: `Unable to change the login email: ${emailError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, email_changed: true })
  }

  if (values.action === 'update-faculty-subrole') {
    const subRole = typeof values.faculty_sub_role === 'string' ? values.faculty_sub_role : ''
    if (subRole !== 'full_access' && subRole !== 'coursework_staff' && subRole !== 'exam_staff') {
      return NextResponse.json({ error: 'Invalid faculty desk assignment.' }, { status: 400 })
    }
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ faculty_sub_role: subRole })
      .eq('id', String(values.id || ''))

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (values.action === 'edit') {
    return NextResponse.json(
      {
        error: 'Institutional name, role, and ID are read-only. Update them through the authorized Student Registry or HR workflow.',
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
}
