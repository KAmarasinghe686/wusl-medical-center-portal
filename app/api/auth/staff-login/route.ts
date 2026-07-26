import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const body = await request.json()
  const employeeIndex = typeof body.employee_index === 'string' ? body.employee_index.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!employeeIndex || !password) {
    return NextResponse.json({ error: 'Employee ID and password are required.' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, role, employee_index')
    .eq('employee_index', employeeIndex)
    .single()

  const canAccessStaff = profile?.role === 'worker' || (profile?.role === 'admin' && Boolean(profile.employee_index))
  if (!profile || !canAccessStaff) {
    return NextResponse.json({ error: 'Invalid employee ID or password.' }, { status: 401 })
  }

  const { data: authUser, error: userError } = await serviceClient.auth.admin.getUserById(profile.id)
  if (userError || !authUser.user?.email) {
    return NextResponse.json({ error: 'Invalid employee ID or password.' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error: signInError } = await sessionClient.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Invalid employee ID or password.' }, { status: 401 })
  }

  return NextResponse.json({ success: true, destination: '/worker/dashboard' })
}
