'use client'
import { useEffect, useState } from 'react'
import { useDoctor } from '../hooks/useDoctor'

type Visit = {
  visit_id: number
  visit_date: string
  reason: string
  notes: string | null
  user_id: string
  patient_name?: string
  patient_index?: string
  status: string
  void_reason: string | null
}

export default function MedicalVisits() {
  const { doctor, loading, supabase } = useDoctor()
  const doctorId = doctor?.doctor_id
  const [visits, setVisits] = useState<Visit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(true)
  const [showLogVisit, setShowLogVisit] = useState(false)
  const [editVisit, setEditVisit] = useState<Visit | null>(null)
  const [voidVisit, setVoidVisit] = useState<Visit | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [form, setForm] = useState({ patientIndex: '', visitDate: '', reason: '', notes: '', patientType: 'Student' })
  const [editForm, setEditForm] = useState({ reason: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!doctorId) return
    let active = true

    const fetchVisits = async () => {
      const { data, error } = await supabase.from('medical_visits').select('*').eq('doctor_id', doctorId).order('visit_date', { ascending: false })
      if (!active) return
      if (error) {
        setActionError(error.message || 'Unable to load visits.')
        setVisitsLoading(false)
        return
      }
      setVisits(data || [])
      setVisitsLoading(false)
    }

    void fetchVisits()
    return () => { active = false }
  }, [doctorId, refreshKey, supabase])

  const handleLogVisit = async () => {
    if (!doctorId) { alert('Your doctor profile is not ready. Please try again.'); return }
    if (!form.visitDate || !form.reason || !form.patientIndex) { setActionError('Please fill in all required fields.'); return }
    setSubmitting(true)
    setActionError('')
    try {
      const response = await fetch('/api/doctor/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to save the visit.')
      setShowLogVisit(false)
      setForm({ patientIndex: '', visitDate: '', reason: '', notes: '', patientType: 'Student' })
      setRefreshKey(current => current + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save the visit.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditVisit = async () => {
    if (!editVisit) return
    setSubmitting(true)
    setActionError('')
    try {
      const response = await fetch('/api/doctor/visits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: editVisit.visit_id, ...editForm }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to update the visit.')
      setEditVisit(null)
      setRefreshKey(current => current + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the visit.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoidVisit = async () => {
    if (!voidVisit) return
    if (voidReason.trim().length < 5) {
      setActionError('Enter a clear void reason of at least 5 characters.')
      return
    }
    setSubmitting(true)
    setActionError('')
    try {
      const response = await fetch('/api/doctor/visits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'void',
          visitId: voidVisit.visit_id,
          voidReason,
        }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to void the visit.')
      setVoidVisit(null)
      setVoidReason('')
      setRefreshKey(current => current + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to void the visit.')
    } finally {
      setSubmitting(false)
    }
  }

  const modalInputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800 bg-gray-50"

  if (loading || visitsLoading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Medical Visits</h1>
          <p className="text-sm text-gray-500">Patient visit history at the Medical Center.</p>
        </div>
        <button onClick={() => setShowLogVisit(true)} className="bg-blue-800 hover:bg-blue-900 text-white text-xs px-4 py-2 font-semibold rounded-lg transition-colors">
          + Log New Visit
        </button>
      </div>
      {actionError && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{actionError}</div>}

      {showLogVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Log New Visit</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Patient Type</label>
                <select value={form.patientType} onChange={e => setForm({ ...form, patientType: e.target.value })} className={modalInputClass + ' bg-white'}>
                  <option>Student</option><option>Employee</option>
                </select>
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{form.patientType === 'Student' ? 'Student Index No *' : 'Employee ID *'}</label>
                <input type="text" value={form.patientIndex} onChange={e => setForm({ ...form, patientIndex: e.target.value })} placeholder={form.patientType === 'Student' ? 'e.g. WU/IT/2021/001' : 'e.g. WUSL/EMP/001'} className={modalInputClass} />
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visit Date *</label>
                <input type="date" value={form.visitDate} onChange={e => setForm({ ...form, visitDate: e.target.value })} className={modalInputClass} />
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason *</label>
                <textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={modalInputClass + ' resize-none'} />
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={modalInputClass + ' resize-none'} />
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={handleLogVisit} disabled={submitting} className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">{submitting ? 'Saving...' : 'Submit'}</button>
                <button onClick={() => setShowLogVisit(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Edit Visit</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</label>
                <textarea rows={3} value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} className={modalInputClass + ' resize-none'} />
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
                <textarea rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className={modalInputClass + ' resize-none'} />
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={handleEditVisit} disabled={submitting} className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
                <button onClick={() => setEditVisit(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {voidVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Void Visit</h2>
            <p className="text-sm text-gray-600 mb-4">
              This preserves the visit in the clinical history and marks it as voided.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 mb-4">
              {voidVisit.patient_name || 'Patient'} · {voidVisit.visit_date} · {voidVisit.reason}
            </div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Void Reason *</label>
            <textarea
              rows={4}
              value={voidReason}
              onChange={event => setVoidReason(event.target.value)}
              maxLength={1000}
              placeholder="Explain why this visit entry must be voided..."
              className={modalInputClass + ' mt-1 resize-none w-full'}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleVoidVisit}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Voiding...' : 'Void Visit'}
              </button>
              <button
                onClick={() => {
                  setVoidVisit(null)
                  setVoidReason('')
                }}
                disabled={submitting}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Index/ID</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-xs text-gray-400">No visits found.</td></tr>
              ) : visits.map(v => (
                <tr key={v.visit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs text-gray-700">{v.visit_date}</td>
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{v.patient_name || '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{v.patient_index || '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{v.reason}</td>
                  <td className="py-3 px-5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      v.status === 'voided'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {v.status === 'voided' ? 'Voided' : 'Completed'}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-xs text-gray-400">
                    {v.status === 'voided' ? `Void reason: ${v.void_reason || 'Not recorded'}` : v.notes || '-'}
                  </td>
                  <td className="py-3 px-5">
                    {v.status === 'voided' ? (
                      <span className="text-xs text-gray-400">History retained</span>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditVisit(v); setEditForm({ reason: v.reason, notes: v.notes || '' }) }}
                          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors">Edit</button>
                        <button onClick={() => { setVoidVisit(v); setVoidReason(''); setActionError('') }}
                          className="text-xs border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Void</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">Showing {visits.length} visits</div>
      </div>
    </div>
  )
}
