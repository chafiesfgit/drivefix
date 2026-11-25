# DriveFix: connect your service to the frontend

This page is for the team (S2 Parts, S3 Mechanic, S4 Towing, S5 Payment, S6 Notification).
Read it once, follow section 2, then run the checker in section 5. You should not need to ask Chafie anything.

**Words used here**

- **Frontend**: the website (React). It runs in the browser on Chafie's PC at `http://localhost:5173`.
- **Service**: your backend (S2...S6). It runs on your PC and answers JSON on a port (4002...4006).
- **Contract**: the shared rules for every service: `contract/` (OpenAPI files, seed data, `.env.example`, `CHANGELOG.md`). If your service follows it, the frontend works with it.
- **Mock**: a fake copy of your service that runs inside the browser. Until your service is ready, the frontend uses the mock.
- **JWT**: the login token made by S1. The browser sends it in the header `Authorization: Bearer <token>`. You check it with the shared `JWT_SECRET`, you never call S1 for it.
- **CORS**: a browser safety rule. The browser only lets the website call your service if your service says "I accept calls from http://localhost:5173". Without it, every call fails, even though Postman works.
- **LAN IP**: your PC's address on the Wi-Fi, for example `192.168.1.20`. Other PCs on the same Wi-Fi reach you with it.

---

## 1. What runs where

```
 Chafie's PC                                   Your PC (same Wi-Fi)
 +-------------------------------+             +------------------------------+
 | Browser                       |   HTTP      | Your service (S2..S6)        |
 |  DriveFix frontend :5173  ----+------------>|  http://YOUR-IP:400x/api/v1  |
 |   - S1 calls  -> S1 :4001     |   JSON      |  own database                |
 |   - Sx calls  -> your service |             +------------------------------+
 |     (or the mock in the       |
 |      browser until you are    |             S1 Identity :4001 (Chafie's PC)
 |      ready)                   |             gives the JWT to everyone
 +-------------------------------+
```

- S1 Identity is real and runs on Chafie's PC (port 4001). It logs users in and creates the JWT.
- S2 to S6 are mocked in the browser until each of you is ready. Then Chafie switches one service at a time to your real one.
- The page `http://localhost:5173/status` shows, for each service, if it is **Real** or **Mock**, the URL in use, and if it answers right now.

## 2. How to see YOUR service inside the frontend

1. **Listen on all interfaces.** Start your service on `0.0.0.0`, not only `127.0.0.1`:
   - Django: `python manage.py runserver 0.0.0.0:4002`
   - Node/Express: `app.listen(4002, '0.0.0.0')`
   - Spring Boot: `server.address=0.0.0.0`
2. **Find your LAN IP.** In PowerShell: `ipconfig`, line "IPv4 Address" (for example `192.168.1.20`).
3. **Open your port in Windows Firewall** (PowerShell **as administrator**, change the port):
   ```powershell
   New-NetFirewallRule -DisplayName "DriveFix S2 (4002)" -Direction Inbound -Protocol TCP -LocalPort 4002 -Action Allow -Profile Private,Domain
   ```
   Your Wi-Fi must be set to "Private network" in Windows settings.
4. **Same Wi-Fi.** Both PCs on the same network (a phone hotspot works too).
5. **Allow CORS** for `http://localhost:5173`, headers `Authorization` and `Content-Type`, and methods `GET, POST, PUT, PATCH, DELETE`. Put it in your `.env`: `CORS_ORIGIN=http://localhost:5173`.
6. **Use the shared secrets** from the contract `.env.example`: same `JWT_SECRET`, same `SERVICE_KEY`.
7. **Run the checker** (section 5) until it says READY.
8. **Send Chafie** your URL, for example `http://192.168.1.20:4002/api/v1`, and the file `contract-check-report.md`.
   Chafie sets `VITE_S2_URL=http://192.168.1.20:4002/api/v1` and `VITE_MOCK_S2=false` in the frontend `.env`, restarts it, and your service is live.

S1 is reachable the same way: `http://CHAFIE-IP:4001/api/v1` (S1 listens on `0.0.0.0` and Chafie opens port 4001 with `services/s1-identity/open-port.ps1`).

## 3. What the frontend calls, per service

Generated from the frontend code (`src/api/s1..s6.ts` and `src/api/models.ts`) by `node scripts/gen-integration-table.mjs`. Not invented.
"Optional extras" are fields the screens show **if you send them** (for example a part name inside an order line). If you do not send them, the screen shows a fallback. They are nice to have, not required.

