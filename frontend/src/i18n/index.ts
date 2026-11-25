import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import en from './en.json'
import fr from './fr.json'

export type AppLanguage = 'en' | 'fr' | 'ar'
export const LANGUAGES: AppLanguage[] = ['en', 'fr', 'ar']
const STORAGE_KEY = 'df.lang'

function initialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'en').slice(0, 2)
  return nav === 'ar' || nav === 'fr' ? nav : 'en'
}

/** <html lang/dir> follow the language: Arabic flips the whole layout (logical CSS props). */
function applyDocument(lng: string) {
  if (typeof document === 'undefined') return // Node (tests)
  const el = document.documentElement
  el.lang = lng
  el.dir = lng === 'ar' ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocument(i18n.language)
i18n.on('languageChanged', (lng) => {
  applyDocument(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
})

const languageListeners = new Set<(lng: AppLanguage) => void>()

/** Change language; listeners (e.g. profile sync with S1) are notified. */
export function setLanguage(lng: AppLanguage) {
  if (i18n.language === lng) return
  const run = () => void i18n.changeLanguage(lng)
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (doc.startViewTransition && !reduce) doc.startViewTransition(run)
  else run()
  languageListeners.forEach((l) => l(lng))
}

export function onLanguageChange(listener: (lng: AppLanguage) => void) {
  languageListeners.add(listener)
  return () => {
    languageListeners.delete(listener)
  }
}

export default i18n
