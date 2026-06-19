import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home,
  Library,
  ListOrdered,
  ShoppingCart,
  Settings,
  Users,
  LogOut,
  MoreHorizontal,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFriendships } from '../hooks/useFriendships'
import { appVersionLabel } from '../lib/version'

const mainNavItems = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/collection', icon: Library, label: 'Collection' },
  { to: '/a-jouer', icon: ListOrdered, label: 'À jouer' },
  { to: '/a-acheter', icon: ShoppingCart, label: 'À acheter' },
]

const moreNavItems = [
  { to: '/amis', icon: Users, label: 'Amis' },
  { to: '/parametres', icon: Settings, label: 'Profil' },
]

const navLinkClass = (isActive: boolean) =>
  `flex flex-col items-center gap-0.5 px-2 py-3 text-xs md:flex-row md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
    isActive
      ? 'text-indigo-400 md:bg-indigo-500/20'
      : 'text-slate-400 hover:text-slate-200'
  }`

export function Layout() {
  const { signOut } = useAuth()
  const { incomingPending } = useFriendships()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreRoute = moreNavItems.some(({ to }) =>
    to === '/amis'
      ? location.pathname.startsWith('/amis')
      : location.pathname.startsWith(to)
  )

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const pendingCount = incomingPending.length

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0 md:pl-56">
      <aside className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur md:bottom-auto md:top-0 md:flex md:h-full md:w-56 md:flex-col md:border-r md:border-t-0">
        <div className="hidden md:block border-b border-slate-800 px-3 py-3">
          <h1 className="text-base font-bold text-indigo-400">Game Manager</h1>
          <p className="mt-1 text-[10px] leading-tight text-slate-500">
            {appVersionLabel()}
          </p>
        </div>
        <nav className="flex justify-around md:flex-col md:justify-start md:gap-0.5 md:p-2">
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="hidden md:contents">
            {moreNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <span className="relative">
                  <Icon className="h-5 w-5 shrink-0" />
                  {to === '/amis' && pendingCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex flex-col items-center gap-0.5 px-2 py-3 text-xs text-slate-400 hover:text-red-400 md:flex-row md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm md:hover:bg-slate-800/50"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Déconnexion</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={`relative flex flex-col items-center gap-0.5 px-2 py-3 text-xs md:hidden ${
              isMoreRoute || moreOpen
                ? 'text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span>Plus</span>
            {pendingCount > 0 && (
              <span className="absolute right-1 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer le menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="menu"
            className="absolute bottom-16 left-3 right-3 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl"
          >
            {moreNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                role="menuitem"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {to === '/amis' && pendingCount > 0 && (
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false)
                void signOut()
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 hover:text-red-400"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Déconnexion
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