### S1 Identity

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s1.register` | `POST /auth/register` | `{ userId: string; otpSentTo: string }` |
| `s1.verifyOtp` | `POST /auth/verify-otp` | `AuthResult` |
| `s1.resendOtp` | `POST /auth/resend-otp` | `(no body: 204)` |
| `s1.login` | `POST /auth/login` | `AuthResult` |
| `s1.forgotPassword` | `POST /auth/forgot-password` | `(no body: 204)` |
| `s1.resetPassword` | `POST /auth/reset-password` | `(no body: 204)` |
| `s1.refresh` | `POST /auth/refresh` | `AuthResult` |
| `s1.me` | `GET /users/me` | `User` |
| `s1.updateMe` | `PATCH /users/me` | `User` |
| `s1.applications` | `GET /admin/applications` | `Paged<Application>` |
| `s1.approve` | `POST /admin/applications/{id}/approve` | `Application` |
| `s1.reject` | `POST /admin/applications/{id}/reject` | `Application` |
| `s1.users` | `GET /admin/users` | `Paged<User>` |
| `s1.setUserStatus` | `PATCH /admin/users/{id}/status` | `User` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| User | id*, fullName*, phone*, role*, language*, status*, approved*, createdAt* | - |
| Application | id*, userId*, role*, businessName, wilaya, documentNumber, vehiclePlate, status*, reason, createdAt* | fullName, phone |

### S2 Parts

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s2.parts` | `GET /parts` | `Paged<Part>` |
| `s2.part` | `GET /parts/{id}` | `{ part: Part; offers: OfferWithSupplier[] }` |
| `s2.compare` | `GET /parts/compare` | `{ items: (OfferWithSupplier & { part?: Part })[] }` |
| `s2.myOffers` | `GET /offers` | `Paged<Offer & { part?: Part }>` |
| `s2.createOffer` | `POST /offers` | `Offer` |
| `s2.updateOffer` | `PATCH /offers/{id}` | `Offer` |
| `s2.deleteOffer` | `DELETE /offers/{id}` | `(no body: 204)` |
| `s2.placeOrder` | `POST /orders` | `Order` |
| `s2.orders` | `GET /orders` | `Paged<Order>` |
| `s2.order` | `GET /orders/{id}` | `Order` |
| `s2.setOrderStatus` | `PATCH /orders/{id}/status` | `Order` |
| `s2.reviewOrder` | `POST /orders/{id}/review` | `Review` |
| `s2.supplierReviews` | `GET /suppliers/{id}/reviews` | `{ average: number; items: (Review & { authorName?: string })[] }` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| Part | id*, name*, brand*, category*, reference, compatibleVehicles, imageUrl | partName, supplierName |
| OfferWithSupplier | id*, partId*, supplierId*, price*, stock*, condition*, warrantyMonths, deliveryWilayas, active* | supplierName, supplierRating, supplierWilaya |
| Offer | id*, partId*, supplierId*, price*, stock*, condition*, warrantyMonths, deliveryWilayas, active* | partName, supplierName |
| Order | id*, driverId*, status*, paymentMethod*, deliveryAddress*, wilaya*, deliveryFee*, total*, items*, createdAt*, payUrl | cancelReason |
| Review | id*, orderId*, supplierId*, rating*, comment, createdAt* | - |

