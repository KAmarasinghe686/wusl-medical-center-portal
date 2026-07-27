'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [checkingInvitation, setCheckingInvitation] = useState(true)
  const [invitationReady, setInvitationReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true

    const verifyInvitation = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const code = searchParams.get('code')
      const authError = hashParams.get('error_description') || searchParams.get('error_description')

      if (authError) {
        if (active) {
          setError(authError.replace(/\+/g, ' '))
          setCheckingInvitation(false)
        }
        return
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          if (active) {
            setError('This invitation link is invalid or expired. Ask an administrator to send a new invitation.')
            setCheckingInvitation(false)
          }
          return
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (active) {
            setError('This invitation link is invalid or expired. Ask an administrator to send a new invitation.')
            setCheckingInvitation(false)
          }
          return
        }
      }

      const { data, error: userError } = await supabase.auth.getUser()
      if (!active) return

      window.history.replaceState({}, '', '/set-password')

      if (userError || !data.user) {
        setError('This invitation link is invalid or expired. Ask an administrator to send a new invitation.')
        setInvitationReady(false)
      } else {
        setInvitationReady(true)
      }
      setCheckingInvitation(false)
    }

    void verifyInvitation()
    return () => {
      active = false
    }
  }, [])

  const handleCreatePassword = async () => {
    if (!invitationReady) {
      setError('A valid invitation is required to create your password.')
      return
    }
    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password.')
      return
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await supabase.auth.signOut()
    setSuccess(true)
    setSaving(false)
    setTimeout(() => router.push('/login'), 1800)
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
            <span className="auth-recovery-eyebrow">Account activation</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Your Password</h1>
            <p className="text-sm text-gray-500">Set a secure password to complete your portal registration.</p>
          </div>

          {checkingInvitation ? (
            <div className="text-sm text-gray-500">Verifying your invitation...</div>
          ) : success ? (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Your password was created successfully. Redirecting to login...
            </div>
          ) : !invitationReady ? (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
              <Link href="/login" className="text-sm text-blue-800 hover:text-blue-600 font-medium text-center">
                Back to Login
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-800 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !saving) void handleCreatePassword()
                  }}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-800 shadow-sm"
                />
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreatePassword}
                disabled={saving}
                className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1f6862, #287b74)' }}
              >
                {saving ? 'Creating Password...' : 'Create Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
