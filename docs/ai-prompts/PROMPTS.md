# AI build prompts (Claude Code)

Parts of this repository were built with Claude Code from the prompts below. They are kept **word for word** as
a record of the requirements and the decisions behind the code. They are **history**, not instructions: do not
paste them again as they are.

## Which prompt built which part

| # | Prompt | Date | Built / changed |
| --- | --- | --- | --- |
| 1 | [Frontend build](#prompt-1-frontend-build) | 2026-11-25 | `frontend/` (all of it: phases 1 to 5) |
| 2 | [Team-ready integration](#prompt-2-team-ready-integration) | 2026-11-25 | `tools/contract-check/` (T1.1), `frontend/` (T1.2 to T1.4, T2.1 to T2.3, T3), `docs/INTEGRATION.md` (T1.5), `contract/` v1.1 + `CHANGELOG.md` (T2.1, T2.2, T2.4), `services/s1-identity/` (`/auth/refresh`, OTP block, `open-port.ps1`) |

Results and decisions for both prompts are in [`frontend/PROGRESS.md`](../../frontend/PROGRESS.md).

## Old paths used in the prompts

The prompts were written before the repository was reorganised. Read the old paths like this:

| Path in the prompts | Path now |
| --- | --- |
| `drivefix-frontend/` | `frontend/` |
| `drivefix-backend/s1-identity/` | `services/s1-identity/` |
| `driveFix-contract/` and `driveFix-contract/driveFix-contract/` | `contract/` |
| `drivefix-contract-check/` (with its own `contract/` copy) | `tools/contract-check/` (reads `contract/` directly) |
| `drivefix-frontend/INTEGRATION.md` | `docs/INTEGRATION.md` |
| `DriveFix — Backend Spec per Service.docx` | `docs/specs/backend-spec-per-service.docx` |
| `driveFix-contract.zip` (sent by hand) | not needed: teammates `git pull` |
| `GitHub/` folder | not part of the repository |

The skills named in prompt 1 (section 1) are installed with the scripts in [`tools/ai-skills/`](../../tools/ai-skills/).

---

## Prompt 1: Frontend build

**Part:** `frontend/`. **Outcome:** done, all five phases (see `frontend/PROGRESS.md`).

You are a senior frontend engineer + motion designer. Build the complete **DriveFix web frontend** from zero, working autonomously. Install what you need, create the folders, run and fix until there are no errors. Do not ask me questions unless something is truly blocked; make sensible decisions and tell me what you decided.

### 0. Context
DriveFix = Algerian platform: spare-parts marketplace + mechanic booking + SOS towing. University project, defence on **30/11/2026**. I own the **whole frontend** and the **S1 Identity backend**. Team of 6 builds S2-S6.

Workspace (current folder = `GP`):
- `driveFix-contract/` - API contract: `openapi/s1..s6-*.yaml`, `seed/*.json`, `.env.example`, `README.md`. **Source of truth for every endpoint, field name, error format and demo data.**
- `drivefix-backend/s1-identity/` - my finished Django service (port 4001, SQLite for now). Real API for auth/admin.
- `DriveFix - Backend Spec per Service.docx` - business rules.
- Create the frontend in **`drivefix-frontend/`** (new folder). Do not touch `drivefix-backend` and ignore any `GitHub/` folder.

Design source: Figma `https://www.figma.com/design/J6bNWf1blz3nIPAi71xixj/WAMS-GP-PROJECT` (fileKey `J6bNWf1blz3nIPAi71xixj`). If a Figma MCP is connected, read the screens from it (pages: 01 Public, 02 Driver, 03 Supplier, 04 Mechanic, 05 Tow driver, 06 Dispatcher, 07 Admin, 08 States, 09 Arabic RTL, Design System). If not, use the tokens below and the contract.

### 1. Skills to use (load them before the matching work)
`react-best-practices`, `composition-patterns`, `react-view-transitions`, `web-design-guidelines`, `emil-design-eng`, `animate`, `choreograph`, `animation-performance`, `improve-animations`, `break-ui`, `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-plugins`, `gsap-performance`, `unslop`, `frontend-design`, `ui-ux-pro-max`, `shadcn`. If one is missing, say so and continue with the others.

### 2. Stack (fixed)
React 18 + **Vite** + TypeScript, Tailwind CSS, React Router, TanStack Query, react-hook-form + zod, **react-i18next** (ar / fr / en), **GSAP** (+ ScrollTrigger, via `@gsap/react` `useGSAP`) for page/scroll animation, Leaflet + OpenStreetMap for maps, lucide-react icons. No Next.js, no Redux. Strict TypeScript, ESLint, Prettier.

### 3. Design tokens (from Figma - put them in `tailwind.config` + CSS variables)
Colours: ink `#0F1B2D` - navy-900 `#0E1B33` - night `#071A3A` / night-800 `#0B2A5B` - brand blue `#1F4E9E` - blue-700 `#0B2A5B` - **orange `#F26A1B`** (hover `#C94F0A`) - cream-50 `#FBF8F1` - cream-100 `#F4EFE3` - sand/grey-100 `#EFE9DB` - grey-200 `#DCD5C4` - grey-400 `#9A9484` - navy-600 (secondary text) `#55627A` - success `#177A47` on `#E6F4EC` - danger `#C0392B` on `#FDECEC` - warning `#A8620A` on `#FFF4E0` - info blue on `#E9EEF8` - mist `#F7F9FC`.
Fonts: **Plus Jakarta Sans** (UI, weights 300-700), **Newsreader Italic** (accent word in headlines, orange), **Space Grotesk Light** (big stat numbers), **Cairo** (Arabic). Scale: Display 56/62 light, Display 32/40, H1 28/36, H2 20/28 medium, H3 16/24 semibold, Body 16/24 - 14/20 - 12/16, Label 14/20 medium, Eyebrow 11/15 caps semibold, Price 20/28 bold.
Spacing 0/4/8/12/16/20/24/32/40/48/64. Radius sm 4, md 6, lg 8, full 999 (buttons are pills; cards/panels use 16-20).
Look: dark navy hero with orange glow/arc, frosted-glass panels (white 8% fill, 1px white 22% border, backdrop-blur 24px), orange primary accents, white pill buttons with an orange round arrow icon, cream page background, generous whitespace. Landing nav is floating: logo left, pill link group centre (Services / How it works / Built for Algeria / FAQ), EN|FR|AR switch, orange "Get started" pill button on the **right edge with the 64px page margin** (plain pill, nothing attached to it).
Buttons: Primary (navy), Accent (orange), Secondary, Ghost, Danger + Disabled. Inputs: label above, 38px field, helper text below, error state.

### 4. Architecture
```
drivefix-frontend/src/
  app/            router, providers, layouts (PublicLayout, RoleLayout with sidebar/topbar)
  design/         tokens, ui primitives (Button, Field, Card, Badge, Modal, Toast, Table, Skeleton, EmptyState...)
  features/       auth, parts, mechanics, towing, payments, notifications, admin, ...
  api/            http client + one module per service (s1..s6) typed from the OpenAPI files
  mocks/          mock handlers + data built from driveFix-contract/seed/*.json
  i18n/           ar.json fr.json en.json  (RTL: set <html dir> and use logical CSS props ms-/me-/ps-/pe-)
  lib/            auth store, jwt decode, format (DZD, dates), guards
```
- Generate TypeScript types from the OpenAPI files (`openapi-typescript`) into `src/api/types`.
- `.env`: `VITE_S1_URL=http://localhost:4001/api/v1` ... `VITE_S6_URL=...`, and `VITE_USE_MOCKS=true|false`.
- **Per-service switch**: each of S1..S6 can be real or mocked independently (`VITE_MOCK_S2=true` ...). S1 is **real by default**; S2-S6 are mocked (MSW) until teammates are ready, using the contract seed data and the exact response shapes (`{items,page,pageSize,total}`, errors `{error:{code,message,field}}`).
- Auth: token in memory + localStorage, `Authorization: Bearer`, decode claims `sub, role, approved`. Route guards by role (DRIVER, SUPPLIER, MECHANIC, TOW_DRIVER, DISPATCHER, ADMIN); suppliers/mechanics/tow drivers with `approved=false` see the "waiting for approval" screen. 401 -> logout, show toast. Map every error `code` to a translated message (OTP_EXPIRED, PHONE_TAKEN, ACCOUNT_LOCKED, INVALID_CREDENTIALS, ...).

### 5. Build order (finish and verify each phase before the next)
**Phase 1 - foundation:** project, tokens, fonts, Tailwind, i18n with RTL, router, UI primitives, API client, mock layer, auth store, layouts. Storybook-like `/design` route showing every primitive in all states.
**Phase 2 - public + auth (REAL S1):** Landing page (full: floating nav, hero with search panel and floating cards, ticker, services, four steps, platform stats, made for Algeria, how it works, bento, FAQ, final CTA, footer), guest catalogue pages (parts, mechanics directory, SOS towing, how it works), Sign-up (choose role -> form with role-specific fields -> OTP screen with 60 s resend countdown and 5 attempts -> result), Login, Forgot password, Set new password, Pending approval, Account locked/suspended states. Use the demo accounts (password `Password123`, e.g. admin `0555000001`). In dev the OTP is printed in the S1 console; also support `OTP_FIXED_CODE`.
**Phase 3 - Admin (REAL S1):** applications queue (approve / reject with required reason), users table (search, role/status filters, pagination, suspend/reactivate), plus the other admin screens from Figma using mocks.
**Phase 4 - Driver, Supplier, Mechanic, Tow driver, Dispatcher** dashboards and flows from Figma (parts search + cart + sandbox payment + cash on delivery, mechanic booking, SOS request with map and live tracking mock, supplier inventory/orders, mechanic schedule, dispatcher board, notifications). Mocked services first, real ones plugged in later by flipping the env flag.
**Phase 5 - polish:** states screens (loading skeleton, empty, error, offline), accessibility (focus rings, labels, contrast AA, keyboard), responsive (360 / 768 / 1440), performance, README.

### 6. Motion (this is what makes it feel premium - do it carefully)
- GSAP + ScrollTrigger on the landing: hero text reveal (split lines, staggered, `power3.out`), floating hero cards with gentle parallax + subtle idle float, scroll-linked progress bar at the top, section reveals (translate 24px + fade, once), stat numbers count up on enter, "four steps" timeline that draws as you scroll, nav that condenses/changes background after 80px scroll.
- UI micro-interactions (Emil Kowalski rules): buttons scale 0.97 on `:active`, hover lifts only on pointer devices, asymmetric timing (fast in, slower out), only animate `transform`/`opacity`, durations 150-300 ms, custom ease-out curves, no `transition: all`, modals/popovers scale from their trigger, toasts slide, list items stagger, route transitions with the View Transitions API where supported.
- **Always respect `prefers-reduced-motion`** (use `gsap.matchMedia()`), pause off-screen animation, clean up with `useGSAP` contexts, never animate layout properties.
- No generic AI look: no purple gradients, no emoji icons, no centred-everything templates; follow the Figma composition.

### 7. Quality gate (mandatory before you say "done" for any phase)
1. `npm run build`, `npm run lint`, `tsc --noEmit` all pass with zero errors/warnings.
2. Start the dev server, open it in a browser (Playwright/Chrome MCP if available) and **look** at every screen at 1440 and 390 px in LTR and RTL; compare with Figma; fix overflow, clipped text, contrast, misalignment.
3. Exercise the real flows against S1: register -> OTP -> login, wrong password x5 -> locked, forgot/reset password, admin approve/reject, suspend/reactivate. Fix every bug found.
4. Run the `break-ui` skill on forms/tables (long names, empty data, slow network, errors) and fix.
5. Run `web-design-guidelines` + `review-animations` + `react-best-practices` review and apply the findings.
6. Commit nothing to any remote. Keep a `PROGRESS.md` (done / next / decisions) updated after each phase.

### 8. How to run (document in README and make it work on Windows PowerShell)
```
cd drivefix-backend\s1-identity ; .\run.ps1          # S1 on :4001
cd drivefix-frontend ; npm install ; npm run dev     # frontend on :5173
```
S1 already allows CORS from `http://localhost:5173`.

Start now with Phase 1. After each phase, give me a 5-line summary: what works, what you decided, what I should test by hand.

---

## Prompt 2: Team-ready integration

**Parts:** `tools/contract-check/`, `frontend/`, `docs/INTEGRATION.md`, `contract/`, `services/s1-identity/`.
**Outcome:** done, tiers T1 to T3, quality gate green (see `frontend/PROGRESS.md`).

You are working in `<repo root>` on DriveFix (spare parts + mechanic booking + SOS towing platform for Algeria, defence 30/11/2026, today is 25/11/2026). Work alone, do not ask me questions: when something is unclear, take the most reasonable choice and write it in `drivefix-frontend/PROGRESS.md` under "Decisions".

### 0. WHAT EXISTS (already built and verified, do not rebuild)

- `drivefix-backend/s1-identity/`: S1 Identity service (Django 5 + DRF, SQLite, port 4001). 46 tests pass. It issues the JWT (HS256, claims `sub, role, approved, exp`). It is the ONLY real backend I own.
- `drivefix-frontend/`: the whole web frontend (React 18 + Vite + TS + Tailwind, ar/fr/en + RTL). Typecheck, lint (0 warnings) and build pass. S1 is real. S2..S6 are **mocked** in the browser with MSW (`src/mocks`), controlled by `.env` flags `VITE_MOCK_S2..S6`.
- `driveFix-contract/driveFix-contract/`: the shared API contract (OpenAPI per service in `openapi/`, shared demo data in `seed/`, `.env.example`, `README.md`). The contract is the source of truth for everyone.
- Teammates each build ONE service (S2 Parts, S3 Mechanic, S4 Towing, S5 Payment, S6 Notification), each on their own PC, from the contract. I do not control their code.
- **Ignore the folder `GP\GitHub\` completely. Never read, edit or use it.**

### 1. THE GOAL OF THIS TASK

When a teammate starts their service on their own PC, my frontend must work with it **with no surprises and without them having to come to me to ask how**. Three things make that true:
1. The frontend is tolerant and gives clear errors when a service differs slightly from the contract.
2. Every teammate has a tool that tells them, in plain words, "your service matches the contract" or exactly what is wrong.
3. One document explains everything to them in simple English.

Also close the few gaps found in my audit (section 3) and remove one bad demo habit (section 4).

Rules for the whole task:
- Do NOT add new npm libraries to the frontend, except dev-only test helpers if truly needed (say why). No redesign: keep the Figma look and existing tokens.
- Contract changes must be **additive only** (new optional fields or new endpoints). Never rename or remove anything in v1. Every change goes in `driveFix-contract/driveFix-contract/CHANGELOG.md` (create it) and the contract version becomes v1.1.
- Keep all three languages (en, fr, ar) in sync for every new string. Keep RTL working.
- Keep `npm run build`, `npm run lint` (0 warnings) and `tsc` green after every tier.

### 2. TIER 1: INTEGRATION SAFETY (do first, this is the most important part)

#### T1.1 Contract-check tool for teammates (standalone folder `GP\drivefix-contract-check\`)
Why: each teammate needs to test their own service alone, without my frontend, and get a clear PASS/FAIL list. Build a small Node (>=18) CLI. It must work standalone: it has its own `package.json`, its own copy of the contract in `contract/` (openapi + seed) and a `npm run sync-contract` script that refreshes that copy from `driveFix-contract/driveFix-contract`. Also a `check.ps1` wrapper so they can run: `.\check.ps1 -Service s2 -Url http://192.168.1.20:4002/api/v1 -S1 http://192.168.1.10:4001/api/v1`.
It must:
1. Get tokens by logging in to the real S1 (`--s1`) with the seed accounts (password `Password123`: 0555000001 ADMIN, 0555000002 DRIVER, 0555000004 SUPPLIER approved, 0555000011 SUPPLIER pending, 0555000006 MECHANIC, 0555000008 TOW_DRIVER, 0555000010 DISPATCHER). If S1 is down, say so clearly and stop.
2. Check `GET /health` (no auth, `{status:"ok"}`).
3. **CORS:** send an `OPTIONS` preflight with `Origin: http://localhost:5173` and headers `Authorization, Content-Type` and methods GET/POST/PUT/PATCH/DELETE. The service must answer with the right `Access-Control-Allow-*` headers. This is the #1 integration bug, so give a clear fix message ("add http://localhost:5173 to CORS_ORIGIN").
4. For every operation of that service in its OpenAPI file: call it with a token of an allowed role (ids from the seed). Check the status code is one the contract declares, and the JSON body validates against the schema (use `ajv` + `ajv-formats`; uuid, date-time, integer money, camelCase keys, `{items,page,pageSize,total}` for lists, error format `{error:{code,message,field}}`).
5. Security checks: no token -> 401 `UNAUTHORIZED`; wrong role -> 403 `FORBIDDEN`; the pending supplier 0555000011 on a supplier-only action -> 403 `NOT_APPROVED`; expired/garbage token -> 401; token signed with a wrong secret -> 401 (this catches "JWT_SECRET differs from the shared one").
6. `--write` mode: run the "Done when" scenario of that service with real writes (S2: find a part, compare, order with CASH, supplier confirms and ships, stock decreases, driver cannot cancel after CONFIRMED -> 409, qty above stock -> 422 OUT_OF_STOCK. S3: list slots, book, overlap -> 409 SLOT_TAKEN, mechanic accepts, finish, review, review twice -> error. S4: SOS, offer, accept, status changes, track, expired offer -> 409 OFFER_EXPIRED. S5: sandbox session succeed/fail, cash-collected, refund. S6: create notification, unread-count, mark read, sms-log). Use only the demo seed ids, and tell the user to re-seed afterwards.
7. Output: a coloured table in the terminal (PASS / FAIL / WARN per check, with the exact reason and how to fix it) plus a `contract-check-report.md` file they can send me. Exit code 1 on any FAIL.
8. A `README.md` in that folder, 1 page, simple English.
Self-test: run the tool against S1 (real, running locally) and fix any mismatch it finds on MY side too.

#### T1.2 Make the frontend tolerant and clear (the "robustness pass")
Why: a teammate's service will differ slightly (missing optional field, null instead of missing, extra fields, 502 page, slow response). The UI must never crash or show a blank page.
- Audit `src/api/http.ts` and every place that reads API data. Rules: ignore unknown fields; treat optional fields as optional (null or missing); never assume a list is non-empty; accept money as integer (and tolerate numeric strings by converting); accept dates in ISO with or without milliseconds; errors without `field` or without JSON body (HTML 502, empty body) become a friendly typed error.
- Network or CORS failure -> a clear message that names the service ("S3 Mechanic is not reachable") and, in dev mode only, a technical hint: "check the service is running, the URL in .env, and that its CORS allows http://localhost:5173".
- 401 anywhere -> clean logout to /login with a message. 403 `NOT_APPROVED` anywhere -> go to /pending. Add a retry button on every list/page error state.
- Every error `code` that appears in the contract (read all OpenAPI files + contract README: for example NOT_APPROVED, SESSION_EXPIRED, ALREADY_REVIEWED, INVALID_CREDENTIALS...) must have an `errors.<CODE>` translation in en, fr and ar. Write a script `npm run check:errors` that compares the contract codes with the translation files and fails if one is missing; run it in the quality gate.
- Add small unit tests (Vitest is allowed as a dev dependency) for the http client's tolerant parsing.

#### T1.3 `/status` page (public, small link in the footer)
A table S1..S6: name, mode (Real / Mock), URL in use, live health (ping `/health` every 10 s, show latency and last error), and a button "Copy .env lines". Plus a button "Reset demo data" (clears the mock database in localStorage and reloads). Reuse the existing design system. This is how I show the teacher which services are real at the defence.

#### T1.4 Mock parity self-test
Why: the frontend was built against my mocks; if the mocks follow the contract, the frontend follows the contract. Write `npm run contract:selftest`: run the same validation logic as T1.1 (shared code if possible) against the MSW handlers in Node (`msw/node`, shim `localStorage`). Fix any mock that breaks the contract (known one: the S3 mock uses fixed 30-minute slots; per the spec the slot length must come from the service `durationMin`).

#### T1.5 One document for teammates: `GP\drivefix-frontend\INTEGRATION.md`
Simple English, short sentences, explain every term (CORS, JWT, mock, LAN IP). Sections:
1. What the frontend is and what runs where (diagram in text).
2. How to see YOUR service inside my frontend, step by step: start your service listening on all interfaces (`0.0.0.0`), find your LAN IP (`ipconfig`), allow your port in Windows Firewall, same Wi-Fi, give me `http://YOUR-IP:PORT/api/v1`; I set `VITE_Sx_URL` and `VITE_MOCK_Sx=false`. Include a copy-paste PowerShell block to open the firewall port.
3. Per service: the exact endpoints my frontend calls and which response fields it reads (generate this table from `src/api/*.ts` and the models, do not invent).
4. The 10 most common mistakes and the one-line fix for each: CORS, JWT_SECRET differs, claim names, snake_case, ids not UUID, money as decimals, error format, pagination envelope, role check order (401 before 403), forgetting `approved`.
5. How to run `contract-check` before telling me "it is done".
6. The contract additions of v1.1 (from section 3) so nobody is surprised.
7. A "Definition of done" checklist per service (copy the "Done when" sentences from `DriveFix — Backend Spec per Service.docx`).
Also make sure S1 is reachable from other PCs: check `ALLOWED_HOSTS` in S1 settings accepts a LAN IP in the Host header, `CORS_ORIGIN` accepts several comma-separated origins (it does), and `run.ps1` binds `0.0.0.0`. Add `drivefix-backend/s1-identity/open-port.ps1` (needs admin) that opens port 4001 in Windows Firewall, and document it.

### 3. TIER 2: GAPS FOUND IN MY AUDIT

#### T2.1 Online payment has a hole in the contract (important)
The spec says: for SANDBOX, S2 creates the order, calls S5 `POST /payments`, and S5 returns a `payUrl`. But the contract's S2 `Order` schema and S5 `Payment` schema have no `payUrl` field, so with real services my frontend could never open the sandbox page. Fix additively: add optional `payUrl` (string, only for SANDBOX orders that are still PENDING) to the S2 `Order` response (`POST /orders`, `GET /orders/{id}`) and to the S5 `Payment` response (`GET /payments`, `GET /payments/{id}`). In the frontend use `order.payUrl ?? payment.payUrl`; if neither exists, show a clear message "Payment link not available yet" with a refresh button instead of failing. Update both OpenAPI files, the `s1..s6` copies inside `drivefix-contract-check/contract`, regenerate the TS types (`npm run gen:api`), update the mocks, and write it in CHANGELOG.md and INTEGRATION.md so Person A (S2) and Person D (S5) know.

#### T2.2 Pending users should not have to log out and in again
The `approved` flag lives inside the JWT, so after the admin approves, the user's old token still says `approved:false`. Add to S1 an additive endpoint `POST /auth/refresh` (needs a valid, non-expired token; returns a fresh `{token, user}` with current status and `approved`; refuses suspended users). Add tests to S1 (keep all 46 passing), add it to `s1-identity.yaml` (both copies) and the contract CHANGELOG. In the frontend, the "Check again" button on `/pending` calls it and, if approved, goes to the role dashboard. Add `s1.refresh` to the mocks.

#### T2.3 Missing screens from the spec
- **Mechanic "Reviews" page** (`/app/mechanic/reviews`, nav item, spec screens 40-45). Data: `GET /mechanics/{id}` reviews of the logged-in mechanic (id = user id). Show average rating, count, list with date and comment; empty and error states.
- **Driver "Payments" history** (`/app/driver/payments`, nav item). Data: `GET /payments` paged. Columns: date, what (order or tow, link to it), amount in whole DZD, method, status chip; filter by status; empty and error states.
Both must match the existing design system, work in en/fr/ar + RTL, at 360 / 768 / 1440 px, and pass axe-core.

#### T2.4 Contract holes the frontend already works around
Add to the contract as **optional** and document in CHANGELOG + INTEGRATION.md: S4 `GET /dispatch/tow-drivers` (list of tow drivers with position and busy flag, for the dispatcher fleet map). Everything else (tow history, admin moderation, admin settings) stays local/read-only; just list them in INTEGRATION.md under "Not in the contract, handled locally".
After contract edits: rebuild `GP\driveFix-contract.zip` so the team gets the new version, and keep the old name.

### 4. TIER 3: CLEANUP

#### T3.1 OTP must be REAL, never a fixed code
I do not want a fixed `123456`. Every OTP must be random, and I read it from the S1 PowerShell window.
- Remove every recommendation to set `OTP_FIXED_CODE` from `PROGRESS.md`, `README.md`, the start script and any UI hint. Keep `OTP_FIXED_CODE=` empty in `.env` and `.env.example` (the feature may stay in the code, off by default, but never recommended).
- Make the code easy to see: in S1 `accounts/notify.py`, when the notification type is `OTP_SIGNUP` or `OTP_RESET`, additionally `print` (flush) a clearly visible block to the console, for example:
  ```
  ================================================
   DriveFix OTP   phone 0555000001   code 483920   valid 5 min
  ================================================
  ```
  Keep it ASCII only (Windows console), keep the normal log line, and never print it in other message types. Add a test that it appears and that the code is random between two calls.
- The OTP page hint (all 3 languages) must say: "Open the S1 window (PowerShell): the code is printed there."

#### T3.2 Final docs
Update `PROGRESS.md` (new tiers, decisions, known limits), `README.md` (point to INTEGRATION.md and the status page), and make sure `start-demo.ps1` still works and does not set a fixed OTP.

### 5. QUALITY GATE (run before you report, fix everything that fails)
1. `npm run typecheck`, `npm run lint` (0 warnings), `npm run build`, `npm run check:errors`, `npm run contract:selftest`, unit tests.
2. S1: `python manage.py test` (all old tests + new ones pass), start S1 for real.
3. `drivefix-contract-check` run against the real S1: 0 FAIL.
4. Playwright (system Chrome) re-run of the existing flows in `scripts/` (real S1: register, OTP read from the real S1 console output, login, lockout, admin approve then **refresh without logging out**; mocks: order, booking, SOS) plus the two new screens, at 360 / 768 / 1440 in LTR and RTL.
5. Open the app yourself in the browser and look at `/status`, `/app/mechanic/reviews`, `/app/driver/payments` before saying done.

### 6. FINAL REPORT (max 12 lines)
Tier by tier: what was done, what was skipped and why, files I must send to teammates (`drivefix-contract-check\`, `INTEGRATION.md`, the new `driveFix-contract.zip`), and anything that still needs me. Do not paste code in the report.
