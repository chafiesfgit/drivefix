# DriveFix frontend — progress

Last update: 25/11/2026 · Defence: 30/11/2026

## Status

All five phases are built, plus the team-ready work (tiers T1 to T3 below). Quality gate, all green:
`npm run typecheck`, `npm run lint` (0 warnings), `npm run build`, `npm test` (14 unit tests), `npm run check:errors`
(22 contract error codes translated in en/fr/ar), `npm run contract:selftest` (6/6 mocks match contract v1.1),
S1 `manage.py test` (56 tests), and `tools/contract-check` against the real S1 (19 PASS, 0 FAIL).

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Scaffold, Figma tokens and fonts, UI kit, `/design` storybook, typed API client, mock switches, i18n ar/fr/en + RTL | Done |
| 2 | Landing page with GSAP motion, public parts / mechanics / SOS / tracking pages, footer pages | Done |
| 3 | Auth on real S1: register by role, OTP, login, forgot/reset, lockout, pending approval, suspended/rejected states, admin approvals and users | Done |
| 4 | Role areas: driver (parts, cart, cash or sandbox orders, bookings, SOS + live tracking), supplier, mechanic, tow driver, dispatcher, admin (payments, SMS log, reports, settings), notifications, profile | Done |
| 5 | Polish: empty/loading/error states, responsive at 360 / 768 / 1440 in LTR and RTL, break-the-UI pass, accessibility, README | Done |
| T1 | Integration safety: contract checker for teammates (`../tools/contract-check`), tolerant HTTP client, `/status` page, mock parity self-test, `docs/INTEGRATION.md`, S1 reachable from other PCs (`open-port.ps1`) | Done |
| T2 | Contract v1.1 (additive, `CHANGELOG.md`): `payUrl` on Order and Payment, S1 `POST /auth/refresh`, S3 `slots?serviceId`, S4 `GET /dispatch/tow-drivers`. New screens: mechanic Reviews, driver Payments | Done |
| T3 | Random OTP only (no fixed code anywhere), visible OTP block in the S1 window, docs updated | Done |

## Verified by script (Playwright + system Chrome)

- **Real S1:** register a driver → wrong OTP → right OTP → dashboard → logout/login → forgot + reset password → 5 wrong passwords → locked screen.
- **Real S1 admin:** pending supplier sees the waiting screen → admin approves / rejects with a reason / suspends / reactivates (in a second browser) → the supplier clicks "Check again" and lands on their dashboard **without logging out** (`POST /auth/refresh`).
- **Mocks, booking:** slots step by the service duration (60 min) → driver books → mechanic accepts, starts, marks done → driver sees DONE → mechanic Reviews and driver Payments pages.
- **Mocks S2–S6, full demo:** driver orders a part with cash → supplier confirms, ships, delivers, marks cash collected → tow driver goes online → driver sends SOS → tow driver accepts and drives → driver sees live tracking → tow completed + cash collected → dispatcher board.
- **Responsive sweep:** every public and role page at 360, 768 and 1440 px in English and Arabic. No horizontal scroll, no untranslated keys, no runtime errors.
- **Break pass:** empty submits show every field error at once (translated), very long search text, invalid phone, offline.
- **Accessibility (axe-core):** 17 public and role pages have no serious or critical issues, except the brand-orange exception below.

## Decisions

