# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

DriveFix web frontend (graduation project): one React app for six roles (DRIVER, SUPPLIER, MECHANIC, TOW_DRIVER, DISPATCHER, ADMIN) in Arabic (RTL), French and English.
It lives in `frontend/` of the DriveFix monorepo (see the root `README.md` and `CLAUDE.md`). Neighbouring folders:
- `../contract/` (OpenAPI + seed data, v1.1, see its `CHANGELOG.md`): **source of truth** for every endpoint, field and error code. Contract changes are additive only and go in the CHANGELOG; then run `npm run gen:api`.
- `../tools/contract-check/`: Node CLI teammates run against their service (reads `../contract` directly); `lib/engine.mjs` is also imported by `tests/contract.selftest.ts`.
- `../services/`: backend services. `s1-identity` is ours; the others belong to teammates. **Do not modify a teammate's service.**
- `../docs/INTEGRATION.md`: how teammates connect S2..S6 to this frontend. `../docs/ai-prompts/PROMPTS.md`: the original briefs.

`PROGRESS.md` records status and design decisions; keep it current.

## Commands

The shell is Windows PowerShell; the Bash tool is Git Bash (in Git Bash, `export MSYS_NO_PATHCONV=1` before passing paths like `/design` as arguments).

```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1   # frees ports 4001/5173, opens S1 + Vite in their own windows
npm run dev          # Vite on http://localhost:5173 (strictPort: fails if the port is taken)
npm run build        # tsc -b && vite build
npm run lint         # eslint, --max-warnings 0 (warnings fail)
npm run typecheck    # tsc -b --noEmit
npm run gen:api      # regenerate src/api/types/s1..s6.ts and src/mocks/seed/* from ../contract
node scripts/i18n/merge.mjs   # deep-merge scripts/i18n/*.json catalogues into src/i18n/{en,fr,ar}.json
```

S1 Identity (real backend, Django) runs with `cd ..\services\s1-identity ; .\run.ps1` on :4001. The first time, run `setup.ps1` (needs Python 3.12).
OTP codes are always random (never set `OTP_FIXED_CODE`): real S1 prints them in its window in a `DriveFix OTP ... code 483920` block; the mocked S1 prints them in the browser console and the admin SMS log.

