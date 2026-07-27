'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

const PER_PAGE = 10
const EDIT_ROLES = ['student', 'doctor', 'worker', 'faculty', 'admin']

type ManagedUser = {
  id: string
  email: string
  full_name: string | null
  role: string
  employee_index: string | null
  is_active: boolean
  status_reason: string | null
  status_changed_at: string | null
  created_at: string
}

async function adminRequest(init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)

  return fetch('/api/admin/users', { ...init, headers, cache: 'no-store' })
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700 border border-blue-200',
    doctor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    worker: 'bg-amber-50 text-amber-700 border border-amber-200',
    faculty: 'bg-violet-50 text-violet-700 border border-violet-200',
    admin: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[role] || 'bg-gray-100 text-gray-700'}`}>{role === 'worker' ? 'staff' : role}</span>
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 font-semibold rounded-full ${active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export default function ManageUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editUser, setEditUser] = useState<ManagedUser | null>(null)
  const [statusUser, setStatusUser] = useState<ManagedUser | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [form, setForm] = useState({ email: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [addForm, setAddForm] = useState({
    email: '',
    full_name: '',
    role: 'student',
    identifier: '',
    specialisation: '',
  })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => {
    let active = true

    const fetchUsers = async () => {
      try {
        const response = await adminRequest()
        const result = await response.json()
        if (!active) return

        if (!response.ok) {
          setLoadError(result.error || `Unable to load users (${response.status}).`)
          setLoading(false)
          return
        }

        setUsers(result.users || [])
        setLoadError('')
        setLoading(false)
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Unable to load users.')
        setLoading(false)
      }
    }

    void fetchUsers()
    return () => { active = false }
  }, [refreshKey])

  const handleStatusChange = async () => {
    if (!statusUser) return
    if (statusReason.trim().length < 5) {
      setStatusError('Enter a clear reason of at least 5 characters.')
      return
    }
    setStatusSaving(true)
    setStatusError('')
    try {
      const response = await adminRequest({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: statusUser.id,
          action: 'toggle-active',
          is_active: !statusUser.is_active,
          reason: statusReason,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setStatusError(result.error || 'Unable to update this account.')
        return
      }
      setStatusUser(null)
      setStatusReason('')
      setRefreshKey(current => current + 1)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Unable to update this account.')
    } finally {
      setStatusSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setEditError('')
    try {
      if (!editUser) return

      const response = await adminRequest({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, action: 'update-email', email: form.email }),
      })
      const result = await response.json()
      if (!response.ok) {
        setEditError(result.error || 'Unable to save this user.')
        return
      }
      setEditUser(null)
      setRefreshKey(current => current + 1)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to save this user.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddUser = async () => {
    if (!addForm.email || !addForm.full_name || !addForm.identifier) {
      setAddError('Please fill in all required fields.')
      return
    }
    setAdding(true)
    setAddError('')
    setAddSuccess('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: addForm.email,
        full_name: addForm.full_name,
        role: addForm.role,
        student_index: addForm.role === 'student' ? addForm.identifier : undefined,
        employee_index: addForm.role === 'student' ? undefined : addForm.identifier,
        specialisation: addForm.role === 'doctor' ? addForm.specialisation : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setAddError(data.error || 'Failed to invite user.')
      setAdding(false)
      return
    }

    setAddSuccess('Invitation sent successfully!')
    setAdding(false)
    setAddForm({ email: '', full_name: '', role: 'student', identifier: '', specialisation: '' })
    setTimeout(() => { setShowAddModal(false); setAddSuccess(''); setRefreshKey(current => current + 1) }, 1500)
  }

  const filtered = users.filter(u =>
    (roleFilter === 'All' || u.role === roleFilter) &&
    (
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.employee_index?.toLowerCase().includes(search.toLowerCase())
    )
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const modalInputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-gray-50 w-full"

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Manage Users</h1>
          <p className="text-sm text-gray-500">Administrative control over all portal users.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users/import"
            className="border border-blue-200 text-blue-800 hover:bg-blue-50 text-xs px-4 py-2 font-semibold rounded-lg transition-colors">
            Batch Import
          </Link>
          <button onClick={() => setShowAddModal(true)}
            className="bg-blue-800 hover:bg-blue-900 text-white text-xs px-4 py-2 font-semibold rounded-lg transition-colors">
            + Add User
          </button>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Invite New User</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Role *</label>
                <select value={addForm.role}
                  onChange={e => setAddForm({ ...addForm, role: e.target.value, identifier: '', specialisation: '' })}
                  className={modalInputClass + ' bg-white'}>
                  {EDIT_ROLES.map(role => (
                    <option key={role} value={role}>{role === 'worker' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                <input value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="Full legal name" className={modalInputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address *</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="Real account email" className={modalInputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {addForm.role === 'student' ? 'Student Index *' : 'Employee Index *'}
                </label>
                <input value={addForm.identifier} onChange={e => setAddForm({ ...addForm, identifier: e.target.value })}
                  inputMode={addForm.role === 'student' ? 'numeric' : undefined}
                  maxLength={addForm.role === 'student' ? 6 : 80}
                  placeholder={addForm.role === 'student' ? 'Six digits: 2x2xxx' : 'e.g. WUSL/EMP/001'}
                  className={modalInputClass} />
              </div>
              {addForm.role === 'doctor' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Specialisation *</label>
                  <input value={addForm.specialisation} onChange={e => setAddForm({ ...addForm, specialisation: e.target.value })}
                    placeholder="e.g. General Medicine" className={modalInputClass} />
                </div>
              )}
              {addError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</div>}
              {addSuccess && <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{addSuccess}</div>}
              <div className="flex gap-3 mt-2">
                <button onClick={handleAddUser} disabled={adding}
                  className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {adding ? 'Sending Invite...' : 'Send Invitation'}
                </button>
                <button onClick={() => {
                  setShowAddModal(false)
                  setAddError('')
                  setAddSuccess('')
                  setAddForm({ email: '', full_name: '', role: 'student', identifier: '', specialisation: '' })
                }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account access modal */}
      {statusUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">
              {statusUser.is_active ? 'Deactivate Account' : 'Reactivate Account'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {statusUser.full_name || statusUser.email}
            </p>
            {!statusUser.is_active && statusUser.status_reason && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Previous reason: {statusUser.status_reason}
              </div>
            )}
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {statusUser.is_active ? 'Deactivation Reason *' : 'Reactivation Reason *'}
            </label>
            <textarea
              rows={4}
              value={statusReason}
              onChange={event => setStatusReason(event.target.value)}
              maxLength={500}
              placeholder="Explain why this access change is authorized..."
              className={modalInputClass + ' mt-1 resize-none'}
            />
            {statusError && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                {statusError}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleStatusChange}
                disabled={statusSaving}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${
                  statusUser.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {statusSaving ? 'Saving...' : statusUser.is_active ? 'Deactivate Account' : 'Reactivate Account'}
              </button>
              <button
                onClick={() => {
                  setStatusUser(null)
                  setStatusReason('')
                  setStatusError('')
                }}
                disabled={statusSaving}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Manage Account Access</h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-600">
                Name, role, and institutional ID are controlled by Student Registry or HR and cannot be changed here.
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  {editUser.full_name || 'Not available'}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Real Login Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className={modalInputClass} />
                <p className="text-[11px] text-amber-600">
                  Must be unique. Changing it updates the Auth login; ask the user to use Forgot Password afterward.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Role</span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <RoleBadge role={editUser.role} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {editUser.role === 'student' ? 'Student Index' : 'Employee Index'}
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  {editUser.employee_index || 'Not assigned'}
                </div>
              </div>
              {editError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
                  {editError}
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Updating...' : 'Update Login Email'}
                </button>
                <button onClick={() => {
                  setEditUser(null)
                  setEditError('')
                }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <input type="text" placeholder="Search by name, email, or employee ID..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-white shadow-sm" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-white shadow-sm lg:w-40">
          <option value="All">All Roles</option>
          <option value="student">Student</option>
          <option value="doctor">Doctor</option>
          <option value="worker">Staff</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loadError && (
        <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {loadError}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No users found.</td></tr>
              ) : paginated.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{u.full_name || 'N/A'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{u.email || 'N/A'}</td>
                  <td className="py-3 px-5"><RoleBadge role={u.role} /></td>
                  <td className="py-3 px-5"><StatusBadge active={u.is_active !== false} /></td>
                  <td className="py-3 px-5">
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setEditUser(u)
                        setEditError('')
                        setForm({
                          email: u.email,
                        })
                      }}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors">
                        Manage Access
                      </button>
                      <button onClick={() => {
                        setStatusUser(u)
                        setStatusReason('')
                        setStatusError('')
                      }}
                        className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${u.is_active !== false ? 'border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'}`}>
                        {u.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Showing {paginated.length} of {filtered.length} users</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="border border-gray-200 rounded px-2 py-1 text-xs disabled:opacity-40 hover:bg-gray-50">&lt;</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`border rounded px-2.5 py-1 text-xs ${page === i + 1 ? 'bg-blue-800 text-white border-blue-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="border border-gray-200 rounded px-2 py-1 text-xs disabled:opacity-40 hover:bg-gray-50">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  )
}
