import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { homeFor, type Role } from './roles'

/**
 * Route guard by role. Not logged in -> /login (with return path).
 * Wrong role -> own home. Supplier / mechanic / tow driver not approved yet -> /pending.
 */
export function RequireRole({ roles, children, allowUnapproved = false }: { roles: Role[]; children: ReactNode; allowUnapproved?: boolean }) {
  const { isAuthenticated, role, needsApproval } = useAuth()
  const location = useLocation()
  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!roles.includes(role)) return <Navigate to={homeFor(role)} replace />
  if (needsApproval && !allowUnapproved) return <Navigate to="/pending" replace />
  return <>{children}</>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/** Login / register pages: already logged in -> go home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, role, needsApproval } = useAuth()
  if (isAuthenticated && role) return <Navigate to={needsApproval ? '/pending' : homeFor(role)} replace />
  return <>{children}</>
}
