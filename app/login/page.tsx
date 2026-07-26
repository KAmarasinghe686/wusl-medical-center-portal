'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const ROLES = ['Student', 'Staff', 'Doctor', 'Faculty', 'Admin']
const supabase = createBrowserSupabaseClient()

export default function LoginPage() {
  const [role, setRole] = useState('Student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const showOAuthError = async () => {
      await Promise.resolve()
      const oauthError = new URLSearchParams(window.location.search).get('error')
      if (oauthError) setError(oauthError)
    }
    showOAuthError()
  }, [])

  const handleLogin = async () => {
    setError('')
    setLoading(true)

    const selectedRoleNormalized = role.toLowerCase() === 'staff' ? 'worker' : role.toLowerCase()
    const isEmployeeIdLogin = selectedRoleNormalized === 'worker' && !email.includes('@')

    if (isEmployeeIdLogin) {
      const response = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_index: email, password }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || 'Unable to sign in.')
        setLoading(false)
        return
      }
      router.push(result.destination || '/worker/dashboard')
      return
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role, employee_index').eq('id', data.user.id).single()
    if (!profile) { setError('No profile found. Please contact admin.'); await supabase.auth.signOut(); setLoading(false); return }
    const canAccessStaff = selectedRoleNormalized === 'worker' && (
      profile.role === 'worker' || (profile.role === 'admin' && Boolean(profile.employee_index))
    )
    if (profile.role !== selectedRoleNormalized && !canAccessStaff) { setError('Invalid role selected. Please select the correct role.'); await supabase.auth.signOut(); setLoading(false); return }
    const roleMap: Record<string, string> = { student: '/student/dashboard', worker: '/worker/dashboard', doctor: '/doctor/dashboard', faculty: '/faculty/dashboard', admin: '/admin/dashboard' }
    router.push(selectedRoleNormalized === 'worker' ? '/worker/dashboard' : roleMap[profile.role])
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    const selectedRole = role.toLowerCase() === 'staff' ? 'worker' : role.toLowerCase()
    const redirectTo = `${window.location.origin}/auth/callback?role=${encodeURIComponent(selectedRole)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="login-page min-h-screen flex flex-col lg:flex-row bg-gray-50">
      <style>{`
        .login-sidebar { background: linear-gradient(160deg, #0a0f1e 0%, #0d1f5c 40%, #1a0a3d 70%, #0a0f1e 100%); }
        .input-field { transition: all 0.2s; }
        .input-field:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }
        .sign-in-btn { background: linear-gradient(135deg, #1e3a8a, #2563eb); transition: all 0.2s; }
        .sign-in-btn:hover { background: linear-gradient(135deg, #1e40af, #1d4ed8); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
        .sign-in-btn:disabled { opacity: 0.6; transform: none; box-shadow: none; }
        .role-tab { transition: all 0.15s; }
        .role-tab.active { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; }
        .role-tab:not(.active):hover { background: #f1f5f9; }
        @media (max-width: 640px) {
          .app-body .login-page .login-role-list {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.3rem;
          }
          .app-body .login-page .login-role-list .role-tab {
            width: 100%;
            min-width: 0;
            min-height: 2.25rem;
            padding: 0.5rem 0.35rem;
          }
        }
      `}</style>

      {/* Left sidebar */}
      <div className="login-sidebar login-sidebar--image flex h-48 lg:h-auto lg:w-[46%] flex-col justify-between p-5 sm:p-6 lg:p-12">
        <Image
          src="/login-medical-center.png"
          alt="Bright university medical centre consultation space"
          fill
          priority
          sizes="(min-width: 1024px) 46vw, 100vw"
          className="login-hero-image"
        />
        <div className="login-hero-overlay" aria-hidden="true" />
        
        <div className="login-hero-brand flex items-center gap-3">
          <Image src="/logo.png" alt="WUSL Logo" width={60} height={60} className="object-contain drop-shadow-lg" />
          <div>
            <div className="text-white font-bold text-sm">WUSL Medical</div>
            <div className="text-blue-300/60 text-xs">Institutional Portal</div>
          </div>
        </div>

        <div className="login-hero-copy hidden lg:block">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Secure Clinical<br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Administration
            </span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Access your clinical portal securely. Manage medical records, visits, and institutional health data from anywhere.
          </p>

          
        </div>

        <div className="login-hero-footer hidden lg:block text-slate-600 text-xs">
          © 2026 Wayamba University of Sri Lanka
        </div>
      </div>

      {/* Right login form */}
      <div className="login-form-area flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="login-form-card w-full max-w-md sm:max-w-lg">

          <div className="login-form-intro mb-8">
            <div className="login-eyebrow mb-3">Secure portal access</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500">Sign in to access your portal</p>
          </div>

          {/* Role selector */}
          <div className="login-role-section mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Role</label>
            <div className="login-role-list flex gap-1 bg-gray-100 p-1 rounded-xl">
              {ROLES.map(r => (
                <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}
                  className={`role-tab flex-1 py-1.5 text-xs font-semibold rounded-lg ${role === r ? 'active' : 'text-gray-500'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="login-fields flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{role === 'Staff' ? 'Email Address or Employee ID' : 'Email Address'}</label>
              <input
                type={role === 'Staff' ? 'text' : 'email'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder={role === 'Staff' ? 'you@wusl.ac.lk or WUSL/EMP/001' : 'you@wusl.ac.lk'}
                className="input-field block w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-sm focus:outline-none shadow-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
                <Link href="/forgot-password" className="text-xs text-blue-700 hover:text-blue-800 font-medium">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  className="input-field block w-full rounded-xl border border-gray-200 bg-white py-3 px-4 pr-10 text-sm focus:outline-none shadow-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.301 8.844 6.88 6 12 6c5.12 0 8.699 2.844 9.964 5.678.045.107.045.232 0 .339C20.699 15.156 17.12 18 12 18c-5.12 0-8.699-2.844-9.964-5.678z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="sign-in-btn w-full py-3.5 text-white text-sm font-bold rounded-xl mt-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>

            <div className="login-divider" role="separator"><span>or</span></div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="google-signin-btn w-full py-3 text-sm font-semibold rounded-xl disabled:opacity-60"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-1.99 3.02v2.54h3.23c1.89-1.74 2.98-4.31 2.98-7.41Z" />
                <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.23-2.54c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.62A10 10 0 0 0 12 22Z" />
                <path fill="#FBBC05" d="M6.41 13.89A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.89V7.49H3.08A10 10 0 0 0 2 12c0 1.61.38 3.14 1.08 4.51l3.33-2.62Z" />
                <path fill="#EA4335" d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.92 5.49l3.33 2.62C7.2 7.75 9.4 5.99 12 5.99Z" />
              </svg>
              {googleLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </div>

          <p className="login-form-footer text-center text-xs text-gray-400 mt-6">
            © 2026 Medical Center Portal · Wayamba University of Sri Lanka
          </p>
        </div>
      </div>
    </div>
  )
}
