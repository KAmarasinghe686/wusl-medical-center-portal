'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

const overviewLinks = [
  { label: 'Dashboard', href: '/dean/dashboard' },
  { label: 'Advance Medical Notices', href: '/dean/advance-notices' },
  { label: 'Letters to the Dean', href: '/dean/letters' },
]

const senateLinks = [
  { label: 'FB & Senate Schedules', href: '/dean/schedules' },
  { label: 'Health Records Archive', href: '/dean/records' },
]

const accountLinks = [
  { label: 'Dean Profile', href: '/dean/profile' },
]

export default function DeanLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [deanName, setDeanName] = useState('')
  const [deanAvatar, setDeanAvatar] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const savedAvatar = user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url
      if (savedAvatar) setDeanAvatar(savedAvatar)

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const isDeanUser = profile?.role === 'dean' || user.email === 'dean@wusl.ac.lk' || user.user_metadata?.role === 'dean' || (profile?.role === 'faculty' && user.email?.startsWith('dean'))
      if (!isDeanUser) {
        router.push('/login')
        return
      }
      if (profile?.full_name) setDeanName(profile.full_name)
    }

    void init()
  }, [router])

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

      {/* Sidebar */}
      <aside className={`portal-sidebar sidebar-bg fixed inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="WUSL Logo" width={52} height={52} className="object-contain drop-shadow-lg" />
          <div className="text-sm font-bold text-white text-center">Wayamba University</div>
          <div className="text-xs text-blue-300/60 text-center">Medical Center Portal</div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Overview Links */}
          <div className="flex flex-col gap-0.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Executive Overview</span>
            {overviewLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                data-nav={link.label}
                onClick={() => setSidebarOpen(false)}
                className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Senate & Board Desk */}
          <div className="flex flex-col gap-0.5 pt-2 border-t border-white/10">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-400/70 mb-1">
              Senate & Faculty Board
            </span>
            {senateLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                data-nav={link.label}
                onClick={() => setSidebarOpen(false)}
                className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Account */}
          <div className="flex flex-col gap-0.5 pt-2 border-t border-white/10">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-blue-400/70 mb-1">
              Dean Identity
            </span>
            {accountLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                data-nav={link.label}
                onClick={() => setSidebarOpen(false)}
                className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 lg:hidden bg-black/40" onClick={() => setSidebarOpen(false)} />}

      {/* Main Container */}
      <div className="portal-frame flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="portal-header sticky top-0 z-20 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="portal-header-title">
              <span>Medical Center Portal</span>
              <small>Dean's Office · Faculty of Applied Sciences</small>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`portal-user-avatar w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${deanAvatar ? 'has-avatar-image' : 'avatar-grad'}`}
                style={deanAvatar ? ({ '--portal-avatar-image': `url(${deanAvatar})` } as React.CSSProperties) : undefined}
              >
                {!deanAvatar && (deanName?.charAt(0) || 'D')}
              </div>
              <span className="hidden lg:block text-xs font-medium text-gray-700">{deanName || 'Dean of Faculty'}</span>
            </div>
            <button onClick={handleLogout} className="portal-logout bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Logout
            </button>
          </div>
        </header>

        <main className="portal-content flex-1 bg-gray-50 overflow-x-hidden">{children}</main>

        <footer className="portal-footer py-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
          <div className="portal-footer-contact">
            <span className="portal-footer-name">University Medical Center · Kuliyapitiya</span>
            <a href="tel:+94373158779">037 315 8779</a>
            <a href="mailto:umck@wyb.ac.lk">umck@wyb.ac.lk</a>
            <span className="portal-footer-address">Lionel Jayathilaka Mawatha, Kuliyapitiya 60200</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
