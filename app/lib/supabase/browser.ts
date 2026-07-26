import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createBrowserSupabaseClient() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing public Supabase environment variables.')
    browserClient = createBrowserClient<Database>(url, key)
  }
  return browserClient
}
