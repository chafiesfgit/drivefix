import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration, useNavigate } from 'react-router-dom'
import { s1 } from '@/api'
import { NOT_APPROVED_EVENT } from '@/api/http'
import { Spinner, useToast } from '@/design/ui'
import { onLanguageChange } from '@/i18n'
import { authStore } from '@/lib/auth'
import { setGlobalErrorToast } from '@/lib/toastBridge'

function PageFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-navy-600">
      <Spinner label={t('common.loading')} />
    </div>
  )
}

/** App-wide listeners that need the router + toast: logout reasons, language sync with S1. */
function AppEvents() {
  const toast = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    setGlobalErrorToast(toast.error)
  }, [toast])

  useEffect(
    () =>
      authStore.onLogout((reason) => {
        qc.clear()
        if (reason === 'expired') toast.error(t('auth.sessionExpired'))
        if (reason === 'suspended') toast.error(t('errors.ACCOUNT_SUSPENDED'))
        if (reason !== 'manual') navigate('/login', { replace: true })
      }),
    [navigate, qc, t, toast],
  )

  useEffect(
    () =>
      onLanguageChange((lng) => {
        if (!authStore.getState().token) return
        s1.updateMe({ language: lng })
          .then((u) => authStore.setUser(u))
          .catch(() => {
            /* preference only: ignore */
          })
      }),
    [],
  )

  // Any service answering 403 NOT_APPROVED: the account is waiting for approval.
  useEffect(() => {
    const go = () => {
      if (window.location.pathname !== '/pending') navigate('/pending', { replace: true })
    }
    window.addEventListener(NOT_APPROVED_EVENT, go)
    return () => window.removeEventListener(NOT_APPROVED_EVENT, go)
  }, [navigate])

  // Offline / online feedback
  useEffect(() => {
    const off = () => toast.error(t('states.offlineTitle'), t('states.offlineBody'))
    const on = () => toast.success(t('states.backOnline'))
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [t, toast])

  return null
}

export function RootLayout() {
  return (
    <>
      <AppEvents />
      <ScrollRestoration />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
