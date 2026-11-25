import type { TFunction } from 'i18next'
import { isApiError, type ApiError } from '@/api/http'
import { SERVICE_NAMES } from '@/lib/env'

/** "S3 Mechanic" for the service that failed, or a generic "The service". */
export function serviceLabel(t: TFunction, e: ApiError): string {
  return e.service ? `${e.service.toUpperCase()} ${SERVICE_NAMES[e.service]}` : t('errors.theService')
}

/** Maps every stable error code from the contract to a translated message. */
export function errorMessage(t: TFunction, e: unknown): string {
  if (isApiError(e)) {
    const service = serviceLabel(t, e)
    const translated = t(`errors.${e.code}`, { defaultValue: '', service })
    let msg = translated || (e.status >= 500 ? t('errors.SERVER', { service }) : e.message || t('errors.UNKNOWN'))
    // Developer hint only in `npm run dev`: the usual causes of "unreachable".
    if (import.meta.env.DEV && (e.code === 'NETWORK_ERROR' || e.code === 'TIMEOUT')) msg += ` ${t('errors.devHint')}`
    return msg
  }
  if (e instanceof Error && e.message) return e.message
  return t('errors.UNKNOWN')
}

/** Field-level error from the API, if the error targets that field. */
export function fieldError(t: TFunction, e: unknown, field: string): string | undefined {
  if (isApiError(e) && e.field === field) return errorMessage(t, e)
  return undefined
}