### S3 Mechanic

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s3.mechanics` | `GET /mechanics` | `Paged<MechanicProfile>` |
| `s3.mechanic` | `GET /mechanics/{id}` | `{ profile: MechanicProfile; services: MechanicService[]; reviews: MechanicReview[] }` |
| `s3.slots` | `GET /mechanics/{id}/slots` | `{ date: string; slots: string[] }` |
| `s3.saveProfile` | `PUT /mechanics/me` | `MechanicProfile` |
| `s3.myServices` | `GET /mechanics/me/services` | `{ items: MechanicService[] }` |
| `s3.createService` | `POST /mechanics/me/services` | `MechanicService` |
| `s3.updateService` | `PATCH /mechanics/me/services/{id}` | `MechanicService` |
| `s3.deleteService` | `DELETE /mechanics/me/services/{id}` | `(no body: 204)` |
| `s3.book` | `POST /bookings` | `Booking` |
| `s3.bookings` | `GET /bookings` | `Paged<Booking>` |
| `s3.setBookingStatus` | `PATCH /bookings/{id}/status` | `Booking` |
| `s3.reviewBooking` | `POST /bookings/{id}/review` | `{ id: string; rating: number }` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| MechanicProfile | userId*, garageName*, wilaya*, address, lat, lng, specialties, workingHours, offersMobile*, bio, rating | reviewsCount |
| MechanicService | id*, mechanicId*, name*, price*, durationMin*, active* | serviceName, garageName, driverName, driverPhone |
| MechanicReview | (free-form) | id, bookingId, rating, comment, authorName, createdAt |
| Booking | id*, driverId*, mechanicId*, serviceId*, price*, date*, startTime*, place*, clientAddress, vehicle, note, status*, createdAt* | serviceName, garageName, driverName, driverPhone |

### S4 Towing

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s4.create` | `POST /tows` | `TowRequest` |
| `s4.get` | `GET /tows/{id}` | `TowDetail` |
| `s4.cancel` | `POST /tows/{id}/cancel` | `TowRequest` |
| `s4.setAvailability` | `PUT /tow-drivers/me/availability` | `{ available: boolean }` |
| `s4.sendPosition` | `PUT /tow-drivers/me/position` | `(no body: 204)` |
| `s4.myOffer` | `GET /tow-drivers/me/offer` | `TowOffer` |
| `s4.accept` | `POST /tow-offers/{id}/accept` | `TowRequest` |
| `s4.decline` | `POST /tow-offers/{id}/decline` | `(no body: 204)` |
| `s4.setStatus` | `PATCH /tows/{id}/status` | `TowRequest` |
| `s4.track` | `GET /tows/{id}/track` | `{ last: Position; trail: Position[]; etaMinutes?: number }` |
| `s4.board` | `GET /dispatch/tows` | `Paged<TowRequest>` |
| `s4.fleet` | `GET /dispatch/tow-drivers` | `{ items: (TowDriverInfo & { busy?: boolean; positionAt?: string })[] }` |
| `s4.assign` | `POST /dispatch/tows/{id}/assign` | `TowRequest` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| TowRequest | id*, driverId, guestPhone, trackingCode*, pickupLat*, pickupLng*, pickupAddress, destinationAddress, vehicle, issue, urgency*, status*, estimatedPrice, assignedTowDriverId, etaMinutes, createdAt* | userId, fullName, phone, plate, truckType, available, lat, lng |
| TowOffer | id*, requestId*, pickupAddress, distanceKm, estimatedPrice, secondsLeft*, status* | userId, fullName, phone, plate, truckType, available, lat, lng |
| Position | lat*, lng*, at* | userId, fullName, phone, plate, truckType, available |
| TowDriverInfo | (free-form) | userId, fullName, phone, plate, truckType, available, lat, lng |

### S5 Payment

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s5.payments` | `GET /payments` | `Paged<Payment>` |
| `s5.payment` | `GET /payments/{id}` | `Payment` |
| `s5.session` | `GET /pay/{id}` | `{ amount: number; label: string; expiresAt: string; demo: boolean }` |
| `s5.succeed` | `POST /pay/{id}/succeed` | `Payment` |
| `s5.fail` | `POST /pay/{id}/fail` | `Payment` |
| `s5.cashCollected` | `POST /payments/{id}/cash-collected` | `Payment` |
| `s5.refund` | `POST /payments/{id}/refund` | `Payment` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| Payment | id*, refType*, refId*, payerId*, amount*, method*, status*, createdAt*, paidAt, payUrl | page, pageSize, total |

### S6 Notification

| Frontend call | Endpoint | Response it expects |
| --- | --- | --- |
| `s6.list` | `GET /notifications` | `Paged<Notification>` |
| `s6.unreadCount` | `GET /notifications/unread-count` | `{ count: number }` |
| `s6.markRead` | `PATCH /notifications/{id}/read` | `Notification` |
| `s6.markAllRead` | `POST /notifications/read-all` | `(no body: 204)` |
| `s6.smsLog` | `GET /admin/sms-log` | `{ items: { id: string; phone: string; text: string; status: string; createdAt: string }[] }` |

| Object | Contract fields it reads (`*` = required) | Optional extras shown when present |
| --- | --- | --- |
| Notification | id*, userId*, type*, title*, body*, read*, createdAt* | page, pageSize, total |

## 4. The 10 most common mistakes (and the one-line fix)

| # | Mistake | Fix |
| --- | --- | --- |
| 1 | **CORS** not enabled: the browser blocks every call (Postman still works, so it looks fine). | Allow origin `http://localhost:5173`, headers `Authorization, Content-Type`, methods `GET, POST, PUT, PATCH, DELETE`. |
| 2 | **JWT_SECRET differs** from the shared one: every token from S1 is refused (401). | Copy `JWT_SECRET` from the contract `.env.example`, algorithm HS256. |
| 3 | **Claim names** wrong: reading `user_id` or `userId` instead of `sub`. | Claims are exactly `sub` (user id), `role`, `approved`, `exp`. |
| 4 | **snake_case** JSON keys (`delivery_fee`). | Use camelCase everywhere: `deliveryFee`, `createdAt`. |
| 5 | **Ids are numbers** (`1`, `2`). | Ids are UUID strings. Use the seed ids, they are the same in every service. |
| 6 | **Money with decimals** (`4500.0`, `"4500"`). | Money is an integer number of DZD: `4500`. |
| 7 | **Error format** different (`{"detail": "..."}`, HTML error page). | Always `{"error": {"code": "UPPER_SNAKE", "message": "...", "field": "..."}}`, JSON, never HTML. |
| 8 | **Lists without the envelope** (a bare array). | Lists answer `{ items, page, pageSize, total }` and accept `?page=1&pageSize=20`. |
| 9 | **Check order** wrong: wrong role answers 400 or 404. | No/invalid token → 401, then wrong role → 403 `FORBIDDEN`, then body → 400, then business rules. |
| 10 | **Forgetting `approved`**: a pending supplier/mechanic/tow driver can act. | If the JWT says `approved: false` on a "(approved)" route → 403 `NOT_APPROVED`. |

