/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_S1_URL?: string
  readonly VITE_S2_URL?: string
  readonly VITE_S3_URL?: string
  readonly VITE_S4_URL?: string
  readonly VITE_S5_URL?: string
  readonly VITE_S6_URL?: string
  readonly VITE_USE_MOCKS?: string
  readonly VITE_MOCK_S1?: string
  readonly VITE_MOCK_S2?: string
  readonly VITE_MOCK_S3?: string
  readonly VITE_MOCK_S4?: string
  readonly VITE_MOCK_S5?: string
  readonly VITE_MOCK_S6?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
