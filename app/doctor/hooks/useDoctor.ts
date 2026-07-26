'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

export type Doctor = {
  doctor_id: number
  user_id: string
  full_name: string
  specialisation: string | null
}

export function useDoctor() {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    const fetchDoctor = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active) return
      if (userError || !user) {
        setDoctor(null)
        setError('Your session has expired. Please sign in again.')
        setLoading(false)
        return
      }

      const { data, error: doctorError } = await supabase
        .from('doctors')
        .select('doctor_id, user_id, full_name, specialisation')
        .eq('user_id', user.id)
        .single()

      if (!active) return
      if (doctorError || !data) {
        setDoctor(null)
        setError(doctorError?.message || 'Doctor profile not found.')
        setLoading(false)
        return
      }

      setDoctor(data)
      setError('')
      setLoading(false)
    }

    void fetchDoctor()
    return () => { active = false }
  }, [refreshKey])

  const refetch = () => {
    setLoading(true)
    setRefreshKey(current => current + 1)
  }

  return { doctor, loading, error, supabase, refetch }
}
