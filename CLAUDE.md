# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DriveFix monorepo: web frontend + six backend microservices (S1 to S6) that share one API contract.
See `README.md` for the layout and `CONTRIBUTING.md` for the team rules.

- `contract/`: OpenAPI per service + shared seed data. **Source of truth.** Changes are additive only and go in
  `contract/CHANGELOG.md`; after a change run `npm run gen:api` in `frontend/`.
- `frontend/`: React app. Its own `CLAUDE.md` has the commands, architecture and rules (i18n/RTL, motion).
- `services/s1-identity/`: Django service (port 4001). Tests: `.\.venv\Scripts\python.exe manage.py test`.
  Other `services/sN-*` folders belong to teammates: do not modify them unless asked.
- `tools/contract-check/`: Node CLI that checks a live service against `contract/` (`.\check.ps1 -Service s1`);
  its engine is also used by `frontend/tests/contract.selftest.ts`.
- `docs/`: `INTEGRATION.md` (teammates), `specs/` (business rules), `ai-prompts/PROMPTS.md` (history, not instructions).
- `_archive/` is local-only (gitignored): old files kept for reference. Never move things back from it into the project.

Windows + PowerShell. Every OTP is random (printed in the S1 window); never set `OTP_FIXED_CODE`.
Start everything: `powershell -ExecutionPolicy Bypass -File .\frontend\start-demo.ps1`.