## 5. Run the contract checker before saying "it is done"

The checker is the folder `tools/contract-check/` in this repository. You need Node.js 18 or newer (`node --version`).

```powershell
cd tools/contract-check
npm install
.\check.ps1 -Service s2 -Url http://localhost:4002/api/v1 -S1 http://CHAFIE-IP:4001/api/v1
```

- It logs in to S1 with the seed accounts (S1 must be running), then checks: health, **CORS**, every operation of your service (status code + JSON shape), and security (no token, bad token, expired token, token signed with another secret, wrong role, not approved, missing service key).
- Add `-Write` to also run your **"Done when" scenario** with real writes (orders, bookings, tows, payments...). Re-seed your database afterwards.
- Result: a coloured list (PASS / FAIL / WARN, each FAIL says how to fix it) and the file `contract-check-report.md`. **Send that file to Chafie.**
- Not ready while there is a FAIL. A WARN is information (for example an optional v1.1 endpoint you did not build).

## 6. What changed in contract v1.1 (25/11/2026)

Only **additions**: nothing was renamed or removed, a v1.0 service still works. Details in `contract/CHANGELOG.md`.

- **S1**: new `POST /auth/refresh` (fresh token with the current `approved` flag). S1 now sends the spec template types to S6 (`OTP_CODE`, `PASSWORD_RESET`, `ACCOUNT_APPROVED`, `ACCOUNT_REJECTED`) and calls `POST /sms` for codes.
- **S2 (Person A)**: optional `payUrl` on `Order` (`POST /orders`, `GET /orders/{id}`), only for SANDBOX orders still PENDING. Copy it from the S5 `POST /payments` answer.
- **S3 (Person B)**: `GET /mechanics/{id}/slots` accepts an optional `serviceId`. Slot length = that service's `durationMin`.
- **S4 (Person C)**: optional `GET /dispatch/tow-drivers` (DISPATCHER, ADMIN) for the fleet map: `userId, fullName, plate, truckType, available, busy, lat, lng, positionAt`.
- **S5 (Person D)**: optional `payUrl` on `Payment` (`GET /payments`, `GET /payments/{id}`), only while a SANDBOX payment is PENDING.
- **S6 (Person E)**: make sure templates `OTP_CODE` and `PASSWORD_RESET` exist; `POST /sms` must save into the SMS log.
- **All**: 401 codes may be `UNAUTHORIZED` (preferred), `TOKEN_INVALID` or `TOKEN_EXPIRED`.

### Not in the contract, handled locally by the frontend

- **Tow driver job history**: kept on the tow driver's device (no endpoint).
- **Admin moderation** (hide a part listing): local only, for the demo; nothing is sent to S2.
- **Admin settings**: read-only page that shows the business rules of the spec (OTP 5 min, lock 15 min, offer 30 s, tow fee, cancel 2 h). Fixed values, no endpoint.

## 7. Definition of done, per service

Copied from *DriveFix — Backend Spec per Service*. Tick every line before the integration day.

**Every service**
- [ ] Every endpoint in your OpenAPI file works with the right role and the shared error format.
- [ ] The seed loads with one command (same ids as everyone).
- [ ] `GET /health` answers `{"status":"ok"}` without a token.
- [ ] CORS allows `http://localhost:5173`.
- [ ] The contract checker says READY (0 FAIL), and you sent `contract-check-report.md`.
- [ ] Your "Done when" sentence can be shown live:

| Service | Done when |
| --- | --- |
| S1 Identity | A driver can register, verify, log in, reset a password, and an admin can approve a supplier whose token then has `approved: true`. |
| S2 Parts | A driver finds a part, compares offers, orders with cash on delivery, and the supplier sees, confirms and delivers it with stock updating. |
| S3 Mechanic | A driver picks a mechanic, books a free slot, the mechanic accepts it, and the booking ends DONE with a review. |
| S4 Towing | One SOS request is offered to a driver, accepted within 30 s, tracked live on a map until completion, and an expired offer moves to the next driver. |
| S5 Payment | An online order goes through the sandbox page to PAID or FAILED and the order updates, and a cash order is closed by the supplier. |
| S6 Notification | S1 sends an OTP that appears in the SMS log, and an order status change shows on the bell of the right user. |
