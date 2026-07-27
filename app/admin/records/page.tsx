'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type {
  RecordLifecycleStatus,
  TableRow,
} from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

type StudentSummary = Pick<TableRow<'students'>, 'full_name' | 'index_no'>
type DoctorSummary = Pick<TableRow<'doctors'>, 'full_name'>
type LifecycleRecord = TableRow<'medical_records'> & {
  students: StudentSummary | null
  doctors: DoctorSummary | null
  record_images: TableRow<'record_images'>[]
}

type LifecycleAction = {
  record: LifecycleRecord
  nextStatus: RecordLifecycleStatus
}

type DisposalAction = {
  record: LifecycleRecord
  image: TableRow<'record_images'>
}

async function recordsRequest(init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch('/api/admin/records', { ...init, headers, cache: 'no-store' })
}

function badgeClass(value: string) {
  if (value === 'approved' || value === 'active' || value === 'retained') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (value === 'rejected' || value === 'invalidated' || value === 'disposed') {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (value === 'archived') return 'bg-slate-100 text-slate-700 border-slate-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function RecordLifecyclePage() {
  const [records, setRecords] = useState<LifecycleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null)
  const [disposalAction, setDisposalAction] = useState<DisposalAction | null>(null)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      const response = await recordsRequest()
      const result = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) {
        setError(result.error || 'Unable to load medical-record lifecycle data.')
      } else {
        setRecords(result.records || [])
        setError('')
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [refreshKey])

  const filtered = records.filter(record => {
    const query = search.toLowerCase()
    return !query ||
      String(record.record_id).includes(query) ||
      record.purpose.toLowerCase().includes(query) ||
      record.students?.full_name?.toLowerCase().includes(query) ||
      record.students?.index_no?.toLowerCase().includes(query)
  })

  const resetModal = () => {
    setLifecycleAction(null)
    setDisposalAction(null)
    setReason('')
    setConfirmation('')
    setError('')
  }

  const changeLifecycle = async () => {
    if (!lifecycleAction) return
    if (reason.trim().length < 5) {
      setError('Enter a clear reason of at least 5 characters.')
      return
    }
    setSaving(true)
    setError('')
    const response = await recordsRequest({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change-lifecycle',
        recordId: lifecycleAction.record.record_id,
        newStatus: lifecycleAction.nextStatus,
        reason,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(result.error || 'Unable to update the record lifecycle.')
      return
    }
    resetModal()
    setRefreshKey(current => current + 1)
  }

  const disposeDocument = async () => {
    if (!disposalAction) return
    const requiredConfirmation = `REC-${disposalAction.record.record_id}`
    if (confirmation !== requiredConfirmation) {
      setError(`Type ${requiredConfirmation} exactly to confirm disposal.`)
      return
    }
    if (reason.trim().length < 5) {
      setError('Enter a clear retention-disposal reason of at least 5 characters.')
      return
    }
    setSaving(true)
    setError('')
    const response = await recordsRequest({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dispose-document',
        imageId: disposalAction.image.image_id,
        reason,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(result.error || 'Unable to dispose of the document.')
      return
    }
    resetModal()
    setRefreshKey(current => current + 1)
  }

  const modalInputClass = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none'

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Record Lifecycle</h1>
        <p className="text-sm text-gray-500">
          Archive or invalidate records without deleting clinical history. Document disposal is restricted to archived records.
        </p>
      </div>

      <input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="Search by record, student, index or purpose..."
        className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-800 focus:outline-none"
      />

      {error && !lifecycleAction && !disposalAction && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Record', 'Student', 'Clinical Status', 'Lifecycle', 'Documents', 'Actions'].map(label => (
                  <th key={label} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-400">No records found.</td></tr>
              ) : filtered.map(record => {
                const retainedDocuments = record.record_images.filter(image => image.disposal_status === 'retained')
                const disposedDocuments = record.record_images.filter(image => image.disposal_status === 'disposed')
                return (
                  <tr key={record.record_id} className="border-b border-gray-50 align-top">
                    <td className="px-5 py-4">
                      <div className="text-xs font-semibold text-blue-800">REC-{record.record_id}</div>
                      <div className="mt-1 text-xs text-gray-500">{record.purpose}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-medium text-gray-800">{record.students?.full_name || 'Unknown student'}</div>
                      <div className="mt-1 text-xs text-gray-400">{record.students?.index_no || 'No index'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${badgeClass(record.status)}`}>
                        {record.status}
                      </span>
                      {record.doctors?.full_name && (
                        <div className="mt-2 text-xs text-gray-400">Reviewed by {record.doctors.full_name}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${badgeClass(record.lifecycle_status)}`}>
                        {record.lifecycle_status}
                      </span>
                      {record.lifecycle_reason && (
                        <div className="mt-2 max-w-52 text-xs text-gray-400">{record.lifecycle_reason}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-gray-600">{retainedDocuments.length} retained</div>
                      {disposedDocuments.length > 0 && (
                        <div className="mt-1 text-xs text-red-500">{disposedDocuments.length} disposed</div>
                      )}
                      {record.lifecycle_status === 'archived' && retainedDocuments.map(image => (
                        <button
                          key={image.image_id}
                          onClick={() => {
                            setDisposalAction({ record, image })
                            setReason('')
                            setConfirmation('')
                            setError('')
                          }}
                          className="mt-2 block text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Dispose document {image.image_id}
                        </button>
                      ))}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {record.lifecycle_status === 'active' ? (
                          <>
                            {record.status !== 'pending' && (
                              <button
                                onClick={() => {
                                  setLifecycleAction({ record, nextStatus: 'archived' })
                                  setReason('')
                                  setError('')
                                }}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                Archive
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setLifecycleAction({ record, nextStatus: 'invalidated' })
                                setReason('')
                                setError('')
                              }}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              Invalidate
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setLifecycleAction({ record, nextStatus: 'active' })
                                setReason('')
                                setError('')
                              }}
                              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                            >
                              Restore
                            </button>
                            {record.lifecycle_status === 'invalidated' && (
                              <button
                                onClick={() => {
                                  setLifecycleAction({ record, nextStatus: 'archived' })
                                  setReason('')
                                  setError('')
                                }}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                Archive
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {lifecycleAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
              {lifecycleAction.nextStatus === 'active' ? 'Restore Record' : `${lifecycleAction.nextStatus} Record`}
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              REC-{lifecycleAction.record.record_id} · {lifecycleAction.record.students?.full_name}
            </p>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Reason *</label>
            <textarea
              rows={4}
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={1000}
              className={modalInputClass + ' mt-1 resize-none'}
            />
            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
            <div className="mt-4 flex gap-3">
              <button onClick={changeLifecycle} disabled={saving} className="flex-1 rounded-lg bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50">
                {saving ? 'Saving...' : 'Confirm Change'}
              </button>
              <button onClick={resetModal} disabled={saving} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {disposalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-700">Authorized Document Disposal</h2>
            <p className="mb-4 text-sm text-gray-600">
              This permanently removes the stored file. Its metadata and audit history will remain.
            </p>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Retention/Disposal Reason *</label>
            <textarea
              rows={4}
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={1000}
              className={modalInputClass + ' mt-1 resize-none'}
            />
            <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-gray-500">
              Type REC-{disposalAction.record.record_id} to confirm *
            </label>
            <input
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              className={modalInputClass + ' mt-1'}
            />
            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
            <div className="mt-4 flex gap-3">
              <button onClick={disposeDocument} disabled={saving} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Disposing...' : 'Dispose Permanently'}
              </button>
              <button onClick={resetModal} disabled={saving} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
