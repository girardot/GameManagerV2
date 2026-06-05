import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Library,
  ListOrdered,
  ShoppingCart,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/collection', icon: Library, label: 'Collection' },
  { to: '/a-jouer', icon: ListOrdered, label: 'À jouer' },
  { to: '/a-acheter', icon: ShoppingCart, label: 'À acheter' },
  { to: '/parametres', icon: Settings, label: 'Profil' },
]

export function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0 md:pl-56">
      <aside className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur md:bottom-auto md:top-0 md:flex md:h-full md:w-56 md:flex-col md:border-r md:border-t-0">
        <div className="hidden md:block border-b border-slate-800 px-3 py-3">
          <h1 className="text-base font-bold text-indigo-400">Game Manager</h1>
        </div>
        <nav className="flex justify-around md:flex-col md:justify-start md:gap-0.5 md:p-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-3 text-xs md:flex-row md:gap-2 md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${
                  isActive
                    ? 'text-indigo-400 md:bg-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => signOut()}
          className="hidden md:flex items-center gap-2 px-3 py-3 text-sm text-slate-400 hover:text-red-400 border-t border-slate-800 mt-auto"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
