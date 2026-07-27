import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedPage =
    request.nextUrl.pathname.startsWith('/student') ||
    request.nextUrl.pathname.startsWith('/worker') ||
    request.nextUrl.pathname.startsWith('/doctor') ||
    request.nextUrl.pathname.startsWith('/faculty') ||
    request.nextUrl.pathname.startsWith('/admin')

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isProtectedPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.is_active) {
      await supabase.auth.signOut()
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'This account has been deactivated. Contact the Medical Center administration.')
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
