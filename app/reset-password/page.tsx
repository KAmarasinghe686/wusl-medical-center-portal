'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true

    const verifyRecoverySession = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (active) {
            setError('This password reset link is invalid or expired. Please request a new one.')
            setCheckingSession(false)
          }
          return
        }
        window.history.replaceState({}, '', '/reset-password')
      }

      const { data, error: sessionError } = await supabase.auth.getUser()
      if (!active) return
      if (sessionError || !data.user) {
        setError('This password reset link is invalid or expired. Please request a new one.')
        setSessionReady(false)
      } else {
        setSessionReady(true)
      }
      setCheckingSession(false)
    }

    void verifyRecoverySession()
    return () => { active = false }
  }, [])

  const handleReset = async () => {
    if (!sessionReady) {
      setError('A valid password reset session is required.')
      return
    }
    if (!password || !confirm) { setError('Please fill in all fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
            <p className="text-sm text-gray-500">Enter your new password below.</p>
          </div>

          {checkingSession ? (
            <div className="text-sm text-gray-500">Verifying your reset link...</div>
          ) : success ? (
            <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Password updated successfully! Redirecting to login...
            </div>
          ) : !sessionReady ? (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
              <Link href="/forgot-password" className="text-sm text-blue-800 hover:text-blue-600 font-medium text-center">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-800 shadow-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-800 shadow-sm" />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  ⚠️ {error}
                </div>
              )}

              <button onClick={handleReset} disabled={loading}
                className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
