'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type PortalRole = 'admin' | 'doctor' | 'worker' | 'faculty' | 'dean'

type ProfileRecord = {
  id: string
  full_name: string | null
  role: string
  employee_index: string | null
  contact_no: string | null
}

type DoctorRecord = {
  doctor_id: number
  full_name: string | null
  specialisation: string | null
}

const roleLabels: Record<PortalRole, string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  worker: 'Staff',
  faculty: 'Faculty',
  dean: 'Dean',
}

const profileDescriptions: Record<PortalRole, string> = {
  admin: 'View your administrator identity and manage your contact number.',
  doctor: 'View your professional identity and manage your professional contact number.',
  worker: 'View your university staff identity and manage your contact number.',
  faculty: 'View your faculty identity and manage your official contact number.',
  dean: 'View your Dean of Faculty identity and manage your official contact number.',
}

export default function PortalProfile({ role }: { role: PortalRole }) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [doctor, setDoctor] = useState<DoctorRecord | null>(null)
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [contactNo, setContactNo] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active) return

      if (userError || !user) {
        setError('Your session has expired. Please sign in again.')
        setLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!active) return
      const isRoleMatch =
        profileData?.role === role ||
        (role === 'dean' && (
          profileData?.role === 'dean' ||
          user.email === 'dean@wusl.ac.lk' ||
          user.user_metadata?.role === 'dean' ||
          (profileData?.role === 'faculty' && user.email?.startsWith('dean'))
        ))

      if (profileError || !profileData || !isRoleMatch) {
        setError('Unable to load this profile.')
        setLoading(false)
        return
      }

      let doctorData: DoctorRecord | null = null
      if (role === 'doctor') {
        const { data } = await supabase
          .from('doctors')
          .select('doctor_id, full_name, specialisation')
          .eq('user_id', user.id)
          .single()
        doctorData = data
      }

      if (!active) return
      setProfile(profileData)
      setDoctor(doctorData)
      setEmail(user.email || '')
      setAvatarUrl(user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url || '')
      setContactNo(profileData.contact_no || '')
      setLoading(false)
    }

    void loadProfile()
    return () => { active = false }
  }, [role])

  const handleToggleEditing = () => {
    setMessage('')
    setError('')
    if (editing) {
      setContactNo(profile?.contact_no || '')
    }
    setEditing(current => !current)
  }

  const handleSave = async () => {
    if (!profile) return

    const nextContactNo = contactNo.trim()
    if (nextContactNo.length > 30) {
      setError('Contact number must be 30 characters or fewer.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ contact_no: nextContactNo || null })
      .eq('id', profile.id)

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    setProfile(current => current ? {
      ...current,
      contact_no: nextContactNo || null,
    } : current)
    setSaving(false)
    setEditing(false)
    setMessage('Contact details saved successfully.')
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setMessage('')
    setError('')

    const acceptedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }

    if (!acceptedTypes[file.type]) {
      setError('Please select a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photos must be smaller than 2 MB.')
      return
    }

    setUploadingAvatar(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setError('Your session has expired. Please sign in again.')
      setUploadingAvatar(false)
      return
    }

    const filePath = `${user.id}/${Date.now()}.${acceptedTypes[file.type]}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: publicFile } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { profile_avatar_url: publicFile.publicUrl, profile_avatar_path: filePath },
    })

    if (metadataError) {
      setError(metadataError.message)
      setUploadingAvatar(false)
      return
    }

    setAvatarUrl(publicFile.publicUrl)
    setMessage('Profile photo updated successfully.')
    setUploadingAvatar(false)
    window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: publicFile.publicUrl }))
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!profile) return <div className="p-8 text-sm text-red-600">{error || 'No profile found.'}</div>

  const displayName = doctor?.full_name || profile.full_name || roleLabels[role]
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
          <p className="text-sm text-gray-500">{profileDescriptions[role]}</p>
        </div>
        <button onClick={handleToggleEditing} className="border border-blue-800 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors rounded-lg">
          {editing ? 'Cancel' : 'Edit Contact Details'}
        </button>
      </div>

      {message && <div className="mb-4 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">{message}</div>}
      {error && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="w-full">
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="profile-summary flex flex-col gap-4 mb-6 pb-6 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={`profile-avatar w-20 h-20 text-white flex items-center justify-center text-xl font-bold rounded-full flex-shrink-0 ${avatarUrl ? '' : 'bg-blue-800'}`}
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                role="img"
                aria-label={`${displayName} profile photo`}
              >
                {!avatarUrl && (displayName.charAt(0) || roleLabels[role].charAt(0))}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-gray-900">{displayName}</div>
                <div className="mt-0.5 text-sm text-gray-500">{roleLabels[role]}</div>
              </div>
            </div>

            <div className="profile-photo-control flex flex-col items-start gap-1 sm:items-end">
              <input
                id={`${role}-profile-photo`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="sr-only"
              />
              <label htmlFor={`${role}-profile-photo`} className={`profile-photo-button ${uploadingAvatar ? 'is-disabled' : ''}`}>
                {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Add photo'}
              </label>
              <span className="text-xs text-gray-400">JPG, PNG or WebP &middot; Max 2 MB</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</span>
              <div className="text-sm font-medium text-gray-800">{displayName}</div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role</span>
              <div className="text-sm font-medium text-gray-800">{roleLabels[role]}</div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee ID</span>
              <div className="text-sm font-medium text-gray-800">{profile.employee_index || 'Not assigned'}</div>
            </div>

            {role === 'doctor' && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Specialisation</span>
                <div className="text-sm font-medium text-gray-800">{doctor?.specialisation || 'N/A'}</div>
              </div>
            )}

            <div className={`flex flex-col gap-1 ${role === 'doctor' ? '' : 'xl:col-span-2'}`}>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</span>
              <div className="text-sm font-medium text-gray-800 break-all">{email || 'N/A'}</div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Number</label>
              {editing ? (
                <input
                  type="tel"
                  value={contactNo}
                  onChange={event => setContactNo(event.target.value)}
                  className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800"
                />
              ) : (
                <div className="text-sm font-medium text-gray-800">{profile.contact_no || 'N/A'}</div>
              )}
            </div>

          </div>

          {editing && (
            <button onClick={handleSave} disabled={saving} className="mt-6 bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <p className="mt-5 text-xs text-gray-400">
            Official identity details are managed through authorized university administration workflows.
          </p>
        </section>
      </div>
    </div>
  )
}
