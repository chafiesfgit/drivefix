# DriveFix

Spare-parts marketplace, mechanic booking and SOS towing for Algeria, in one web platform.
Graduation project (defence on 30/11/2026). The web app supports six roles (driver, parts supplier,
mechanic, tow driver, dispatcher, admin) in Arabic (RTL), French and English.

| Part | Status |
| --- | --- |
| Web frontend (`frontend/`) | Done. Uses the real S1, and mocks S2 to S6 in the browser until each one is ready |
| S1 Identity (`services/s1-identity/`) | Done (56 tests) |
| S2 to S6 (`services/`) | Being built by the team, from the contract |
| API contract (`contract/`) | v1.1, the single source of truth |

---

## How it fits together

```
                       Browser: frontend (React, port 5173)
                                     |
        +------------+------------+--+---------+------------+------------+
        |            |            |            |            |            |
   S1 Identity   S2 Parts    S3 Mechanic   S4 Towing   S5 Payment   S6 Notification
      :4001        :4002        :4003        :4004        :4005        :4006
        |
        +-- issues the JWT; every other service checks it with the shared JWT_SECRET
```

- Each service is independent: it has its own database, its own port and its own folder in `services/`.
- All services follow **one contract** (`contract/openapi/*.yaml`): same URLs, JSON shapes, error format,
  roles and demo data. If your service follows the contract, the frontend works with it.
- Until a service is ready, the frontend uses a **mock** of it (fake data in the browser), switched per
  service in `frontend/.env`.

## Repository layout

```
.
├── contract/              API contract v1.1: OpenAPI per service, shared seed data, .env.example, CHANGELOG
├── frontend/              React + Vite + TypeScript web app (all six roles, ar/fr/en)
├── services/              Backend microservices, one folder per service
│   └── s1-identity/       S1 Identity: accounts, OTP, login (JWT), admin approvals (Django)
├── tools/
│   ├── contract-check/    Tells you whether your service matches the contract (run it before a PR)
│   └── ai-skills/         Optional: installs the Claude Code skills used to build the frontend
├── docs/
│   ├── INTEGRATION.md     How to connect your service to the frontend (start here, teammates)
│   ├── specs/             Business rules: backend spec per service (.docx)
│   └── ai-prompts/        The AI prompts that built parts of this repo, and which part each built
├── CONTRIBUTING.md        Git workflow for the team (branches, commits, pull requests)
└── README.md              This file
```

## Quick start (Windows, PowerShell)

Prerequisites: [Git](https://git-scm.com/download/win), [Node.js 22+](https://nodejs.org) and
[Python 3.12](https://www.python.org/downloads/release/python-3129/) (not 3.14).

```powershell
git clone <repository URL> drivefix
cd drivefix

# once: S1 Identity (virtual env, packages, database, demo data, tests)
cd services\s1-identity ; powershell -ExecutionPolicy Bypass -File .\setup.ps1 ; cd ..\..

# once: frontend and checker packages
cd frontend ; npm install ; cd ..
cd tools\contract-check ; npm install ; cd ..\..

# every time: starts S1 (port 4001) and the frontend (port 5173), each in its own window
powershell -ExecutionPolicy Bypass -File .\frontend\start-demo.ps1
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`).
Every OTP code is random: it is printed in the S1 window.

### Demo accounts (password `Password123`)

| Phone | Role |
| --- | --- |
| 0555000001 | Admin |
| 0555000002, 0555000003 | Driver |
| 0555000004, 0555000005 | Supplier (approved) |
| 0555000006, 0555000007 | Mechanic |
| 0555000008, 0555000009 | Tow driver |
| 0555000010 | Dispatcher |
| 0555000011 | Supplier waiting for approval |

## Services

| Service | Port | Folder | Owner | Contract file |
| --- | --- | --- | --- | --- |
| S1 Identity | 4001 | `services/s1-identity/` | Chafie | `contract/openapi/s1-identity.yaml` |
| S2 Parts | 4002 | `services/s2-parts/` | Person A | `contract/openapi/s2-parts.yaml` |
| S3 Mechanic | 4003 | `services/s3-mechanic/` | Person B | `contract/openapi/s3-mechanic.yaml` |
| S4 Towing | 4004 | `services/s4-towing/` | Person C | `contract/openapi/s4-towing.yaml` |
| S5 Payment | 4005 | `services/s5-payment/` | Person D | `contract/openapi/s5-payment.yaml` |
| S6 Notification | 4006 | `services/s6-notification/` | Person E | `contract/openapi/s6-notification.yaml` |

Building one of S2 to S6? Read [`services/README.md`](services/README.md), then [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

## Documentation

| Document | For |
| --- | --- |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | Teammates: connect your service to the frontend, common mistakes, definition of done |
| [`contract/README.md`](contract/README.md) | Rules every service follows (auth, errors, pagination, error codes) |
| [`contract/CHANGELOG.md`](contract/CHANGELOG.md) | What changed in the contract since v1.0 |
| [`tools/contract-check/README.md`](tools/contract-check/README.md) | Checking your service against the contract |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Git and GitHub, step by step, and the team rules |
| [`frontend/README.md`](frontend/README.md) | Running the frontend, real vs mock services, scripts |
| [`services/s1-identity/README.md`](services/s1-identity/README.md) | S1 Identity: setup, endpoints, PostgreSQL |
| [`docs/specs/backend-spec-per-service.docx`](docs/specs/backend-spec-per-service.docx) | Business rules and the "Done when" of each service |
