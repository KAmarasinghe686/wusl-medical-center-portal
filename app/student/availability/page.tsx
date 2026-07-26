'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { TableRow } from '../../lib/supabase/database.types'

const supabase = createBrowserSupabaseClient()

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

type GroupedDoctor = { full_name: string; specialisation: string; slots: { day: string; start: string; end: string }[] }
type AvailabilityWithDoctor = TableRow<'doctor_availability'> & {
  doctors: Pick<TableRow<'doctors'>, 'full_name' | 'specialisation'> | Pick<TableRow<'doctors'>, 'full_name' | 'specialisation'>[] | null
}

export default function DoctorAvailability() {
  const [doctors, setDoctors] = useState<GroupedDoctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAvailability = async () => {
      const { data } = await supabase
        .from('doctor_availability')
        .select('*, doctors(full_name, specialisation)')
        .eq('is_available', true)
      if (data) {
        const grouped: Record<string, GroupedDoctor> = {}
        ;(data as AvailabilityWithDoctor[]).forEach(slot => {
          const doctor = Array.isArray(slot.doctors) ? slot.doctors[0] : slot.doctors
          if (!doctor) return
          const name = doctor.full_name
          if (!grouped[name]) grouped[name] = { full_name: name, specialisation: doctor.specialisation || 'General Practice', slots: [] }
          const alreadyHasDay = grouped[name].slots.some(s => s.day === slot.day_of_week)
          if (!alreadyHasDay) {
            grouped[name].slots.push({ day: slot.day_of_week, start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5) })
          }
        })
        Object.values(grouped).forEach(doc =>
          doc.slots.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
        )
        setDoctors(Object.values(grouped))
      }
      setLoading(false)
    }
    void fetchAvailability()
  }, [])

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(p => p.length > 1 && p !== 'Dr.')
    return parts.slice(0, 2).map(p => p.charAt(0)).join('')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Doctor Availability</h1>
      <p className="text-sm text-gray-500 mb-6">Available doctors and their time slots.</p>
      {doctors.length === 0 ? (
        <div className="text-sm text-gray-400">No availability found.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {doctors.map(doc => (
            <div key={doc.full_name} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-blue-800 text-white flex items-center justify-center text-xs font-bold rounded-full flex-shrink-0">
                  {getInitials(doc.full_name)}
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">{doc.full_name}</div>
                  <div className="text-xs text-gray-400">{doc.specialisation}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {doc.slots.map((slot, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2.5 py-1 rounded-full font-medium text-center">
                    {slot.day} {slot.start} – {slot.end}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
