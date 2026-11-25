# Towing Service (SOS) - What You Must Build

You own `services/towing_service/`. It is the **hardest service** of DriveFix: real-time, GPS, WebSocket, dispatch.
This file tells you what to build, in which order, and what to agree with the other team members.

Sources: functional spec (FP11 to FP14), technical spec (SOS + tracking rows), Figma file GP_WAMS (SOS section, status badges, timeline).

---

## 1. Your job in one paragraph

A driver whose car broke down presses **SOS**. The browser sends the GPS position. Your service creates the request,
finds the **nearest available tow trucks**, sends them the request, and the **first provider who accepts** gets the job.
The driver then follows the truck **live on a map** (position + ETA updated every 3 seconds) until it arrives.
An operator call reassures the driver. Everything is stored with a clear **status history**.

---

## 2. Requirements from the spec

| Ref | What | Criteria | Level |
|---|---|---|---|
| FP11 | Trigger an SOS with automatic GPS sending | Response < 5 s, precise GPS | Mandatory |
| FP12 | Automatic call from the central operator to reassure the driver | Call < 30 s | Mandatory |
| FP13 | Assign the nearest tow truck | Proximity algorithm, distance + availability | Mandatory |
| FP14 | Real-time tracking of the truck on a map | Update every 3 s, dynamic ETA | Mandatory |

Technical choices in the spec: **Django Channels 4 + WebSocket**, **PostGIS**, **Twilio** (auto call) or a free alternative,
**Google Maps API** (Leaflet + OpenStreetMap is a free alternative), Celery for async tasks.

Scope limits (first version): towing only in the northern wilayas **Alger, Oran, Constantine, Blida, Boumerdes**.
No insurance integration. No native mobile app.

From Figma: a provider must **accept** the request (no automatic forced assignment), **no guaranteed arrival time**
shown to the driver, emergency numbers shown on the SOS page, and a status timeline (Done / Current / Upcoming).

---

## 3. Your folder

```
services/towing_service/
|-- Dockerfile
|-- requirements.txt
|-- manage.py
|-- config/            # settings.py, urls.py, asgi.py (you must edit asgi.py for WebSocket)
+-- apps/
    |-- providers/     # TowProvider: profile, availability, last location
    |-- sos/           # SosRequest, SosOffer, dispatch.py, status flow, REST API
    |-- tracking/      # consumers.py, routing.py, WebSocket live position + ETA
    +-- calls/         # operator call (mock first, Twilio later)  -> create this app if missing
```

URL prefix (already generated): `/api/towing/<app>/`, for example `/api/towing/sos/requests/`.
Health check: `/health/`. Local port: `8004`.

---

## 4. Data models

No ForeignKey to users: users live in `auth_service`. Store only `user_id`.

**TowProvider** (`providers`)
- `user_id`, `company_name`, `phone`, `truck_plate`, `truck_type`, `wilaya`
- `is_available` (bool), `location` (Point), `last_seen_at`

**SosRequest** (`sos`)
- `driver_user_id`, `vehicle_vin` (optional), `location` (Point), `address_text` (optional), `note` (optional), `wilaya`
- `status`, `assigned_provider` (FK TowProvider, null), `eta_seconds`
- `created_at`, `accepted_at`, `arrived_at`, `completed_at`

**SosOffer** (`sos`) - one row per provider the request was sent to
- `request` (FK), `provider` (FK), `status` (sent / accepted / rejected / expired), `sent_at`, `responded_at`

**SosStatusHistory** (`sos`) - feeds the Figma timeline
- `request` (FK), `status`, `at`, `by_user_id`

---

## 5. Status flow

```
pending -> confirmed -> en_route -> arrived -> completed
   |           |
   |           +-> cancelled (driver cancels, with confirmation modal)
   +-> cancelled
   +-> no_provider   (nobody accepted after all search rounds)
```

- `pending`: request created, offers sent.
- `confirmed`: a provider accepted.
- `en_route`: the truck is moving to the driver.
- `arrived`, `completed`: set by the provider.
- Put these values in `shared/statuses.py` so the frontend and other services use the same words.
  `no_provider` is new: agree on it with the team.

---

## 6. Dispatch algorithm (FP13)

