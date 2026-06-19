import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CollectionPage } from './pages/CollectionPage'
import { PlayQueuePage } from './pages/PlayQueuePage'
import { BuyListPage } from './pages/BuyListPage'
import { SettingsPage } from './pages/SettingsPage'
import { FriendsPage } from './pages/FriendsPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Chargement…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="a-jouer" element={<PlayQueuePage />} />
        <Route path="a-acheter" element={<BuyListPage />} />
        <Route path="amis" element={<FriendsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
