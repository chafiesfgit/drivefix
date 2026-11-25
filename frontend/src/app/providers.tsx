import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { isApiError } from '@/api/http'
import { ToastProvider } from '@/design/ui'
import i18n from '@/i18n'
import { errorMessage } from '@/lib/errors'
import { globalErrorToast as toastError } from '@/lib/toastBridge'


function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // Never retry client errors (4xx); retry a network blip once.
        retry: (count, e) => (isApiError(e) && e.status >= 400 && e.status < 500 ? false : count < 1),
      },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({
      onError: (e, query) => {
        if (query.meta?.silent) return
        // Background refetch errors only; first-load errors are shown inline by the page.
        if (query.state.data !== undefined) toastError(errorMessage(i18n.t, e))
      },
    }),
    mutationCache: new MutationCache({
      onError: (e, _v, _c, mutation) => {
        if (mutation.meta?.silent) return
        if (isApiError(e) && e.status === 401) return // handled by the logout toast
        toastError(errorMessage(i18n.t, e))
      },
    }),
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { silent?: boolean }
    mutationMeta: { silent?: boolean }
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient)
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
