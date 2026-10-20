import { Suspense, lazy } from 'react'
import App from './App.jsx'

// The admin area is loaded only when visiting /admin, so shoppers never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

export default function Root() {
  const isAdmin = window.location.pathname.toLowerCase().startsWith('/admin')
  return isAdmin
    ? <Suspense fallback={null}><AdminApp /></Suspense>
    : <App />
}
