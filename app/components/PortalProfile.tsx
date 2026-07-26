'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type PortalRole = 'admin' | 'doctor' | 'worker'

type ProfileRecord = {
  id: string
  full_name: string | null
  role: string
  employee_index: string | null
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
}

const profileDescriptions: Record<PortalRole, string> = {
  admin: 'Manage your administrator identity.',
  doctor: 'Manage your professional and clinical identity.',
  worker: 'Manage your university staff identity.',
}

export default function PortalProfile({ role }: { role: PortalRole }) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [doctor, setDoctor] = useState<DoctorRecord | null>(null)
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [fullName, setFullName] = useState('')
  const [employeeIndex, setEmployeeIndex] = useState('')
  const [specialisation, setSpecialisation] = useState('')
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
      const canUseStaffProfile = role === 'worker' && profileData?.role === 'admin' && Boolean(profileData.employee_index)
      if (profileError || !profileData || (profileData.role !== role && !canUseStaffProfile)) {
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
      const name = doctorData?.full_name || profileData.full_name || ''
      setProfile(profileData)
      setDoctor(doctorData)
      setEmail(user.email || '')
      setAvatarUrl(user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url || '')
      setFullName(name)
      setEmployeeIndex(profileData.employee_index || '')
      setSpecialisation(doctorData?.specialisation || '')
      setLoading(false)
    }

    void loadProfile()
    return () => { active = false }
  }, [role])

  const handleToggleEditing = () => {
    setMessage('')
    setError('')
    if (editing) {
      setFullName(doctor?.full_name || profile?.full_name || '')
      setEmployeeIndex(profile?.employee_index || '')
      setSpecialisation(doctor?.specialisation || '')
    }
    setEditing(current => !current)
  }

  const handleSave = async () => {
    if (!profile) return

    const nextName = fullName.trim()
    if (!nextName) {
      setError('Full name is required.')
      return
    }
    if (role === 'admin' && !employeeIndex.trim()) {
      setError('Employee ID is required to access the Staff portal.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    if (role === 'doctor') {
      const { error: doctorError } = await supabase
        .from('doctors')
        .update({ full_name: nextName, specialisation: specialisation.trim() || null })
        .eq('user_id', profile.id)

      if (doctorError) {
        setError(doctorError.message)
        setSaving(false)
        return
      }
    }

    const profileUpdate = role === 'admin'
      ? { full_name: nextName, employee_index: employeeIndex.trim() }
      : { full_name: nextName }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', profile.id)

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    setProfile(current => current ? {
      ...current,
      full_name: nextName,
      employee_index: role === 'admin' ? employeeIndex.trim() : current.employee_index,
    } : current)
    setDoctor(current => current ? { ...current, full_name: nextName, specialisation: specialisation.trim() || null } : current)
    setFullName(nextName)
    setSaving(false)
    setEditing(false)
    setMessage('Profile saved successfully.')
    window.dispatchEvent(new CustomEvent('profile-name-updated', { detail: nextName }))
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
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {message && <div className="mb-4 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">{message}</div>}
      {error && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="max-w-5xl">
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

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${role === 'doctor' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
              {editing ? (
                <input value={fullName} onChange={event => setFullName(event.target.value)} className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800" />
              ) : (
                <div className="text-sm font-medium text-gray-800">{displayName}</div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</span>
              <div className="text-sm font-medium text-gray-800 break-all">{email || 'N/A'}</div>
            </div>

            {role === 'admin' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee ID</label>
                {editing ? (
                  <input value={employeeIndex} onChange={event => setEmployeeIndex(event.target.value)} placeholder="e.g. WUSL/EMP/001" className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800" />
                ) : (
                  <div className="text-sm font-medium text-gray-800">{profile.employee_index || 'Not assigned'}</div>
                )}
              </div>
            )}

            {role === 'worker' && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee ID</span>
                <div className="text-sm font-medium text-gray-800">{profile.employee_index || 'Not assigned'}</div>
              </div>
            )}

            {role === 'doctor' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Specialisation</label>
                {editing ? (
                  <input value={specialisation} onChange={event => setSpecialisation(event.target.value)} className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800" />
                ) : (
                  <div className="text-sm font-medium text-gray-800">{doctor?.specialisation || 'N/A'}</div>
                )}
              </div>
            )}

            {doctor && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Doctor ID</span>
                <div className="text-sm font-medium text-gray-800">{doctor.doctor_id}</div>
              </div>
            )}
          </div>

          {editing && (
            <button onClick={handleSave} disabled={saving} className="mt-6 bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
