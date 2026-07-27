'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

const navLinks = [
  { label: 'Dashboard', href: '/doctor/dashboard' },
  { label: 'Review Queue', href: '/doctor/records' },
  { label: 'Medical Visits', href: '/doctor/visits' },
  { label: 'Availability', href: '/doctor/availability' },
  { label: 'Profile', href: '/doctor/profile' },
]

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [doctorName, setDoctorName] = useState('')
  const [doctorAvatar, setDoctorAvatar] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const savedAvatar = user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url
      if (savedAvatar) setDoctorAvatar(savedAvatar)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'doctor') { router.push('/login'); return }
      const { data: doctor } = await supabase.from('doctors').select('full_name').eq('user_id', user.id).single()
      if (doctor?.full_name) setDoctorName(doctor.full_name)
    }
    init()

    const handleAvatarUpdated = (event: Event) => setDoctorAvatar((event as CustomEvent<string>).detail)
    const handleNameUpdated = (event: Event) => setDoctorName((event as CustomEvent<string>).detail)
    window.addEventListener('profile-avatar-updated', handleAvatarUpdated)
    window.addEventListener('profile-name-updated', handleNameUpdated)

    return () => {
      window.removeEventListener('profile-avatar-updated', handleAvatarUpdated)
      window.removeEventListener('profile-name-updated', handleNameUpdated)
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
          <div className="text-sm font-bold text-white text-center">Wayamba University</div>
          <div className="text-xs text-blue-300/60 text-center">Medical Center Portal</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
              className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="portal-sidebar-contact">
          <span>Medical Center</span>
          <a href="tel:+94372284779">037 228 4779</a>
          <a href="mailto:umck@wyb.ac.lk">umck@wyb.ac.lk</a>
        </div>
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
            <div className="portal-header-title">
              <span>Medical Center Portal</span>
              <small>Clinical Services</small>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/doctor/profile" className="flex items-center gap-2">
              <div
                className={`portal-user-avatar w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${doctorAvatar ? 'has-avatar-image' : 'avatar-grad'}`}
                style={doctorAvatar ? ({ '--portal-avatar-image': `url(${doctorAvatar})` } as React.CSSProperties) : undefined}
              >
                {!doctorAvatar && (doctorName?.charAt(0) || 'D')}
              </div>
              <span className="hidden lg:block text-xs font-medium text-gray-700">{doctorName || 'Doctor'}</span>
            </Link>
            <button onClick={handleLogout} className="portal-logout bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Logout
            </button>
          </div>
        </header>
        <main className="portal-content flex-1 bg-gray-50 overflow-x-hidden">{children}</main>
        <footer className="portal-footer py-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
          <div className="portal-footer-contact">
            <span className="portal-footer-name">University Medical Center · Kuliyapitiya</span>
            <a href="tel:+94372284779">037 228 4779</a>
            <a href="mailto:umck@wyb.ac.lk">umck@wyb.ac.lk</a>
            <span className="portal-footer-address">Lionel Jayathilaka Mawatha, Kuliyapitiya 60200</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
