# DriveFix — web frontend

React 18 + Vite + TypeScript (strict) + Tailwind. One web app for the six DriveFix roles
(driver, parts supplier, mechanic, tow driver, dispatcher, admin) in Arabic (RTL), French and English.
The API contract in `../contract/` is the source of truth; types are generated from it.

## Run it (Windows PowerShell)

You need Node 22+ (tested on Node 26) and, for real accounts, the S1 Identity service.

**Quickest way: one command.** From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\frontend\start-demo.ps1
```

It stops any old copy still holding port 4001 or 5173 (the "Port 5173 is already in use" error).
Then it opens two windows: S1 (OTP codes are printed there) and the frontend. Close those windows to stop.

Or start them by hand (each command block starts from the repository root):

**1. Start S1 Identity (real login, OTP, approvals)**, in its own terminal:

```powershell
cd services\s1-identity
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # first time only (needs Python 3.12)
.\run.ps1                                              # http://localhost:4001
```

**2. Start the frontend**, in a second terminal:

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`: S1's CORS allows `localhost`).

If `npm run dev` says **Port 5173 is already in use**, another copy is still running (often in a
window you forgot). Close it, or run `start-demo.ps1`, which stops it for you.

S2–S6 (parts, mechanics, towing, payments, notifications) run on the built-in mock layer by default,
so the whole app works with only S1 running.

## Demo accounts

Every seeded account uses the password **`Password123`**. The login page also lists them.

| Phone | Role | Notes |
| --- | --- | --- |
| 0555000001 | Admin | approvals, users, payments, SMS log, reports |
| 0555000002 | Driver | Karim Benali — parts, mechanics, SOS |
| 0555000003 | Driver | Sara Amrani |
| 0555000004 / 0555000005 | Supplier | approved shops |
| 0555000006 / 0555000007 | Mechanic | approved garages |
| 0555000008 / 0555000009 | Tow driver | |
| 0555000010 | Dispatcher | live board, manual assignment, fleet |
| 0555000011 | Supplier | **pending approval** — shows the waiting screen |

**Where is the OTP?** Every code is random. With real S1 it is printed in the S1 window (PowerShell), in a block:

```
================================================================
 DriveFix OTP   phone 0551234567   code 483920   valid 5 min
================================================================
```

With S1 mocked, the code is printed in the browser console (F12) and in the admin SMS log.

## Teammates and service status

- **`../docs/INTEGRATION.md`**: how a teammate connects their service (S2..S6) to this frontend, what each screen calls, the 10 common mistakes, and the contract checker.
- **`/status`** (link in the footer): which services are Real or Mock, the URL in use, live health every 10 s, "Copy .env lines" and "Reset demo data". Use it at the defence.
- **`../tools/contract-check/`**: the checker teammates run against their service (`.\check.ps1 -Service s2 ...`).

## Real services or mocks

Copy `.env.example` to `.env` and change the switches, then restart `npm run dev`.

| Variable | Meaning |
| --- | --- |
| `VITE_S1_URL` … `VITE_S6_URL` | Base URL of each service. On a teammate's PC, replace `localhost` with that PC's LAN IP. |
| `VITE_USE_MOCKS` | `false` = no mocks at all, every call goes to the real services. |
| `VITE_MOCK_S1` … `VITE_MOCK_S6` | Per service: `true` = answered in the browser by MSW, `false` = real service. Only read when `VITE_USE_MOCKS=true`. |

As each teammate's service comes online, flip its switch to `false`. Nothing else changes:
pages call the same typed client either way. `/design` shows a live health check for all six services.

### Mock layer limitations

- Mock data (orders, tows, payments…) is saved in the browser's `localStorage` (`df.mockdb`), so it
  survives reloads but stays in **one browser profile**. To demo two roles talking to each other with mocks,
  log out and log in as the other role in the same browser. With the real services, use two browsers.
- Towing is simulated: offers go to the nearest online tow driver, each offer lasts 30 s,
  and a tow driver who is not looking at the app accepts on their own after about 7 s.
  While a simulated driver is en route, the truck drives towards the pickup.
- To reset demo data: DevTools → Application → Local Storage → delete `df.mockdb`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run lint` | ESLint, fails on any warning |
| `npm run typecheck` | `tsc` only |
| `npm run format` | Prettier |
| `npm test` | Unit tests (Vitest) of the HTTP client's tolerant parsing |
| `npm run contract:selftest` | Runs the teammates' contract checker against the browser mocks (needs `npm install` in `../tools/contract-check`) |
| `npm run check:errors` | Fails if an error code of the contract has no translation in en, fr or ar |
| `npm run gen:api` | Regenerates `src/api/types/*` and the mock seed from `../contract/` |

## Code map

```
src/
  app/        router, providers, layouts (public site, role area, page shell)
  design/     UI kit (Button, Field, Modal, DataTable, Toast…), tokens in index.css + tailwind.config.ts, map
  features/   one folder per area: landing, auth, parts, mechanics, towing, payments,
              driver, supplier, mechanic, tow, dispatcher, admin, notifications, profile
  api/        typed fetch client per service (s1…s6), generated contract types
  mocks/      MSW handlers per service + the localStorage mock database
  i18n/       en / fr / ar catalogues (ar = RTL)
  lib/        auth store, role guards, formatting, errors, GSAP setup, cart
```

Auth: the JWT is kept in memory and `localStorage`. A 401 logs out with a toast. Accounts with
`approved=false` land on the pending screen. Error codes from the contract (`errors.CODE`) are
translated in all three languages.

Motion: GSAP + ScrollTrigger through `useGSAP`; every animation is switched off under
`prefers-reduced-motion`.