1. Driver sends position -> create `SosRequest` (`pending`) in a single fast call (< 5 s).
2. Find providers where `is_available = true`, `last_seen_at` < 60 s ago, inside radius R, sorted by distance (`ST_Distance`).
3. Round 1: R = 10 km, take the 3 nearest. Create one `SosOffer` each and push the offer to them (WebSocket group `provider_<id>`).
4. **First accept wins.** In the accept endpoint use a DB transaction with `select_for_update()` on the request:
   if it is still `pending`, set `assigned_provider`, status `confirmed`, mark the other offers `expired`.
   If it is already taken, return `409`.
5. If nobody accepts after 30-45 s (Celery delayed task): round 2 with R = 25 km (next providers), then round 3 with R = 50 km.
6. After the last round: status `no_provider`, notify the driver, show the emergency numbers.
7. Start simple: nearest-first and radius rounds. Do not build anything smarter before it works end to end.

---

## 7. REST API

All endpoints require a JWT (validated with `shared/jwt_auth.py`).

**Driver**
| Method | URL | Purpose |
|---|---|---|
| POST | `/api/towing/sos/requests/` | Create SOS (`lat`, `lng`, optional `note`, `vehicle_vin`) |
| GET | `/api/towing/sos/requests/{id}/` | Status, provider, ETA, timeline |
| POST | `/api/towing/sos/requests/{id}/cancel/` | Cancel |
| GET | `/api/towing/sos/requests/mine/` | My SOS history |

**Tow provider**
| Method | URL | Purpose |
|---|---|---|
| GET / PATCH | `/api/towing/providers/me/` | Profile |
| POST | `/api/towing/providers/me/availability/` | Set available / busy |
| POST | `/api/towing/providers/me/location/` | Send position (HTTP fallback) |
| GET | `/api/towing/sos/offers/` | Pending offers for me |
| POST | `/api/towing/sos/requests/{id}/accept/` | Accept |
| POST | `/api/towing/sos/requests/{id}/reject/` | Reject (request stays pending) |
| POST | `/api/towing/sos/requests/{id}/status/` | Move to `en_route`, `arrived`, `completed` |

**Admin**
| Method | URL | Purpose |
|---|---|---|
| GET | `/api/towing/providers/` | List providers |
| GET | `/api/towing/sos/requests/` | All requests |

Write the OpenAPI contract (`docs/api-contracts/towing.yaml`) before coding these, so the frontend can start with mocks.

---

## 8. WebSocket tracking (FP14)

- URL: `ws://.../ws/towing/requests/<request_id>/`
- Browsers cannot set headers on a WebSocket: send the JWT as `?token=...` and validate it in a small auth middleware.
- Who can join: the driver of that request, the assigned provider, and admins. Nobody else.
- Provider sends every 3 s: `{"type": "location", "lat": 36.7, "lng": 3.05}`
- Server broadcasts to the group `request_<id>`:
  `{"type": "position", "lat": ..., "lng": ..., "eta_seconds": 540, "status": "en_route"}`
- ETA: start with `distance / 40 km/h`. Upgrade to a routing API only if you have time.
- Keep the latest position in Redis. Save to the database every ~10 s, not on every message.
- Provider offers use another group: `provider_<id>`, message `{"type": "offer", "request_id": ...}`.

`config/asgi.py` generated by the script is plain HTTP. Replace it with `ProtocolTypeRouter`
(`http` -> Django, `websocket` -> your auth middleware + `tracking/routing.py`).
Run with Daphne: `daphne -b 0.0.0.0 -p 8004 config.asgi:application`.

---

## 9. Operator call (FP12)

- After `sos.created`, a Celery task must trigger the call in < 30 s.
- Build an interface `CallProvider` with two classes: `MockCallProvider` (logs the call + sends an SMS event) and `TwilioCallProvider`.
- Use the mock by default. Switch to Twilio only if you have an account and time. The mock is enough to demonstrate the flow.
- Log every call attempt (status, error) in a `CallLog` table.

---

## 10. Events (with the Notification owner)

You publish on Redis Streams (`shared/events.py`):

