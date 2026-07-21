import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useMarkAllNotificationsRead, useNotifications, useSubscription } from '@/api/hooks';
import { Badge } from '../ui';
import { formatDateTime } from '@/lib/format';

const farmerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/farms', label: 'Farms', icon: '🌾' },
  { to: '/reports', label: 'Reports', icon: '📄' },
  { to: '/billing', label: 'Billing', icon: '💳' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

const adminNav = [
  { to: '/admin', label: 'Overview', icon: '📈' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/farms', label: 'Farms', icon: '🌾' },
  { to: '/admin/payments', label: 'Payments', icon: '💳' },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: '📋' },
  { to: '/admin/plans', label: 'Plans', icon: '🏷️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

function TrialBanner() {
  const { data: sub } = useSubscription();
  if (!sub) return null;
  if (sub.status === 'TRIAL' && sub.daysRemaining != null && sub.daysRemaining <= 5) {
    return (
      <div className="bg-yellow-500/90 px-4 py-2 text-center text-sm font-medium text-yellow-950">
        Your free trial ends in {sub.daysRemaining} day{sub.daysRemaining === 1 ? '' : 's'}.{' '}
        <NavLink to="/billing" className="underline">
          Upgrade now
        </NavLink>{' '}
        to keep running analyses.
      </div>
    );
  }
  if (sub.status === 'EXPIRED') {
    return (
      <div className="bg-red-600/90 px-4 py-2 text-center text-sm font-medium text-white">
        Your subscription has expired — existing data stays viewable, new analyses are disabled.{' '}
        <NavLink to="/billing" className="underline">
          Choose a plan
        </NavLink>
      </div>
    );
  }
  return null;
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="card absolute right-0 z-50 mt-2 w-80 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => markAll.mutate()}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet</p>
              ) : (
                notifications.slice(0, 15).map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-slate-100 px-4 py-3 text-sm dark:border-slate-800 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const nav = isAdmin ? [...farmerNav.slice(0, 1), ...adminNav] : farmerNav;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <span className="text-2xl">🛰️</span>
          <div>
            <div className="text-base font-bold text-brand-700 dark:text-brand-400">GeoAgri AI</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Smart Farming from Space
            </div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <NotificationsMenu />
            <div className="mx-2 hidden text-right sm:block">
              <div className="text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-slate-500">
                {isAdmin ? <Badge color="blue">Admin</Badge> : user?.email}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="btn-secondary text-xs"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
