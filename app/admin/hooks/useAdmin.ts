'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'
import type { User } from '@supabase/supabase-js'

const supabase = createBrowserSupabaseClient()

export function useAdmin() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAdmin() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return { user, loading, supabase, refetch: fetchAdmin }
}
