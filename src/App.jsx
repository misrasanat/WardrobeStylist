import { Navigate, NavLink, Route, BrowserRouter, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import Wardrobe from './pages/Wardrobe'
import Outfits from './pages/Outfits'
import './App.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="status-line">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function NavBar() {
  const { user, signOut } = useAuth()
  if (!user) return null
  return (
    <nav className="navbar">
      <span className="brand">Wardrobe Stylist</span>
      <div className="nav-links">
        <NavLink to="/" end>
          Wardrobe
        </NavLink>
        <NavLink to="/outfits">Outfits</NavLink>
      </div>
      <button className="link-button" onClick={signOut}>
        Log out
      </button>
    </nav>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Wardrobe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/outfits"
            element={
              <ProtectedRoute>
                <Outfits />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
