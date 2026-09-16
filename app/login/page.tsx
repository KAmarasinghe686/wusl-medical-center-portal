'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'
import styles from './login.module.css'

const ROLES = ['Student', 'Staff', 'Doctor', 'Faculty', 'Dean', 'Admin']
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
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, employee_index, is_active')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setError('No profile found. Please contact admin.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (!profile.is_active) {
      setError('This account has been deactivated. Contact the Medical Center administration.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    const canAccessStaff = selectedRoleNormalized === 'worker' && (
      profile.role === 'worker' || (profile.role === 'admin' && Boolean(profile.employee_index))
    )
    const canAccessDean = selectedRoleNormalized === 'dean' && (
      profile.role === 'dean' || data.user.email === 'dean@wusl.ac.lk' || data.user.user_metadata?.role === 'dean'
    )

    if (profile.role !== selectedRoleNormalized && !canAccessStaff && !canAccessDean) {
      setError('Invalid role selected. Please select the correct role.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (selectedRoleNormalized === 'dean' || profile.role === 'dean') {
      router.push('/dean/dashboard')
      return
    }

    const roleMap: Record<string, string> = {
      student: '/student/dashboard',
      worker: '/worker/dashboard',
      doctor: '/doctor/dashboard',
      faculty: '/faculty/dashboard',
      dean: '/dean/dashboard',
      admin: '/admin/dashboard',
    }
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
    <main className={styles.page}>
      <section className={styles.formPanel}>
        <div className={styles.loginCard}>
          <aside className={styles.brandPanel}>
            <Image src="/logo.png" alt="Wayamba University of Sri Lanka crest" width={70} height={70} />
            <div className={styles.brandPanelCopy}>
              <span>Wayamba University of Sri Lanka</span>
              <h1>Medical Center Portal</h1>
              <p>Secure access to university medical and health services.</p>
            </div>
            <div className={styles.brandPanelContact}>
              <span>Medical Center support</span>
              <a href="tel:+94373158779">037 315 8779</a>
              <a href="mailto:umck@wyb.ac.lk">umck@wyb.ac.lk</a>
            </div>

            {/* Test Accounts Box on Left Panel */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-3 text-xs text-white/90 space-y-1.5 mt-3">
              <div className="font-bold text-[11px] text-white/80">
                Testing Accounts (Password: <span className="font-mono text-white lowercase">test1234</span>)
              </div>
              <div className="space-y-0.5 font-mono text-[11px] text-white/80">
                <div>• student@wusl.ac.lk</div>
                <div>• doctor@wusl.ac.lk</div>
                <div>• faculty@wusl.ac.lk</div>
                <div>• dean@wusl.ac.lk</div>
                <div>• admin@wusl.ac.lk</div>
                <div>• staff@wusl.ac.lk</div>
              </div>
            </div>

            <div className={styles.authorizedLabel}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 3 5.5 5.8v5.4c0 4.1 2.7 7.9 6.5 9.2 3.8-1.3 6.5-5.1 6.5-9.2V5.8L12 3Z" />
                <path d="M9.2 11.8 11 13.6l3.9-4.1" />
              </svg>
              Authorized institutional users only
            </div>
          </aside>

          <div className={styles.formWrap}>
            <div className={styles.formIntro}>
              <span className={styles.eyebrow}>Institutional access</span>
              <h2>Sign in to your account</h2>
              <p>Select your account type and enter your registered credentials.</p>
            </div>

            <div className={styles.roleSection}>
              <label id="role-label">Account type</label>
              <div className={styles.roleList} role="group" aria-labelledby="role-label">
                {ROLES.map((roleOption) => (
                  <button
                    key={roleOption}
                    type="button"
                    aria-pressed={role === roleOption}
                    onClick={() => setRole(roleOption)}
                    className={`${styles.roleButton} ${role === roleOption ? styles.roleButtonActive : ''}`}
                  >
                    {roleOption}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor="login-identity">
                  {role === 'Staff' ? 'Email address or employee ID' : 'Email address'}
                </label>
                <input
                  id="login-identity"
                  type={role === 'Staff' ? 'text' : 'email'}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
                  placeholder={role === 'Staff' ? 'you@wusl.ac.lk or WUSL/EMP/001' : 'you@wusl.ac.lk'}
                  className={styles.input}
                  autoComplete="username"
                />
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="login-password">Password</label>
                  <Link href="/forgot-password">Forgot password?</Link>
                </div>
                <div className={styles.passwordWrap}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
                    placeholder="••••••••"
                    className={styles.input}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.passwordToggle}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.301 8.844 6.88 6 12 6s8.699 2.844 9.964 5.678a.42.42 0 0 1 0 .339C20.699 15.156 17.12 18 12 18S3.301 15.156 2.036 12.322Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <div className={styles.error} role="alert">
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M12 8v5M12 16.5v.1" />
                    <path d="M10.3 4.7 3.1 17.2A2 2 0 0 0 4.8 20h14.4a2 2 0 0 0 1.7-2.8L13.7 4.7a2 2 0 0 0-3.4 0Z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button onClick={handleLogin} disabled={loading} className={styles.signInButton}>
                {loading ? (
                  <span className={styles.loadingLabel}>
                    <svg className={styles.spinner} aria-hidden="true" viewBox="0 0 24 24">
                      <circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path opacity=".75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>

              <div className={styles.divider} role="separator"><span>or</span></div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className={styles.googleButton}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-1.99 3.02v2.54h3.23c1.89-1.74 2.98-4.31 2.98-7.41Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.23-2.54c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.08v2.62A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.41 13.89A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.89V7.49H3.08A10 10 0 0 0 2 12c0 1.61.38 3.14 1.08 4.51l3.33-2.62Z" />
                  <path fill="#EA4335" d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.92 5.49l3.33 2.62C7.2 7.75 9.4 5.99 12 5.99Z" />
                </svg>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </button>
            </div>

            <div className={styles.support}>
              <span>Having trouble signing in?</span>
              <span>Contact the Medical Center administration.</span>
            </div>
          </div>
        </div>

        <p className={styles.copyright}>© 2026 Wayamba University of Sri Lanka</p>
      </section>
    </main>
  )
}
