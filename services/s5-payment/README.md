# S5 Payment (port 4005)

Django 5 service. Follows `contract/openapi/s5-payment.yaml` (v1.1).

## Run
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # once: venv, packages, .env, DB, seed
powershell -ExecutionPolicy Bypass -File .\run.ps1     # start on 0.0.0.0:4005
.\.venv\Scripts\python.exe manage.py test               # unit tests
.\.venv\Scripts\python.exe manage.py seed               # reload demo data
```
Health: http://localhost:4005/api/v1/health

## Rules implemented
- Status moves: PENDING -> PAID, PENDING -> FAILED, PAID -> REFUNDED. Anything else: 409 STATE_CONFLICT.
- `POST /payments` is idempotent per (refType, refId); the amount is never taken from a browser.
- Sandbox session lasts `SESSION_MINUTES` (15). After that: 410 SESSION_EXPIRED. The page shows `demo: true`.
- `payUrl` only for a SANDBOX payment still PENDING (`FRONTEND_URL/pay/{token}`).
- Cash: PENDING until a SUPPLIER (orders) or TOW_DRIVER (tows) calls `cash-collected`.
- After PAID/FAILED: S6 notification + callback to S2/S4, 2 s timeout, errors ignored.
- Every status change writes a row in `audit_log`.

## To agree with the team
- Callback S5 -> S2/S4 (not in the contract): `POST {S2_URL|S4_URL}/internal/payments/callback`
  body `{ refType, refId, paymentId, status }`, header `X-Service-Key`.
- S6 body used: `POST /notifications { userId, type: PAYMENT_PAID|PAYMENT_FAILED, variables: { amount } }`.