| Event | When | Payload |
|---|---|---|
| `sos.created` | request created | `request_id`, `driver_user_id`, `lat`, `lng` |
| `sos.accepted` | provider accepted | `request_id`, `provider_id`, `driver_user_id`, `eta_seconds` |
| `sos.arrived` | truck arrived | `request_id`, `driver_user_id` |
| `sos.completed` | job done | `request_id`, `driver_user_id` |
| `sos.cancelled` | cancelled | `request_id` |
| `sos.no_provider` | nobody accepted | `request_id`, `driver_user_id` |

The Notification service turns these into SMS and in-app notifications. Write the list in `docs/events.md`.

---

## 11. Libraries and setup

Add to `requirements.txt`:

```
channels==4.*
channels-redis
daphne
celery
redis
twilio
djangorestframework-gis
```

PostGIS needs `django.contrib.gis` in `INSTALLED_APPS`, the database engine
`django.contrib.gis.db.backends.postgis`, and GDAL on the machine
(`sudo apt install gdal-bin libgdal-dev libgeos-dev`; in the `Dockerfile` use `apt-get install`).

Important: the generated `settings.py` falls back to **SQLite**, which cannot store PostGIS points.
For your service run Postgres + Redis locally:

```bash
docker run -d --name postgis -e POSTGRES_PASSWORD=pass -p 5432:5432 postgis/postgis:15-3.4
docker run -d --name redis -p 6379:6379 redis:7
```

then set `DB_HOST=localhost`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=pass`, `DB_NAME=towing_db`
and run `CREATE EXTENSION postgis;` in `towing_db`.

Fallback if PostGIS gives you trouble: store `lat` / `lng` as floats and compute distance with the haversine formula.
Replace it with PostGIS later. Do not lose days on GDAL.

---

## 12. What you need from the others

| From | What |
|---|---|
| Auth owner | JWT with `user_id` and `role`. A **tow provider role** (the spec has only 4 roles: agree on `tow_provider`). |
| Notification owner | Event names and payloads from section 10. |
| Frontend owner | URLs, the WebSocket messages from section 8, and the status words. |
| Infra owner | Traefik routes `/api/towing` and `/ws/towing` (WebSocket), Consul registration, Postgres with PostGIS, Redis. |

---

## 13. Work plan (in this order)

1. **Setup**: venv, Postgres + PostGIS, Redis, `/health/` works.
2. **Models** + migrations + Django admin.
3. **Provider API**: profile, availability, location.
4. **SOS API**: create, read, cancel. Status history rows.
5. **Dispatch**: nearest providers, offers, accept with transaction, reject.
6. **Timeout rounds** with Celery (widen radius, then `no_provider`).
7. **WebSocket**: offers to providers, live position + ETA to the driver.
8. **Events** to Redis Streams.
9. **Operator call**: mock first.
10. **Seed + simulator** (see below), tests, OpenAPI file, service README.

If you run out of time, cut in this order: Twilio (keep the mock) -> radius rounds 2 and 3 -> admin endpoints -> history endpoint.
Never cut: create SOS, nearest assignment with accept, live tracking.

---

## 14. Demo and tests

For the demo you will not have real trucks. Build two management commands:

- `python manage.py seed_providers`: creates about 10 trucks around Alger, Oran, Constantine, Blida and Boumerdes.
- `python manage.py simulate_truck <request_id>`: moves the assigned truck in a straight line toward the driver and sends a position every 3 s.

Tests (pytest):
- the nearest provider is picked first
- two providers accept at the same time: only one wins, the other gets `409`
- a provider that is not assigned cannot send positions to a request
- timeout moves to the next radius round, then `no_provider`
- a WebSocket test with `channels.testing.WebsocketCommunicator`

---

## 15. Definition of done

- [ ] SOS created and offers sent in under 5 s
- [ ] The nearest available providers receive the offer
- [ ] First accept wins, no double assignment
- [ ] Driver sees the truck move every 3 s with an ETA
- [ ] Status timeline matches the statuses: pending, confirmed, en route, arrived, completed, cancelled
- [ ] Operator call (mock at least) happens in under 30 s and is logged
- [ ] Events published for the Notification service
- [ ] Only the driver, the assigned provider and admins can follow a request
- [ ] Works for the 5 northern wilayas, with seed data
- [ ] OpenAPI file + README section + tests pass
