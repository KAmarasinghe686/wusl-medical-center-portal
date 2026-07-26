'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

const navLinks = [
  { label: 'Dashboard', href: '/faculty/dashboard' },
  { label: 'Notifications', href: '/faculty/notifications' },
  { label: 'Approved Records', href: '/faculty/records' },
  { label: 'Student Search', href: '/faculty/search' },
]

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [facultyName, setFacultyName] = useState('')
  const [facultyAvatar, setFacultyAvatar] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let userId: string | null = null

    const refreshCount = async () => {
      if (!userId) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const savedAvatar = user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url
      if (savedAvatar) setFacultyAvatar(savedAvatar)
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile?.role !== 'faculty') { router.push('/login'); return }
      if (profile?.full_name) setFacultyName(profile.full_name)
      userId = user.id
      await refreshCount()
      window.addEventListener('focus', refreshCount)
      window.addEventListener('visibilitychange', refreshCount)
      window.addEventListener('notifications-updated', refreshCount)
    }

    init()

    return () => {
      window.removeEventListener('focus', refreshCount)
      window.removeEventListener('visibilitychange', refreshCount)
      window.removeEventListener('notifications-updated', refreshCount)
    }
  // This initialization intentionally runs once for the authenticated layout session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="portal-shell min-h-screen flex bg-gray-50">
      <style>{`
        .sidebar-bg { background: linear-gradient(160deg, #0a0f1e 0%, #0d1f5c 40%, #1a0a3d 70%, #0a0f1e 100%); }
        .nav-active { background: linear-gradient(90deg, rgba(99,102,241,0.3), rgba(59,130,246,0.15)); color: #a5b4fc; border-left: 3px solid #6366f1; font-weight: 600; }
        .nav-inactive { color: #94a3b8; border-left: 3px solid transparent; }
        .nav-inactive:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; border-left: 3px solid rgba(99,102,241,0.4); }
        .avatar-grad { background: linear-gradient(135deg, #6366f1, #3b82f6); }
      `}</style>

      <aside className={`portal-sidebar sidebar-bg fixed inset-y-0 left-0 z-40 w-56 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="WUSL Logo" width={52} height={52} className="object-contain drop-shadow-lg" />
          <div className="text-sm font-bold text-white text-center">WUSL Medical</div>
          <div className="text-xs text-blue-300/60 text-center">Institutional Portal</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
              className={`px-3 py-2.5 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 lg:hidden bg-black/40" onClick={() => setSidebarOpen(false)} />}

      <div className="portal-frame flex-1 lg:ml-56 flex flex-col min-h-screen">
        <header className="portal-header sticky top-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-bold text-gray-800 text-sm">Medical Center Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/faculty/notifications" className="relative text-gray-400 hover:text-blue-800 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-800 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <div
                className={`portal-user-avatar w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${facultyAvatar ? '' : 'avatar-grad'}`}
                style={facultyAvatar ? { backgroundImage: `url(${facultyAvatar})` } : undefined}
              >
                {!facultyAvatar && (facultyName?.charAt(0) || 'F')}
              </div>
              <span className="hidden lg:block text-xs font-medium text-gray-700">{facultyName || 'Faculty'}</span>
            </div>
            <button onClick={handleLogout} className="portal-logout bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Logout
            </button>
          </div>
        </header>
        <main className="portal-content flex-1 bg-gray-50 overflow-x-hidden">{children}</main>
        <footer className="portal-footer py-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
          2026 Medical Center Portal - Wayamba University of Sri Lanka. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
