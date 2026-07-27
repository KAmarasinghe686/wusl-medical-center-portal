'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="auth-recovery-page min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="auth-recovery-shell w-full max-w-md">
        <div className="auth-recovery-brand">
          <Image src="/logo.png" alt="Wayamba University of Sri Lanka crest" width={52} height={52} />
          <div>
            <strong>Wayamba University of Sri Lanka</strong>
            <span>Medical Center Portal</span>
          </div>
        </div>
        <div className="auth-recovery-card bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          <div className="mb-6">
            <span className="auth-recovery-eyebrow">Account recovery</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot Password</h1>
            <p className="text-sm text-gray-500">
              Enter the email registered to the account you want to recover.
            </p>
          </div>

          {success ? (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                If an account exists for that email, a reset link has been sent.
              </div>
              <Link href="/login" className="text-xs text-blue-800 hover:text-blue-600 font-medium text-center">
                Back to Login
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registered Account Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="you@wusl.ac.lk"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-800 shadow-sm"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  ⚠️ {error}
                </div>
              )}

              <button onClick={handleReset} disabled={loading}
                className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 font-medium text-center">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
