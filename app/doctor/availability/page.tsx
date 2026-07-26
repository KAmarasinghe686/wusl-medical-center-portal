'use client'
import { useEffect, useState } from 'react'
import { useDoctor } from '../hooks/useDoctor'
import type { TableRow } from '../../lib/supabase/database.types'
import { validateAvailability } from '../../lib/validation'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type DayConfig = { available: boolean; startTime: string; endTime: string }
type Schedule = Record<string, DayConfig>

const defaultSchedule = (): Schedule =>
  Object.fromEntries(DAYS.map(d => [d, { available: false, startTime: '09:00', endTime: '17:00' }]))

export default function DoctorAvailabilityPage() {
  const { doctor, loading, supabase } = useDoctor()
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule())
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!doctor) return
    const fetchAvailability = async () => {
      const { data, error: loadError } = await supabase.from('doctor_availability').select('*').eq('doctor_id', doctor.doctor_id)
      if (loadError) {
        setError(loadError.message)
        return
      }
      if (data && data.length > 0) {
        const updated = defaultSchedule()
        ;(data as TableRow<'doctor_availability'>[]).forEach(row => {
          if (updated[row.day_of_week]) {
            updated[row.day_of_week] = {
              available: row.is_available,
              startTime: row.start_time.slice(0, 5),
              endTime: row.end_time.slice(0, 5),
            }
          }
        })
        setSchedule(updated)
      }
    }
    void fetchAvailability()
  }, [doctor, supabase])

  const toggleDay = (day: string) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], available: !prev[day].available } }))
    setSuccess(false)
  }

  const updateTime = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSuccess(false)
  }

  const handleSave = async () => {
    if (!doctor) return
    setSaving(true); setSuccess(false); setError('')
    const entries = DAYS.map(day => ({
      day,
      available: schedule[day].available,
      startTime: schedule[day].startTime,
      endTime: schedule[day].endTime,
    }))
    const validationError = validateAvailability(entries)
    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }
    const { error: saveError } = await supabase.rpc('replace_doctor_availability', { p_schedule: entries })
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    setSaving(false); setSuccess(true)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Availability</h1>
      <p className="text-sm text-gray-500 mb-6">Set your available days and time slots.</p>
      {error && <div className="mb-4 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {DAYS.map(day => (
            <div key={day} className="px-6 py-4 flex items-center gap-6">
              {/* Day + Toggle */}
              <div className="flex items-center gap-3 w-48 flex-shrink-0">
                <span className={`text-sm font-semibold w-24 ${schedule[day].available ? 'text-gray-900' : 'text-gray-400'}`}>{day}</span>
                <button
                  onClick={() => toggleDay(day)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${schedule[day].available ? 'bg-blue-800' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${schedule[day].available ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Time inputs — spread across remaining space */}
              <div className={`flex flex-1 items-center gap-6 transition-opacity ${schedule[day].available ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Start Time</label>
                  <input type="time" value={schedule[day].startTime}
                    onChange={e => updateTime(day, 'startTime', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">End Time</label>
                  <input type="time" value={schedule[day].endTime}
                    onChange={e => updateTime(day, 'endTime', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-800" />
                </div>
              </div>

              {/* Available label */}
              <span className={`text-xs font-medium uppercase tracking-wide w-20 text-right flex-shrink-0 ${schedule[day].available ? 'text-blue-800' : 'text-gray-400'}`}>
                {schedule[day].available ? 'Available' : 'Unavailable'}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-4">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Availability'}
          </button>
          {success && <p className="text-xs text-emerald-600 font-medium">Availability saved successfully.</p>}
        </div>
      </div>
    </div>
  )
}