Quality gate: `npm run typecheck`, `npm run lint` (0 warnings), `npm run build`, `npm test` (Vitest unit tests, `src/**/*.test.ts`), `npm run check:errors` (every contract error code translated in en/fr/ar) and `npm run contract:selftest` (the teammates' checker in `../tools/contract-check` run against the MSW mocks in Node; needs `npm install` there). Run one unit test with `npx vitest run src/api/http.test.ts -t "<name>"`. Browser checks use `playwright-core` with the system Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`).
S1 tests: `cd ..\services\s1-identity ; .\.venv\Scripts\python.exe manage.py test`. Contract check of a live service: `cd ..\tools\contract-check ; .\check.ps1 -Service s1 [-Write]`.
Always open the app on **`localhost`**, not `127.0.0.1`: S1's CORS only allows `localhost`.

Demo accounts (seed, password `Password123`):

| Phone | Account |
| --- | --- |
| 0555000001 | admin |
| 0555000002 / 03 | drivers |
| 0555000004 / 05 | suppliers |
| 0555000006 / 07 | mechanics |
| 0555000008 / 09 | tow drivers |
| 0555000010 | dispatcher |
| 0555000011 | supplier pending approval |

## Architecture

**Services and the real/mock switch.** Each backend service S1–S6 (Identity, Parts, Mechanic, Towing, Payment, Notification) has:
- a typed client `src/api/sN.ts`, built on `request()` in `src/api/http.ts`;
- generated contract types in `src/api/types/`;
- an MSW handler set `src/mocks/handlers/sN.ts`.

`src/lib/env.ts` decides per service: `VITE_USE_MOCKS=false` disables every mock, otherwise `VITE_MOCK_SN=true|false` applies (default: S1 real, S2–S6 mocked). `main.tsx` starts MSW only for the mocked services, so real services are never intercepted. Pages always call the same client whichever way it's switched. `src/mocks/handlers/index.ts` (`handlersFor`) is shared by the browser worker and the Node self-test, and the mocks implement the service-to-service routes too (checked with `VITE_SERVICE_KEY` in the self-test).

**Mock backend.**
- `src/mocks/db.ts` is an in-browser database seeded from the contract seed plus extra demo data, persisted in `localStorage` under `df.mockdb`.
- Bump `VERSION` in `db.ts` whenever the seed shape changes, or old browsers keep stale data.
- Mocks must follow the contract (status codes, `error.code`, pagination). Mock-only additions are documented in PROGRESS.md: `payUrl` on SANDBOX orders, and `GET /dispatch/tow-drivers` (fleet).
- Towing (`handlers/s4.ts`) is simulated lazily by `tick()` on each request: sequential 30 s offers, auto-accept when the tow driver isn't polling, a simulated drive, and auto-complete after arrival.

**HTTP errors and tolerance.** `request()` throws `ApiError` (`status`, `code`, `field`, `service`). Network/CORS failures are `NETWORK_ERROR` naming the service (dev builds add a hint); bodies without the JSON error format get a code from the status (`SERVER`, `NOT_FOUND`...). A 401 or `ACCOUNT_SUSPENDED` logs out through `authStore`; `NOT_APPROVED` fires `NOT_APPROVED_EVENT`, which `RootLayout` turns into a redirect to `/pending`. Successful JSON goes through `normalize()` (null = missing, numeric strings in number fields become numbers); paged endpoints use `http.list`, which also accepts a bare array.
TanStack Query's global `QueryCache`/`MutationCache` show error toasts; pass `meta: { silent: true }` to suppress one. `errorMessage(t, e)` maps contract codes to `errors.<CODE>` i18n keys.

**Auth and routing.**
- `src/lib/auth.ts`: the JWT is kept in memory + `localStorage` (`df.token`, `df.user`); `useAuth()` exposes the role and the `approved` claim.
- `src/app/router.tsx`: lazy pages, guards from `src/lib/guards.tsx`. Each role area lives under `/app/<role>`, and every area also gets `notifications` and `profile`.
- Accounts with `approved=false` are sent to `/pending`. Approval lives in the JWT, so an approved user must sign in again.
- Per-role nav is in `src/lib/nav.ts`; home routes and role lists in `src/lib/roles.ts`.

**Code layout.** `src/app` (shell, layouts, providers), `src/design` (UI kit + map), `src/features/<area>` (pages), `src/lib` (cross-cutting helpers), `src/i18n` (catalogues).

**Design system.**
- Tokens are CSS variables in `src/index.css`, exposed in `tailwind.config.ts` as `rgb(var(--x) / <alpha-value>)`, from Figma file `J6bNWf1blz3nIPAi71xixj`.
- Use the UI kit in `src/design/ui` (Button, Field, Modal, DataTable, Toast, etc.) rather than raw markup.
- `/design` is a live storybook plus a health check of all six services.
- Changes to `tailwind.config.ts` (new colour keys etc.) need a dev-server restart before the new classes appear.

## i18n / RTL rules (easy to break)

- Every UI string must exist in **en, fr and ar**. Validation messages in zod schemas are i18n keys (e.g. `validation.required`), translated at render time.
- Arabic plurals need `_zero/_one/_two/_few/_many/_other`. Missing forms silently fall back to English.
- `html[dir=rtl]` switches to the Cairo font and drops letter-spacing.
- Use logical utilities (`ms-`, `start-`, `text-start`) and `flip-rtl` for directional icons.
- Elements moved by GSAP/JS in x/y must use **physical** `left`/`margin`, because transforms don't flip.
- Numbers in RTL text:
  - `formatDZD` joins digit groups with a no-break space (`\u00A0`), so "3 900" doesn't render as "900 3".
  - Wrap other mixed number runs (e.g. "1 / 2") in `<bdi dir="ltr">`.
- Use `formatDZD` / `formatDate` / `formatPhone` / `shortId` from `src/lib/format.ts`. Money is whole dinars.

## Forms

React Hook Form + zod (v4) via `@hookform/resolvers`.
Put required-field rules in the object **shape**, not in `superRefine`: zod skips object-level refinements while any base field is invalid, so errors would surface one round late. Keep `superRefine` for cross-field checks like password match.

## Motion (landing page, `src/features/landing`)

- All GSAP lives in one `useGSAP` in `LandingPage.tsx`, scoped to the page root, inside `gsap.matchMedia()` with `MOTION.ok`/`MOTION.reduce` from `src/lib/gsap.ts`.
- Reduced motion must still show the final state: markup renders the end state, GSAP animates *from* it.
- **Never put an entrance tween and a scroll-scrubbed tween on the same element.** The scrub records the entrance's start value and the element ends up offset. The hero floating cards therefore nest `[data-float]` (parallax) > `[data-float-in]` (entrance) > `[data-float-card]` (idle drift).
- Smooth wheel scrolling is Lenis (`src/lib/smoothScroll.ts`), driven by the GSAP ticker and calling `ScrollTrigger.update`; landing page only. In-page anchors scroll through the Lenis instance with `offset: -88`.
- Service-card illustrations are the Figma SVGs imported with `?raw` and inlined, so CSS in `index.css` (`.svc-art--*`) can animate their parts.
- Animate only `transform`/`opacity`. Gate hover motion behind `(hover: hover) and (pointer: fine)`.
