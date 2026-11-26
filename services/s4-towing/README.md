# S4 Towing — service README and decision log

Port **4004**, base path **`/api/v1`**, health **`GET /health`**.
Owner: Person C. This folder is self-contained: Python/Django + SQLite, no other DriveFix service is needed to run it.

> This README is the running log of *what was done and why*. The old brief is kept unchanged as
> [`TOWING_SERVICE.md`](TOWING_SERVICE.md) for historical context only; where it disagrees with the
> shared contract, **the contract wins** (per the root `README.md`).

## 1. What was inspected first (and what that changed)

| Source | Finding | Decision |
| --- | --- | --- |
| Root `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` | Root README is the authority on conflicts; S4 is port 4004, folder `services/s4-towing/`, owner Person C. | Kept the root README **unchanged** — it already names this folder and port. No edits outside this service folder. |
| `contract/openapi/s4-towing.yaml` (v1.1), `contract/seed/s4-towing.json`, `contract/.env.example`, `contract/README.md` | Source of truth for paths, schemas, roles, status codes, shared secrets and numbers. | Implemented exactly this contract; no contract file was changed (changes there must be additive and logged). |
| `services/TOWING_SERVICE/` (untracked) | An earlier, untracked towing brief/folder used port 8004, `/api/towing/`, role `tow_provider`, statuses `pending/confirmed/...`, PostGIS, WebSockets, Celery and Twilio. | **Moved** the folder to `services/s4-towing/` (contract naming) and kept `TOWING_SERVICE.md` inside it as history. None of those conflicting choices were implemented. |
| `docs/specs/backend-spec-per-service.docx` | Rules: `SEARCHING → ASSIGNED → EN_ROUTE → ARRIVED → COMPLETED`, plus `CANCELLED` / `NO_DRIVER`; nearest-driver sequential dispatch, 30 s offers, 3 failed offers → `NO_DRIVER`. | Implemented in `towing/services.py`. |
| `frontend/src/api/s4.ts`, `frontend/src/api/types/s4.ts`, `frontend/src/mocks/handlers/s4.ts`, `frontend/src/mocks/seed/s4-towing.json`, `docs/INTEGRATION.md` | Frontend calls `/tows`, `/tows/:id`, `.../track`, offer/status/dispatch routes; detail is `{ request, towDriver?, lastPosition? }`; track is `{ last, trail, etaMinutes? }`; fleet is `{ items }`; lists are `{ items, page, pageSize, total }`; money is integer DZD. | Response builders in `towing/services.py` emit those exact camelCase shapes. No frontend file was touched. |
| `tools/contract-check/` (`lib/engine.mjs`, `lib/scenarios.mjs`) | The checker logs in to S1 to mint tokens, checks role before body, expects `OFFER_EXPIRED` on a second accept and `STATE_CONFLICT` on illegal moves, and validates date-time/uuid/integer/camelCase. | Order of checks and error codes were matched; verified with a full checker run (section 7). |

## 2. Stack and independence decisions

| Decision | Why |
| --- | --- |
| Python + Django 5 / DRF, `PyJWT`, `django-cors-headers`, `python-dotenv` | Same shape as the S1 service the team already knows; small dependency list, nothing platform-specific. |
| **SQLite via Django** (`tow_db.sqlite3`), `DATABASE_URL` empty by default | The user asked for no external DB. Django's built-in SQLite needs no server, no Docker and no `psycopg2`. A `sqlite:///…` or `postgres://…` `DATABASE_URL` is still understood, but Postgres is *not* required or installed. |
| No PostGIS, no Redis, no Celery, no Docker, no WebSocket | The contract uses REST polling (`secondsLeft`, `/track`), and the demo must start with one Python command. Distance is a local Haversine calculation. |
| **Local JWT verification**, no call to S1 | S1 signs HS256 tokens with the shared `JWT_SECRET` and claims `sub`/`role`/`approved`/`exp`. S4 decodes with the same secret (`common/auth.py`). There is no local user table and no `/auth/verify` call. |
| **Zero outbound HTTP requests** | No HTTP client is used anywhere (`urllib.parse` appears only to read `DATABASE_URL`). S5's callback is **inbound only** (`POST /api/v1/internal/payments/{towId}/result`, `X-Service-Key`). S6 is never notified and no SMS/push/vendor API is called. |
| Tow-driver names/phones are **snapshots** in `seed/tow-driver-profiles.json` | Lets `/dispatch/tow-drivers` and the detail response show a name without looking the user up in S1. The UUIDs are the shared seed IDs (`…0008`, `…0009`). |
| Offer expiry = lazy + one small in-process thread | Correctness never depends on the worker: every offer read/check expires stale offers first. The 1 s thread only makes expiry happen when nobody polls. No Celery/Redis. |
| Audit logs in a local `AuditLog` table | The business spec asks for sensitive actions to be logged; keeping the table local preserves independence. |

