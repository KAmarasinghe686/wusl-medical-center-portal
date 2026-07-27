'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import { fetchPortalUserCounts } from '../../lib/users/counts'

const supabase = createBrowserSupabaseClient()

type Visit = { visit_id: number; visit_date: string; reason: string; doctors: { full_name: string } | null }

export default function WorkerDashboard() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState({ thisMonth: 0, totalDoctors: 0, doctorsAvailable: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
      const { data: { session } } = await supabase.auth.getSession()
      const [recentResult, monthResult, userCounts, doctorsResult] = await Promise.all([
        supabase.from('medical_visits')
          .select('visit_id, visit_date, reason, doctors(full_name)')
          .eq('user_id', user.id).order('visit_date', { ascending: false }).limit(5),
        supabase.from('medical_visits').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('visit_date', monthStart).lt('visit_date', nextMonth),
        fetchPortalUserCounts(session?.access_token),
        supabase.from('doctors')
          .select('doctor_id, doctor_availability!inner(is_available)')
          .eq('doctor_availability.is_available', true),
      ])
      const visitsData = recentResult.data
      const normalizedVisits: Visit[] = (visitsData || []).map(visit => ({
        ...visit,
        doctors: Array.isArray(visit.doctors) ? visit.doctors[0] || null : visit.doctors,
      }))
      setVisits(normalizedVisits)
      const availableDoctorIds = new Set((doctorsResult.data || []).map(doctor => doctor.doctor_id))
      setStats({
        thisMonth: monthResult.count || 0,
        totalDoctors: userCounts.doctors,
        doctorsAvailable: availableDoctorIds.size,
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Welcome back</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Visits This Month', value: stats.thisMonth, border: 'border-l-blue-400' },
          { label: 'Registered Doctors', value: stats.totalDoctors, border: 'border-l-violet-400' },
          { label: 'Doctors Offering Slots', value: stats.doctorsAvailable, border: 'border-l-emerald-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-r-xl p-4 flex flex-col gap-1`}>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Visits</h2>
          <Link href="/worker/visits" className="text-xs text-blue-800 hover:text-blue-600 font-medium">View All →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-xs text-gray-400">No visits found.</td></tr>
              ) : visits.map(v => (
                <tr key={v.visit_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-5 text-xs text-gray-700">{v.visit_date}</td>
                  <td className="py-3 px-5 text-xs font-medium text-gray-800">{v.doctors?.full_name || '-'}</td>
                  <td className="py-3 px-5 text-xs text-gray-500">{v.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
