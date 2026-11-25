// One HTTP call with timeout; never throws (network problems come back as { networkError }).
export async function call(fetchImpl, base, { method = 'GET', path = '', query, token, headers = {}, body, timeoutMs = 8000 } = {}) {
  const url = new URL(base.replace(/\/+$/, '') + path)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  const h = { Accept: 'application/json', ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const started = Date.now()
  try {
    const res = await fetchImpl(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal })
    const text = await res.text()
    let json
    try {
      json = text ? JSON.parse(text) : undefined
    } catch {
      json = undefined
    }
    const hdrs = {}
    res.headers.forEach((v, k) => (hdrs[k.toLowerCase()] = v))
    return { status: res.status, headers: hdrs, json, text, ms: Date.now() - started, url: url.toString() }
  } catch (e) {
    const msg = e?.name === 'AbortError' ? `no answer after ${timeoutMs / 1000} s` : e?.cause?.code || e?.message || String(e)
    return { status: 0, headers: {}, json: undefined, text: '', ms: Date.now() - started, url: url.toString(), networkError: msg }
  } finally {
    clearTimeout(timer)
  }
}