## 3. Implemented endpoints (all under `/api/v1`)

| Method and path | Allowed caller | Result |
| --- | --- | --- |
| `POST /tows` | DRIVER token, or guest with valid `guestPhone` | `201` TowRequest in `SEARCHING`; starts dispatch |
| `GET /tows/{id}` | owner DRIVER, assigned TOW_DRIVER, DISPATCHER/ADMIN, or `?trackingCode=…` | `200 { request, towDriver?, lastPosition? }` |
| `POST /tows/{id}/cancel` | owner or DISPATCHER/ADMIN | `200` TowRequest (`CANCELLED`) |
| `PATCH /tows/{id}/status` | assigned TOW_DRIVER | `200` TowRequest; `EN_ROUTE → ARRIVED → COMPLETED` only |
| `GET /tows/{id}/track` | owner, assigned driver, DISPATCHER/ADMIN, or `?trackingCode=…` | `200 { last, trail, etaMinutes? }` (trail capped at 30 points) |
| `PUT /tow-drivers/me/availability` | approved TOW_DRIVER | `200 { available }`; refuses offline with an active job (`409`) |
| `PUT /tow-drivers/me/position` | TOW_DRIVER | `204`; appends a tracking point while on a job |
| `GET /tow-drivers/me/offer` | TOW_DRIVER | `200` TowOffer with `secondsLeft`, or `404` |
| `POST /tow-offers/{id}/accept` / `…/decline` | the TOW_DRIVER the offer was sent to | `200` TowRequest / `204` |
| `GET /dispatch/tows` | DISPATCHER/ADMIN | `200 { items, page, pageSize, total }`, optional `status` filter |
| `POST /dispatch/tows/{id}/assign` | DISPATCHER/ADMIN | `200` TowRequest (manual assignment) |
| `GET /dispatch/tow-drivers` | DISPATCHER/ADMIN | `200 { items }` with fleet positions and `busy` (contract v1.1) |
| `POST /internal/payments/{towId}/result` | `X-Service-Key` only (inbound S5 callback) | `204`; stores `PAID`/`FAILED` internally |

`GET /health` and `GET /api/v1/health` are public and return `{"status":"ok","service":"s4-towing","db":"up"}`.

### Business rules in `towing/services.py`

- One open SOS per authenticated driver (`409 STATE_CONFLICT`); guests need a valid Algerian phone (`0[567]…`, `+213…` accepted and normalised).
- Price estimate is local and deterministic: `baseFee + perKm × (nearestOnlineDriverKm capped at 15 + 8)`, rounded to 100 DZD. Config comes from the seed (`3000`, `120`, 30 s, 3 offers) with `.env` defaults as fallback.
- Dispatch is **sequential**: one `OFFERED` row at a time to the nearest free driver (Haversine from the last reported position). Decline, or expiry, immediately offers the next driver. After `maxOffers` (3) failed offers the request becomes `NO_DRIVER`.
- `secondsLeft` is computed live from `expires_at`; the first atomic accept wins and all other open offers are closed. A repeat/late accept gives `409 OFFER_EXPIRED`.
- Statuses move only `ASSIGNED → EN_ROUTE → ARRIVED → COMPLETED`; cancellation is allowed from `SEARCHING`, `ASSIGNED`, `EN_ROUTE` and `NO_DRIVER`, never after `ARRIVED`. Illegal moves give `409 STATE_CONFLICT`.
- ETA is derived from the last position at ~35 km/h, or 0 after arrival; tracking keeps the newest 30 positions.
- All JSON is camelCase, UUIDs are strings, dates are ISO-8601 UTC (`…Z`), money is integer DZD, and every failure uses `{"error":{"code","message","field?"}}` with stable codes: `VALIDATION_ERROR`, `UNAUTHORIZED` (`TOKEN_INVALID`/`TOKEN_EXPIRED` also accepted), `FORBIDDEN`, `NOT_APPROVED`, `NOT_FOUND`, `STATE_CONFLICT`, `OFFER_EXPIRED`, `BUSINESS_RULE`.

## 4. Files created

```
services/s4-towing/
  README.md                 this log
  TOWING_SERVICE.md         old brief, moved here unchanged (superseded)
  manage.py  requirements.txt  .env.example  .gitignore
  setup.ps1  run.ps1  test.ps1  check.ps1     Windows / PowerShell
  setup.sh   run.sh   test.sh   check.sh      Linux / macOS (bash)
  config/          settings, urls, wsgi, asgi (port/env/CORS/DRF config)
  common/          auth (JWT), permissions, errors, handlers, pagination
  towing/          models, serializers, services (rules), views, urls, apps (expiry worker)
    migrations/0001_initial.py
    management/commands/seed.py
    tests/test_api.py
  seed/s4-towing.json              local copy of the contract seed (UUIDs and config)
  seed/tow-driver-profiles.json    display-name snapshots from the S1 seed
```

