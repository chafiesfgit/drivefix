# DriveFix contract changelog

## v1.1 (25/11/2026)

All changes are **additive**: new optional fields and new endpoints. Nothing was renamed or removed, so a service built on v1.0 still works. Every OpenAPI file now says `version: 1.1.0`.

| Service | Change | Who must act |
| --- | --- | --- |
| S1 Identity | New `POST /auth/refresh` (any authenticated user). Returns a fresh `{ token, user }` with the current role, status and `approved` flag. A pending supplier/mechanic/tow driver gets `approved: true` right after the admin approves, without signing in again. Suspended accounts get 403 `ACCOUNT_SUSPENDED`. | Done (Chafie). |
| S1 Identity | S1 now calls S6 with the spec's template types: `OTP_CODE` (sign-up code), `PASSWORD_RESET` (reset code), `ACCOUNT_APPROVED`, `ACCOUNT_REJECTED` (+ `ACCOUNT_PENDING`, ignore it if you have no template). For codes it also calls `POST /sms`, so the OTP appears in the admin SMS log. | Person E (S6): make sure the `OTP_CODE` and `PASSWORD_RESET` templates exist. |
| S2 Parts | `Order.payUrl` (string, optional) in `POST /orders` and `GET /orders/{id}`. Only for `SANDBOX` orders that are still `PENDING`: copy the `payUrl` that S5 `POST /payments` returned. Omit it otherwise. | Person A (S2). |
| S3 Mechanic | `GET /mechanics/{id}/slots` accepts an optional `serviceId` query parameter. The slot length is that service's `durationMin` (default: the mechanic's shortest active service). | Person B (S3). |
| S4 Towing | New optional `GET /dispatch/tow-drivers` (DISPATCHER, ADMIN): `{ items: [TowDriverSummary] }` with `userId`, `fullName`, `plate`, `truckType`, `available`, `busy`, `lat`, `lng`, `positionAt`. Used by the dispatcher fleet map. Without it the frontend shows the seed drivers. | Person C (S4), nice to have. |
| S5 Payment | `Payment.payUrl` (string, optional) in `GET /payments` and `GET /payments/{id}`. Only for `SANDBOX` payments that are still `PENDING`. | Person D (S5). |
| All | 401 error codes: `UNAUTHORIZED` is preferred; `TOKEN_INVALID` and `TOKEN_EXPIRED` are also accepted. | Nobody. |

## v1.0 (22/11/2026)

First shared version: one OpenAPI file per service, shared seed data, `.env.example`, README.
