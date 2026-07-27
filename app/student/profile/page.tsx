'use client'
import { useState, useEffect, type ChangeEvent } from 'react'
import { useStudent } from '../hooks/useStudent'

export default function StudentProfile() {
  const { student, loading, supabase, refetch } = useStudent()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [formData, setFormData] = useState({ contact_no: '', address: '' })

  useEffect(() => {
    const loadAvatar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const savedAvatar = user?.user_metadata?.profile_avatar_url || user?.user_metadata?.avatar_url
      if (savedAvatar) setAvatarUrl(savedAvatar)
    }
    loadAvatar()
  }, [supabase])

  const handleToggleEditing = () => {
    setSuccess(false)
    setSaveError('')
    if (editing) {
      setEditing(false)
      return
    }
    setFormData({
      contact_no: student?.contact_no || '',
      address: student?.address || '',
    })
    setEditing(true)
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setAvatarError('')
    setAvatarMessage('')

    const acceptedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }

    if (!acceptedTypes[file.type]) {
      setAvatarError('Please select a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Profile photos must be smaller than 2 MB.')
      return
    }

    setUploadingAvatar(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setAvatarError('Your session has expired. Please sign in again.')
      setUploadingAvatar(false)
      return
    }

    const filePath = `${user.id}/${Date.now()}.${acceptedTypes[file.type]}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })

    if (uploadError) {
      setAvatarError(uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: publicFile } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { profile_avatar_url: publicFile.publicUrl, profile_avatar_path: filePath },
    })

    if (metadataError) {
      setAvatarError(metadataError.message)
      setUploadingAvatar(false)
      return
    }

    setAvatarUrl(publicFile.publicUrl)
    setAvatarMessage('Profile photo updated successfully.')
    setUploadingAvatar(false)
    window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: publicFile.publicUrl }))
  }

  const handleSave = async () => {
    if (!student) return
    const contactNo = formData.contact_no.trim()
    const address = formData.address.trim()
    if (contactNo.length > 30) {
      setSaveError('Contact number must be 30 characters or fewer.')
      return
    }
    if (address.length > 500) {
      setSaveError('Address must be 500 characters or fewer.')
      return
    }

    setSaving(true)
    setSuccess(false)
    setSaveError('')
    const { error } = await supabase
      .from('students')
      .update({ contact_no: contactNo || null, address: address || null })
      .eq('student_id', student.student_id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      await refetch()
      setSuccess(true)
      setEditing(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>
  if (!student) return <div className="p-8 text-sm text-gray-400">No profile found.</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
          <p className="text-sm text-gray-500">View your institutional identity and manage contact details.</p>
        </div>
        <button onClick={handleToggleEditing}
          className="border border-blue-800 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors rounded-lg">
          {editing ? 'Cancel' : 'Edit Contact Details'}
        </button>
      </div>

      {success && <div className="mb-4 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">Profile saved successfully.</div>}
      {saveError && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{saveError}</div>}

      <div className="w-full">
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="profile-summary flex flex-col gap-4 mb-6 pb-6 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={`profile-avatar w-20 h-20 text-white flex items-center justify-center text-xl font-bold rounded-full flex-shrink-0 ${avatarUrl ? '' : 'bg-blue-800'}`}
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                role="img"
                aria-label={`${student.full_name || 'Student'} profile photo`}
              >
                {!avatarUrl && (student.full_name?.charAt(0) || 'S')}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-gray-900">{student.full_name}</div>
                <div className="mt-0.5 text-sm text-gray-500">{student.index_no}</div>
              </div>
            </div>
            <div className="profile-photo-control flex flex-col items-start gap-1 sm:items-end">
              <input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="sr-only"
              />
              <label htmlFor="profile-photo" className={`profile-photo-button ${uploadingAvatar ? 'is-disabled' : ''}`}>
                {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Add photo'}
              </label>
              <span className="text-xs text-gray-400">JPG, PNG or WebP &middot; Max 2 MB</span>
            </div>
          </div>
          {avatarMessage && <div className="mb-4 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">{avatarMessage}</div>}
          {avatarError && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{avatarError}</div>}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'Full Name', key: null, value: student.full_name },
              { label: 'Role', key: null, value: 'Student' },
              { label: 'Student ID', key: null, value: student.index_no },
              { label: 'Faculty', key: null, value: student.faculty },
              { label: 'Academic Year', key: null, value: `Year ${student.academic_year}` },
              { label: 'Gender', key: null, value: student.gender },
              { label: 'Date of Birth', key: null, value: student.dob },
              { label: 'Contact Number', key: 'contact_no', type: 'input', value: student.contact_no },
              { label: 'Address', key: 'address', type: 'textarea', value: student.address, wide: true },
            ].map(field => (
              <div key={field.label} className={`flex flex-col gap-1 ${field.wide ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                {editing && field.key ? (
                  field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={formData[field.key as keyof typeof formData]}
                      onChange={e => setFormData({ ...formData, [field.key!]: e.target.value })}
                      className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800"
                    />
                  ) : (
                    <input
                      type="tel"
                      value={formData[field.key as keyof typeof formData]}
                      onChange={e => setFormData({ ...formData, [field.key!]: e.target.value })}
                      className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-800"
                    />
                  )
                ) : (
                  <div className="text-sm font-medium text-gray-800">{field.value || 'N/A'}</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-gray-400">
            Official identity details are managed through authorized university administration workflows.
          </p>
          {editing && (
            <button onClick={handleSave} disabled={saving}
              className="mt-6 bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
