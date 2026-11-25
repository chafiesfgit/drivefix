# S1 Identity - DriveFix

Accounts, OTP verification, login (JWT), password reset, role applications and admin approval.
Port **4001** - database **auth_db** - API base `http://localhost:4001/api/v1`

Stack (cahier des charges): Python 3.12, Django 5.0, Django REST Framework 3.15, SimpleJWT, bcrypt, PostgreSQL.

---

## 1. Run it (Windows, 3 commands)

```powershell
cd services\s1-identity
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # once: venv, packages, tables, demo data, tests
.\run.ps1                                                  # start the service
```

Check: open http://localhost:4001/health -> `{"status":"ok","service":"s1-identity","db":"up"}`

`setup.ps1` needs **Python 3.12** (`py -3.12 --version`). Python 3.14/3.15 will not work (no PostgreSQL driver for it yet).
If PostgreSQL is not installed yet, setup automatically uses a local SQLite file so you can start right away.

### PostgreSQL (when you are ready)
1. Install PostgreSQL 15 or 16 (https://www.postgresql.org/download/windows/), remember the `postgres` user password.
2. Create the database:
   ```powershell
   psql -U postgres -c "CREATE DATABASE auth_db;"
   ```
   (`psql` is in `C:\Program Files\PostgreSQL\16\bin`; or use pgAdmin -> right click Databases -> Create -> `auth_db`.)
3. Edit `.env`: `DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/auth_db`
4. `.\.venv\Scripts\python.exe manage.py migrate` then `... manage.py seed`.

### Demo accounts (after `seed`)
Password for all: `Password123`

| Phone | Role | Note |
|---|---|---|
| 0555000001 | ADMIN | |
| 0555000002 / 03 | DRIVER | |
| 0555000004 / 05 | SUPPLIER | approved |
| 0555000006 / 07 | MECHANIC | approved |
| 0555000008 / 09 | TOW_DRIVER | approved |
| 0555000010 | DISPATCHER | |
| 0555000011 | SUPPLIER | **pending approval** (admin demo) |

### Where is the OTP code? (no real SMS in V2)
Every code is **random**. It is printed in the window where `run.ps1` runs, in a block that is easy to spot:

```
================================================================
 DriveFix OTP   phone 0551234567   code 483920   valid 5 min
================================================================
```

If S6 is running it also receives the notification (type `OTP_CODE` or `PASSWORD_RESET`) and a mock SMS (`POST /sms`), so the code shows in the admin SMS log too.

### Reach S1 from another PC (teammates)
- `run.ps1` already listens on all interfaces (`0.0.0.0:4001`) and `ALLOWED_HOSTS` defaults to `*`, so `http://YOUR-LAN-IP:4001` works.
- Open the port in Windows Firewall once (PowerShell **as administrator**): `powershell -ExecutionPolicy Bypass -File .\open-port.ps1`
- Find your LAN IP with `ipconfig` (IPv4 Address, e.g. 192.168.1.10). Teammates use `http://192.168.1.10:4001/api/v1`.
- `CORS_ORIGIN` in `.env` accepts several origins separated by commas (e.g. `http://localhost:5173,http://192.168.1.10:5173`).

---

## 2. What is inside

```
s1-identity/
  manage.py              Django command line (migrate, seed, test, runserver)
  config/
    settings.py          ALL configuration, read from .env
    urls.py              /health + /api/v1/...
  common/                Code every service shares (copy it to S2..S6 if you want the same behaviour)
    errors.py            ApiError -> {"error":{"code","message","field"}}
    handlers.py          turns every exception into that JSON format
    auth.py              issue_token() + JWTAuthentication (reads Bearer token)
    permissions.py       IsAdminRole, HasServiceKey (X-Service-Key)
    pagination.py        {"items","page","pageSize","total"}
    throttles.py         rate limit on /auth/*
    hashers.py           bcrypt
  accounts/
    models.py            User, OtpCode, Application, AuditLog
    serializers.py       input validation (camelCase) + output format
    services.py          ALL business rules (OTP, lockout, approval...)  <- read this first
    views.py / urls.py   the 13 endpoints, thin layer over services.py
    notify.py            call to S6 (2 s timeout, failure ignored)
    management/commands/seed.py   loads seed/s1-identity.json
    tests/               46 tests (flows + contract check)
  seed/s1-identity.json  demo data from the API contract
  docs/s1-identity.yaml  the OpenAPI contract (tests compare every response with it)
```

Rule of thumb: **a rule changes -> edit `services.py`; a field changes -> `serializers.py` + `models.py` (+ `makemigrations`).**

---

## 3. Endpoints (all under `/api/v1`)

| Method | Path | Who | Result |
|---|---|---|---|
| POST | /auth/register | anyone | 201 `{userId, otpSentTo}` |
| POST | /auth/verify-otp | anyone | 200 `{token, user}` |
| POST | /auth/resend-otp | anyone | 204 |
| POST | /auth/login | anyone | 200 `{token, user}` |
| POST | /auth/refresh | any authenticated user | 200 `{token, user}` with the current `approved` flag (v1.1) |
| POST | /auth/forgot-password | anyone | 204 (always, even if phone unknown) |
| POST | /auth/reset-password | anyone | 204 |
| GET / PATCH | /users/me | logged in | user (PATCH: `fullName`, `language`) |
| GET | /users/{id}/public | other services (`X-Service-Key`) | `{id, fullName, phone}` |
| GET | /admin/applications?status=&page=&pageSize= | ADMIN | paged applications (default PENDING) |
| POST | /admin/applications/{id}/approve | ADMIN | application |
| POST | /admin/applications/{id}/reject | ADMIN | body `{reason}` required |
| GET | /admin/users?q=&role=&status=&page=&pageSize= | ADMIN | paged users |
| PATCH | /admin/users/{id}/status | ADMIN | body `{status: ACTIVE\|SUSPENDED, reason?}` |
| GET | /health (also /api/v1/health) | anyone | `{status, service, db}` |

Extra (additive, contract fields untouched): application items also contain `fullName` and `phone` so the admin screen can show them.

## 4. Business rules implemented

- Phone: Algerian mobile (`05/06/07 + 8 digits`); `+213...` is converted to `0...`. Unique -> `409 PHONE_TAKEN`.
- Password: minimum 8 characters, stored with **bcrypt**.
- Register -> status `PENDING_OTP`; OTP = 6 digits, valid **5 min**, **5 attempts**, resend gap **60 s**; codes are stored hashed, single use.
- After OTP: DRIVER -> `ACTIVE`, `approved=true`. SUPPLIER / MECHANIC / TOW_DRIVER -> `PENDING_APPROVAL`, `approved=false` until an admin approves.
  They can log in meanwhile (token has `approved:false`; the frontend shows the "waiting for approval" screen).
- Required extra fields: non-driver -> `wilaya`, `documentNumber`; SUPPLIER/MECHANIC -> `businessName`; TOW_DRIVER -> `vehiclePlate`.
- Login: 5 wrong passwords -> locked **15 min** (`403 ACCOUNT_LOCKED`); success resets the counter. Unknown phone and wrong password give the same `401 INVALID_CREDENTIALS`.
- JWT: HS256, valid **24 h**, claims `sub` (user id), `role`, `approved`, `exp` (+ `iat`, `jti`, `token_type`). Secret = `JWT_SECRET` (same in every service).
- Admin: approve / reject (reason required) an application; suspend / reactivate a user (cannot suspend yourself). A suspended user is refused everywhere (`403 ACCOUNT_SUSPENDED`).
- Every important action is written to the `audit_log` table.
- S6 notifications sent: `OTP_SIGNUP`, `OTP_RESET`, `ACCOUNT_PENDING`, `ACCOUNT_APPROVED`, `ACCOUNT_REJECTED` (S6 down = ignored).
- Rate limit: `THROTTLE_AUTH` (default 60/min per IP) on `/auth/*` -> `429 RATE_LIMITED`.

### Error format (every error)
```json
{ "error": { "code": "OTP_EXPIRED", "message": "Code expired, request a new one", "field": "code" } }
```
Codes: `VALIDATION_ERROR` 400 - `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_INVALID`, `TOKEN_EXPIRED` 401 -
`FORBIDDEN`, `ACCOUNT_LOCKED`, `ACCOUNT_SUSPENDED`, `PHONE_NOT_VERIFIED` 403 - `NOT_FOUND` 404 - `PHONE_TAKEN`, `STATE_CONFLICT` 409 -
`OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_RESEND_TOO_SOON` 422 - `RATE_LIMITED` 429 - `INTERNAL_ERROR` 500.

---

## 5. How the other services use S1

**Verify a token (S2..S6)** - no call to S1 needed, only the shared secret:
```python
import jwt
claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])   # claims["sub"], ["role"], ["approved"]
```
**Get a user's name/phone (service-to-service):**
`GET http://localhost:4001/api/v1/users/{id}/public` with header `X-Service-Key: <SERVICE_KEY>`.

**Frontend:** send `Authorization: Bearer <token>`; CORS allows `CORS_ORIGIN` (default `http://localhost:5173`).

Quick test in PowerShell:
```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:4001/api/v1/auth/login -ContentType application/json `
     -Body '{"phone":"0555000001","password":"Password123"}'
Invoke-RestMethod -Uri http://localhost:4001/api/v1/admin/users -Headers @{Authorization="Bearer $($r.token)"}
```

---

## 6. Tests

`.\test.ps1` - 46 tests: registration, OTP rules, lockout, reset, profile, admin approval, suspension, service key, seed,
and a contract test that validates every response against `docs/s1-identity.yaml`. Tested on SQLite and PostgreSQL 16.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `Python 3.12 not found` | install from python.org, tick "Add python.exe to PATH", rerun `setup.ps1` |
| `password authentication failed` | wrong password in `DATABASE_URL` |
| `database "auth_db" does not exist` | create it (section 1) |
| Browser blocked by CORS | put the frontend URL in `CORS_ORIGIN` (comma separated) |
| Port 4001 in use | close the other window running S1 |
| Want a clean database | `manage.py seed --reset` |

## 8. Done / next

Done: all 13 contract endpoints + health, OTP, lockout, JWT, admin approval, audit log, seed, tests.
Next (optional, after the defence demo): Redis for rate limit/cache, real SMS provider through S6, Dockerfile, refresh tokens.
