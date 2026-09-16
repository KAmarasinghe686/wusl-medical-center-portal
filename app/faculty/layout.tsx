'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

const overviewLinks = [
  { label: 'Dashboard', href: '/faculty/dashboard' },
  { label: 'Advance Medical Notices', href: '/faculty/advance-notices' },
  { label: 'Student Search', href: '/faculty/search' },
]

const courseworkLinks = [
  { label: 'Attendance Review Queue', href: '/faculty/review?type=general' },
  { label: 'Monthly Batch Documents', href: '/faculty/batch-document' },
]

const examLinks = [
  { label: 'Exam Review Queue', href: '/faculty/review?type=exam' },
  { label: 'Faculty Board Schedules (FB)', href: '/faculty/exam-schedules' },
]

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [facultyName, setFacultyName] = useState('')
  const [facultyAvatar, setFacultyAvatar] = useState('')
  const [subRole, setSubRole] = useState<'full_access' | 'coursework_staff' | 'exam_staff'>('full_access')
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
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile?.role !== 'faculty') { router.push('/login'); return }
      if (profile?.full_name) setFacultyName(profile.full_name)
      if (profile?.faculty_sub_role) setSubRole(profile.faculty_sub_role as 'full_access' | 'coursework_staff' | 'exam_staff')
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

  const showCoursework = subRole === 'full_access' || subRole === 'coursework_staff'
  const showExam = subRole === 'full_access' || subRole === 'exam_staff'

  const subRoleLabel =
    subRole === 'coursework_staff'
      ? 'Coursework & Attendance'
      : subRole === 'exam_staff'
      ? 'Examination Branch'
      : 'Faculty Services'

  return (
    <div className="portal-shell min-h-screen flex bg-gray-50">
      <style>{`
        .sidebar-bg { background: linear-gradient(160deg, #0a0f1e 0%, #0d1f5c 40%, #1a0a3d 70%, #0a0f1e 100%); }
        .nav-active { background: linear-gradient(90deg, rgba(99,102,241,0.3), rgba(59,130,246,0.15)); color: #a5b4fc; border-left: 3px solid #6366f1; font-weight: 600; }
        .nav-inactive { color: #94a3b8; border-left: 3px solid transparent; }
        .nav-inactive:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; border-left: 3px solid rgba(99,102,241,0.4); }
        .avatar-grad { background: linear-gradient(135deg, #6366f1, #3b82f6); }
      `}</style>

      <aside className={`portal-sidebar sidebar-bg fixed inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="WUSL Logo" width={52} height={52} className="object-contain drop-shadow-lg" />
          <div className="text-sm font-bold text-white text-center">Wayamba University</div>
          <div className="text-xs text-blue-300/60 text-center">Medical Center Portal</div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Overview Links */}
          <div className="flex flex-col gap-0.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Overview</span>
            {overviewLinks.map(link => (
              <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
                className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Coursework & Attendance Desk */}
          {showCoursework && (
            <div className="flex flex-col gap-0.5 pt-2 border-t border-white/10">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-400/70 mb-1">
                Coursework Desk
              </span>
              {courseworkLinks.map(link => (
                <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href.split('?')[0] ? 'nav-active' : 'nav-inactive'}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Examination Absence Desk */}
          {showExam && (
            <div className="flex flex-col gap-0.5 pt-2 border-t border-white/10">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-400/70 mb-1">
                Examination Desk
              </span>
              {examLinks.map(link => (
                <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all ${pathname === link.href.split('?')[0] ? 'nav-active' : 'nav-inactive'}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 lg:hidden bg-black/40" onClick={() => setSidebarOpen(false)} />}

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
              <small>{subRoleLabel}</small>
            </div>
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
                className={`portal-user-avatar w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${facultyAvatar ? 'has-avatar-image' : 'avatar-grad'}`}
                style={facultyAvatar ? ({ '--portal-avatar-image': `url(${facultyAvatar})` } as React.CSSProperties) : undefined}
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
