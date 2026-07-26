'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type Student = {
  student_id: number
  user_id: string | null
  full_name: string
  index_no: string
  faculty: string | null
  academic_year: number | null
  dob: string | null
  gender: string | null
  contact_no: string | null
}

async function loadStudent() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return data as Student | null
}

export function useStudent() {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = async () => {
    const data = await loadStudent()
    setStudent(data)
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    void loadStudent().then(data => {
      if (!active) return
      setStudent(data)
      setLoading(false)
    })

    return () => { active = false }
  }, [])

  return { student, loading, supabase, refetch }
}