- **Role layout:** a floating top glass nav plus a mobile drawer. Figma has no sidebar, so the app follows the landing page's nav.
- **Header band:** the orange glow behind page titles is drawn in CSS, not exported as an image (sharper, themable, lighter).
- **Sandbox `payUrl` (contract v1.1):** the order screen uses `order.payUrl ?? payment.payUrl`. If neither service sends it, the driver sees "Payment link not available yet" with a retry button instead of an error.
- **Fleet list (contract v1.1, optional):** `GET /dispatch/tow-drivers` is in the contract now. Without it (404) the dispatcher falls back to the seeded drivers.
- **Tow history:** no contract endpoint, so completed jobs are kept on the tow driver's device.
- **Moderation and settings (admin):** moderation actions are local only, settings are read-only. Neither has a contract endpoint.
- **Pending approval → "Check again":** calls `POST /auth/refresh` (contract v1.1) and swaps the token in place; approved users go straight to their dashboard.
- **Tolerant client:** `null` reads as "missing", numeric strings in number fields become numbers, paged lists accept a bare array, errors without the JSON format get a code from the status, network/CORS failures name the service ("S3 Mechanic is not reachable", dev builds add a fix hint). Any `NOT_APPROVED` answer sends the user to `/pending`.
- **Contract checker = mock self-test:** the same engine (`tools/contract-check/lib/engine.mjs`) checks a teammate's live service and, in Node with `msw/node`, my browser mocks. Writes are only done with `--write`; read mode calls every GET and runs the security sweeps (which never change data).
- **Checker rules on my side too:** guest routes (guest SOS, tracking by code) are excluded from token checks; camelCase is only enforced on field names (map keys such as `sat-thu` are data); 401 may be `UNAUTHORIZED`, `TOKEN_INVALID` or `TOKEN_EXPIRED` (written in the CHANGELOG).
- **Mocks follow the contract fully:** they now implement the service-to-service routes too (`/users/{id}/public`, `POST /payments`, `POST /notifications` from templates, `POST /sms`, `/internal/payments/.../result`), refuse wrong `X-Service-Key` in the self-test, return `payUrl` only while a SANDBOX payment is PENDING, and size S3 slots by the service duration.
- **S1 ↔ S6:** S1 sends the spec template types (`OTP_CODE`, `PASSWORD_RESET`...) plus `POST /sms` for codes, in a **background thread**: with S6 down, register went from 8 s to 0.3 s. The OTP is printed first, in a big ASCII block in the S1 window.
- **OTP:** always random. `OTP_FIXED_CODE` stays in the S1 code for tests only, empty in `.env`, never recommended. The mocked S1 also uses random codes (browser console + admin SMS log).
- **Role nav:** "Profile" moved out of the top bar (it is in the account menu) to make room for Payments; the bar shows from 1280 px, the drawer below. Every role fits at 1280 / 1440 px in fr / en / ar.
- **Dev dependency:** Vitest 3.2 (unit tests + self-test). No runtime dependency added in this task.
- **Language:** the UI follows the language chosen on this device. The account's language is applied at login only if the device has no saved choice.
- **Colour contrast:** three Figma colours were darkened slightly so small text reaches WCAG AA (4.5:1): grey `#9A9484 → #736D5F`, warning `#A8620A → #96570A`, orange hover `#C94F0A → #B8470A`. Large orange headings on light backgrounds use `orange-ink #D9560C`. Small orange text uses `orange-hover`.
- **Brand-orange exception:** white text on the Figma orange `#F26A1B` (the "Get started" / SOS buttons and the ticker band) is 3.06:1. That is below AA for 14–18 px text. It was kept on purpose to match the Figma identity. To make it pass, change the accent button background to `orange-hover` in `src/design/ui/Button.tsx`.
- **Landing motion:**
  - Smooth wheel scrolling uses Lenis, driven by GSAP's ticker so scroll-linked animations stay in sync. It runs on the landing page only and is off for reduced motion; touch keeps native scrolling.
  - The service cards tilt toward the cursor with a light that follows it. Their Figma illustrations move: the disc spins, the gauge needle revs, the pin lifts with ripples. Mouse only; keyboard focus gets the same illustration motion.
  - The platform stats load in sequence: sheen, count-up, and 58 wilaya dots / 6 role segments / 3 language chips filling in step.
  - Everything animates transform and opacity only. The landing bundle grew by about 7 kB gzipped.
- **Money:** always whole dinars. "4 500 DZD" / "4 500 د.ج" with a no-break space, so the digits stay in order inside Arabic text.

## Dependencies

`npm audit` reports 0 vulnerabilities. On 25/11 the four advisories were fixed by moving to zod 4,
react-router-dom 7, i18next 27 / react-i18next 18 and @hookform/resolvers 7. Only two code changes were needed,
and every flow above was re-run after the upgrade. The install scripts of esbuild and msw are approved in
`package.json` (`allowScripts`), so `npm install` prints no warnings.

## Known limits

- The checker cannot test S5 → S2/S4 callbacks or S2/S4 → S6 notifications alone: those show at integration day (demo path).
- `contract:selftest` needs `npm install` in `../tools/contract-check` (it borrows that folder's `ajv` and `yaml`).

- Mock data lives in one browser's `localStorage`. With mocks, multi-role demos are sequential logins in the same browser (see README).
- `GET /tow-drivers/me/offer` returns 404 when there is no offer (as the contract says). Chrome logs each one in the console. This is expected.
- Map tiles come from openstreetmap.org and need internet.

## Next (when teammates' services are ready)

1. Flip `VITE_MOCK_S2` … `VITE_MOCK_S6` to `false` one at a time and re-run the demo path.
2. Push the monorepo to GitHub; teammates clone it, read `docs/INTEGRATION.md`, and send back `contract-check-report.md` with 0 FAIL.
3. Before the defence: "Reset demo data" on `/status`, run S1 `manage.py seed` for clean seed data, and keep the S1 window visible: every OTP is random and printed there.