Only these paths were created/edited. No contract change, frontend change, or change to another service was made. This folder is committed locally on the `towing` branch; no push or PR has been made.

## 5. Run it

**Linux / macOS (bash):**

```bash
cd services/s4-towing
./setup.sh        # venv + packages + .env + migrate + seed + tests (use PYTHON=python3.12 ./setup.sh to pick the interpreter)
./run.sh          # http://localhost:4004
```

Other Linux commands:

```bash
./test.sh                         # 13 self-contained tests
./check.sh                        # contract check (needs S1 running for tokens)
./check.sh --write                # also runs the "Done when" scenario, then re-seeds
source .venv/bin/activate && python manage.py seed --reset   # restore demo data manually
```

`check.sh` installs the checker's npm dependencies on first use; set `S4_URL` / `S1_URL` if the services are not on localhost.

**Windows (PowerShell):** same operations through the equivalent wrappers:

```powershell
cd services\s4-towing
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # first time only
.\run.ps1                                              # http://localhost:4004
.\test.ps1                                             # 13 tests
.\check.ps1                                            # needs S1 running for tokens
.\check.ps1 -Write                                     # runs the "Done when" scenario, then re-seeds
.\.venv\Scripts\python.exe manage.py seed --reset      # restore demo data manually
```

For the real frontend instead of mocks, set `VITE_MOCK_S4=false` in `frontend/.env.local` (no frontend file was changed here) and start S1 for login tokens; S4 itself still makes no outbound calls. On Linux, start S1 with `cd services/s1-identity && source .venv/bin/activate && python manage.py runserver 0.0.0.0:4001` and the frontend with `cd frontend && npm run dev`.

## 6. Seed data

`manage.py seed` copies the contract's two tow drivers (`…0008`, `…0009`) with their plates/positions and the demo SOS (`…0601`, code `SOS-DEMO01`), plus `TowConfig(pk=1)`. It is idempotent (`update_or_create`); `--reset` first clears S4's own tables. Seed values, not `.env`, win for the 30 s / 3 offers / base fee / per-km rules so the service matches the shared demo data.

## 7. Verification (what was actually run)

1. `manage.py makemigrations towing`, `manage.py migrate`, `manage.py seed --reset` — clean.
2. `manage.py test` — **13 tests, OK** (health, roles/auth, guest SOS, tracking-code access, availability/approval, first-accept-wins, decline chain to `NO_DRIVER`, lazy expiry, status flow, live tracking, cancellation, dispatch/fleet/manual assign, service-key callback, error envelope).
3. Full contract checker (`tools/contract-check/lib/engine.mjs`) against the running service with `--write`: **25 PASS, 0 FAIL, 1 WARN**. The single WARN is the checker's standing reminder to re-seed after a write run; `manage.py seed --reset` was run again afterwards. All security sweeps (no/garbage/expired/wrong-secret token, wrong role, not approved, missing/wrong service key), reads, CORS preflight and the S4 "Done when" scenario passed.
   - The checker normally needs S1 to log in. To avoid starting or modifying a teammate's service, it was run from a **temporary copy in `/tmp/opencode`** with a tiny fake S1 that only mints HS256 tokens from the shared seed IDs/secret. Nothing in the repo outside this folder was written.
4. Linux wrappers smoke-tested here: `./setup.sh` (13 tests OK), `./run.sh` + `GET /health` → 200 JSON.
5. Only `services/s4-towing/` was changed; the work is committed locally on branch `towing` (no push/PR).

Problems found and fixed during verification, kept here for the next teammate:

- `path("")` in `towing/urls.py` only matched `/api/v1/`; the SOS route was shadowed by the detail route. Added the explicit `tows` prefix to every tow path.
- Django 5 removed `django.utils.timezone.utc`; switched to `datetime.timezone.utc` in the ISO formatter.
- `/track` sent `etaMinutes: null` when no driver was assigned, which the checker's JSON schema rejects. The optional field is now omitted until an ETA exists.
- `runserver`'s auto-reloader calls `AppConfig.ready()` in both the watcher and the serving child, which started two expiry threads. The worker now starts only in the serving process (`RUN_MAIN=true`, or when `--noreload` is used).

## 8. Deliberately not done

- No contract/CHANGELOG edit: no API change was needed.
- No frontend, S1, S5 or S6 change; no `OTP_FIXED_CODE`; no calls to any of them.
- No PostgreSQL/PostGIS server, Redis, Celery, Docker, WebSocket, SMS or email vendor — none is needed for this contract and the user asked for Django's built-in SQLite.
- The original brief's port/prefix/role/status/infrastructure choices were **not** carried over; see section 1.
- No push or PR (not requested); only the local commit on branch `towing`.
