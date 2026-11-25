# DriveFix API contract v1.1

What changed since v1.0: see **`CHANGELOG.md`** (additive only).

**What's inside**

- **`openapi/`:** one file per service, built from the spec. Each lists the roles allowed per endpoint and the shared error format. Paste a file into ==🟢**editor.swagger.io**== to read it.

- **`seed/`:** shared demo data with the same IDs in every service. It has 11 users (admin, 2 drivers, 2 suppliers plus a pending one, 2 mechanics, 2 tow drivers, a dispatcher), 6 parts, 8 offers, delivery fees, a sample order, a booking, a tow request and message templates in Arabic, French and English. All demo accounts use `Password123`, which the seed script should hash.


- **`.env.example`:** ports, shared JWT secret, service key and the other services' URLs. Teammates on different PCs replace `localhost` with the PC's LAN IP.


- **`README.md`:** the rules every service follows, stable error codes and the demo account list.


## Services and ports
| Service         | Port | Owner    |
| --------------- | ---- | -------- |
| S1 Identity     | 4001 | Chafie   |
| S2 Parts        | 4002 | Person A |
| S3 Mechanic     | 4003 | Person B |
| S4 Towing       | 4004 | Person C |
| S5 Payment      | 4005 | Person D |
| S6 Notification | 4006 | Person E |

## Rules for everyone
- Base path `/api/v1`, JSON only, camelCase, UUID ids, ISO 8601 UTC dates, money = integer DZD.
- Auth: `Authorization: Bearer <JWT>`. Claims: `sub`, `role`, `approved`, `exp`. Verify with the shared `JWT_SECRET`. Do not call S1 to check a token.
- Service-to-service calls use header `X-Service-Key: <SERVICE_KEY>`.
- Roles: DRIVER, SUPPLIER, MECHANIC, TOW_DRIVER, DISPATCHER, ADMIN. SUPPLIER, MECHANIC, TOW_DRIVER actions need `approved: true` (else 403 `NOT_APPROVED`).
- Error body always: `{ "error": { "code": "OTP_EXPIRED", "message": "...", "field": "code" } }`
- Lists: `?page=1&pageSize=20` -> `{ items, page, pageSize, total }`.
- `GET /health` -> `{ "status": "ok" }`, no auth.
- Calls to S6 use a 2 s timeout and ignore failures.
- Each service has a seed script that loads `seed/<service>.json`. Same ids everywhere. All demo accounts use password `Password123` (hash it when seeding).

## Stable error codes (minimum)
VALIDATION_ERROR, UNAUTHORIZED (401; TOKEN_INVALID and TOKEN_EXPIRED are also accepted), FORBIDDEN, NOT_APPROVED, NOT_FOUND, STATE_CONFLICT,
PHONE_TAKEN, OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED, ACCOUNT_LOCKED, INVALID_CREDENTIALS,
OUT_OF_STOCK, SLOT_TAKEN, TOO_LATE, OFFER_EXPIRED, SESSION_EXPIRED, ALREADY_REVIEWED.

## Demo accounts (seed)
| Phone                  | Role                        |
| ---------------------- | --------------------------- |
| 0555000001             | ADMIN                       |
| 0555000002, 0555000003 | DRIVER                      |
| 0555000004, 0555000005 | SUPPLIER (approved)         |
| 0555000011             | SUPPLIER (pending approval) |
| 0555000006, 0555000007 | MECHANIC                    |
| 0555000008, 0555000009 | TOW_DRIVER                  |
| 0555000010             | DISPATCHER                  |

## Check your service before the demo
Run the contract checker from `tools/contract-check/` (see its README): it logs in to S1, checks health, CORS, every operation, security and, with `--write`, your "Done when" scenario.

## Done when
Every endpoint in your file works with the right role and the shared error format, the seed loads with one command, and your "Done when" sentence from the spec can be shown live.
