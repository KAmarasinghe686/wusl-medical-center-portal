'use client'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../../lib/supabase/browser'

const supabase = createBrowserSupabaseClient()

type Notification = { notification_id: number; title: string; message: string; is_read: boolean; created_at: string }

export default function FacultyNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'All' | 'Unread'>('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
      setNotifications(data || [])
      setLoading(false)
    }

    void fetchNotifications()
  }, [])

  const markAsRead = async (id: number) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('notification_id', id)
    if (error) return

    setNotifications(prev =>
      [...prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)]
        .sort((a, b) => {
          if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
    )
    window.dispatchEvent(new Event('notifications-updated'))
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    if (error) return

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    window.dispatchEvent(new Event('notifications-updated'))
  }

  const filtered = notifications.filter(n => filter === 'All' || !n.is_read)
  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-xs text-gray-400 mt-0.5">{unreadCount} unread</p>}
        </div>
        <div className="flex gap-2">
          {(['All', 'Unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${filter === f ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f}
            </button>
          ))}
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-400">No notifications found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(n => (
            <div key={n.notification_id}
              className={`bg-white border rounded-2xl p-4 flex gap-3 items-start shadow-sm transition-all duration-300 ${!n.is_read ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 opacity-60'}`}>
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <div className="flex-1">
                <div className={`text-sm font-semibold mb-1 ${!n.is_read ? 'text-gray-900' : 'text-gray-500'}`}>{n.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{n.message}</div>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString()}
                </div>
              </div>
              {!n.is_read && (
                <button onClick={() => markAsRead(n.notification_id)}
                  className="text-xs border border-gray-200 text-gray-500 rounded-lg px-3 py-1.5 hover:bg-blue-800 hover:text-white hover:border-blue-800 transition-colors flex-shrink-0">
                  Mark as Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
