type ToastFn = (title: string, description?: string) => void

let current: ToastFn = () => {}

/** Lets non-React code (the query cache) raise an error toast. Registered by <AppEvents/>. */
export function setGlobalErrorToast(fn: ToastFn) {
  current = fn
}

export function globalErrorToast(title: string, description?: string) {
  current(title, description)
}
