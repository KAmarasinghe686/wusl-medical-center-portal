import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const roleRoutes: Record<string, string> = {
  student: '/student/dashboard',
  worker: '/worker/dashboard',
  doctor: '/doctor/dashboard',
  faculty: '/faculty/dashboard',
  admin: '/admin/dashboard',
}

function appOrigin(request: Request) {
  const { origin } = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  return process.env.NODE_ENV === 'development' || !forwardedHost
    ? origin
    : `https://${forwardedHost}`
}

function loginError(request: Request, message: string) {
  const url = new URL('/login', appOrigin(request))
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

function recoveryError(request: Request, message: string) {
  const url = new URL('/forgot-password', appOrigin(request))
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const expectedRole = requestUrl.searchParams.get('role')
  const isPasswordRecovery = requestUrl.searchParams.get('next') === '/reset-password'

  if (!code) {
    if (isPasswordRecovery) {
      return recoveryError(request, 'The password reset link is invalid or expired. Please request a new one.')
    }
    return loginError(request, 'Google sign-in was cancelled or could not be completed.')
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    if (isPasswordRecovery) {
      return recoveryError(request, 'The password reset link is invalid or expired. Please request a new one.')
    }
    return loginError(request, 'Google sign-in could not be completed. Please try again.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (isPasswordRecovery) {
      return recoveryError(request, 'The password reset session could not be verified. Please request a new link.')
    }
    return loginError(request, 'Google sign-in could not verify your account.')
  }

  if (isPasswordRecovery) {
    return NextResponse.redirect(new URL('/reset-password', appOrigin(request)), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_index, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !roleRoutes[profile.role]) {
    await supabase.auth.signOut()
    return loginError(request, 'This Google account is not registered for the portal.')
  }
  if (!profile.is_active) {
    await supabase.auth.signOut()
    return loginError(request, 'This account has been deactivated. Contact the Medical Center administration.')
  }

  const canAccessStaff = expectedRole === 'worker' && (
    profile.role === 'worker' || (profile.role === 'admin' && Boolean(profile.employee_index))
  )

  if (expectedRole && expectedRole !== profile.role && !canAccessStaff) {
    await supabase.auth.signOut()
    return loginError(request, 'This account is registered under a different portal role.')
  }

  const destination = expectedRole === 'worker' ? roleRoutes.worker : roleRoutes[profile.role]
  return NextResponse.redirect(new URL(destination, appOrigin(request)))
}
