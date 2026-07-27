'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../lib/supabase/browser'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const supabase = createBrowserSupabaseClient()

const navLinks = [
  { label: 'Dashboard', href: '/student/dashboard' },
  { label: 'My Records', href: '/student/recordss' },
  { label: 'My Visits', href: '/student/visits' },
  { label: 'Submit Medical Record', href: '/student/submit' },
  { label: 'Notifications', href: '/student/nortifications' },
  { label: 'Profile', href: '/student/profile' },
  { label: 'Doctor Availability', href: '/student/availability' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [studentAvatar, setStudentAvatar] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [studentProfileState, setStudentProfileState] = useState<'checking' | 'ready' | 'missing'>('checking')
  const [studentEmail, setStudentEmail] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
  let userId: string | null = null

  const refreshCount = async () => {
    if (!userId) return
    const { count: newCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadCount(newCount || 0)
  }

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setStudentEmail(user.email || '')
    const savedAvatar = user.user_metadata?.profile_avatar_url || user.user_metadata?.avatar_url
    if (savedAvatar) setStudentAvatar(savedAvatar)
    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'student') { router.push('/login'); return }
    const { data: student, error: studentError } = await supabase.from('students').select('full_name').eq('user_id', user.id).maybeSingle()
    if (studentError || !student) {
      setStudentName(profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'Student')
      setStudentProfileState('missing')
      return
    }
    setStudentName(student.full_name)
    setStudentProfileState('ready')
    userId = user.id
    await refreshCount()

    // re-count every time user comes back to the tab
    window.addEventListener('focus', refreshCount)
    // re-count every time Next.js navigates (e.g. after marking read)
    window.addEventListener('visibilitychange', refreshCount)
    window.addEventListener('notifications-updated', refreshCount)
  }

  init()

  const handleAvatarUpdated = (event: Event) => {
    setStudentAvatar((event as CustomEvent<string>).detail)
  }
  window.addEventListener('profile-avatar-updated', handleAvatarUpdated)

  return () => {
    window.removeEventListener('focus', refreshCount)
    window.removeEventListener('visibilitychange', refreshCount)
    window.removeEventListener('notifications-updated', refreshCount)
    window.removeEventListener('profile-avatar-updated', handleAvatarUpdated)
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
        .sidebar-bg {
          background: linear-gradient(160deg, #0a0f1e 0%, #0d1f5c 40%, #1a0a3d 70%, #0a0f1e 100%);
        }
        .nav-active {
          background: linear-gradient(90deg, rgba(99,102,241,0.3), rgba(59,130,246,0.15));
          color: #a5b4fc;
          border-left: 3px solid #6366f1;
          font-weight: 600;
        }
        .nav-inactive {
          color: #94a3b8;
          border-left: 3px solid transparent;
        }
        .nav-inactive:hover {
          background: rgba(99,102,241,0.1);
          color: #c7d2fe;
          border-left: 3px solid rgba(99,102,241,0.4);
        }
        .avatar-grad { background: linear-gradient(135deg, #6366f1, #3b82f6); }
        .role-badge { background: linear-gradient(135deg, #6366f1, #3b82f6); }
        .navbar-blue { background: linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); }
        .notif-grad { background: linear-gradient(135deg, #6366f1, #3b82f6); }
      `}</style>

      {/* Sidebar */}
      <aside className={`portal-sidebar sidebar-bg fixed inset-y-0 left-0 z-40 w-56 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="WUSL Logo" width={52} height={52} className="object-contain drop-shadow-lg" />
          <div className="text-sm font-bold text-white text-center">Wayamba University</div>
          <div className="text-xs text-blue-300/60 text-center">Medical Centre Portal</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} data-nav={link.label} onClick={() => setSidebarOpen(false)}
              className={`px-3 py-2.5 text-xs rounded-lg transition-all ${pathname === link.href ? 'nav-active' : 'nav-inactive'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="portal-sidebar-contact">
          <span>Medical Centre</span>
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
              <span>Medical Centre Portal</span>
              <small>Student Services</small>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/student/nortifications" className="relative text-gray-400 hover:text-blue-800 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-800 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link href="/student/profile" className="flex items-center gap-2">
              <div
                className={`portal-user-avatar w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${studentAvatar ? '' : 'bg-blue-800'}`}
                style={studentAvatar ? { backgroundImage: `url(${studentAvatar})` } : undefined}
              >
                {!studentAvatar && (studentName?.charAt(0) || 'S')}
              </div>
              <span className="hidden lg:block text-xs font-medium text-gray-700">{studentName || 'Student'}</span>
            </Link>
            <button onClick={handleLogout} className="portal-logout bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Logout
            </button>
          </div>
        </header>

        <main className="portal-content flex-1 bg-gray-50 overflow-x-hidden">
          {studentProfileState === 'checking' && (
            <div className="p-8 text-sm text-gray-400">Loading your student profile...</div>
          )}
          {studentProfileState === 'missing' && (
            <div className="p-6 lg:p-8">
              <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                </div>
                <h1 className="mb-2 text-xl font-bold text-gray-900">Student profile not linked</h1>
                <p className="mb-5 text-sm leading-6 text-gray-600">
                  Sign-in succeeded, but this portal account is not connected to a student record yet. Medical records cannot be shown until the correct Student ID is linked.
                </p>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Signed-in account</div>
                  <div className="mt-1 break-all text-sm font-medium text-gray-800">{studentEmail || 'Unknown email'}</div>
                </div>
                <p className="mt-5 text-sm text-gray-500">
                  Ask the portal administrator to connect this account to your correct Student ID, then refresh this page.
                </p>
              </div>
            </div>
          )}
          {studentProfileState === 'ready' && children}
        </main>

        <footer className="portal-footer py-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
          <div className="portal-footer-contact">
            <span className="portal-footer-name">University Medical Centre · Kuliyapitiya</span>
            <a href="tel:+94372284779">037 228 4779</a>
            <a href="mailto:umck@wyb.ac.lk">umck@wyb.ac.lk</a>
            <span className="portal-footer-address">Lionel Jayathilaka Mawatha, Kuliyapitiya 60200</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
