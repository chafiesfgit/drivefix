# DriveFix contract check

Tells you, in plain words, whether **your service matches the shared contract**, or exactly what is wrong and how to fix it. Run it before you tell Chafie "it is done".

## What you need

- Node.js 18 or newer (`node --version`). Download: https://nodejs.org
- **S1 Identity running** (Chafie's PC, port 4001): the checker logs in with the seed accounts (password `Password123`).
- Your service running, with the shared seed data loaded.

## Run it (Windows PowerShell)

```powershell
cd tools/contract-check
npm install                      # once
.\check.ps1 -Service s2 -Url http://localhost:4002/api/v1 -S1 http://192.168.1.10:4001/api/v1
```

- `-Service` is `s1`, `s2`, `s3`, `s4`, `s5` or `s6`.
- `-Url` is your service, ending in `/api/v1` (default: `http://localhost:<your port>/api/v1`).
- `-S1` is S1 Identity (default: `http://localhost:4001/api/v1`). Use Chafie's LAN IP if S1 is on another PC.
- `-Write` also runs your **"Done when" scenario** with real writes. **Re-seed your database afterwards.**

Without PowerShell: `node bin/contract-check.mjs --service s2 --url http://localhost:4002/api/v1 --s1 http://localhost:4001/api/v1 [--write]`

## What it checks

| Group | What |
| --- | --- |
| Setup | Logs in to S1 with the 9 seed accounts. If S1 is down it says so and stops. |
| Health | `GET /health` answers `{"status":"ok"}` without a token. |
| CORS | The browser preflight from `http://localhost:5173` is allowed (headers `Authorization`, `Content-Type`, your methods). The #1 integration bug. |
| Read | Every `GET` of your service, with a token of an allowed role and seed ids: status code is declared in the contract, JSON matches the schema (UUID ids, ISO dates, integer money, camelCase keys, `{ items, page, pageSize, total }` lists, error format). |
| Security | No token, garbage token, expired token, token signed with another secret → 401. Wrong role → 403 `FORBIDDEN`. Pending account on an "(approved)" route → 403 `NOT_APPROVED`. Service-to-service routes without the right `X-Service-Key` → 401. |
| Done when (`-Write`) | The spec scenario of your service: S2 order with cash, confirm, stock, 409/422 rules. S3 slots, booking, `SLOT_TAKEN`, review twice. S4 SOS, offer, accept, tracking, `OFFER_EXPIRED`, guest SOS. S5 sandbox succeed/fail, refund, cash collected. S6 template notification, bell count, read, SMS log. |

## Reading the result

- **PASS**: fine. **FAIL**: must fix (the line under it says how). **WARN**: information, for example an optional v1.1 endpoint you did not build. **SKIP**: not applicable.
- The exit code is 1 while there is a FAIL.
- The file **`contract-check-report.md`** is written next to the tool. **Send it to Chafie** with your URL.

## When the contract changes

Run `git pull`. The checker reads the repository's `contract/` folder directly, so there is nothing to copy.

Only if you copied this tool **outside** the repository: `npm run sync-contract -- <path to the contract folder>` makes a local `contract/` copy (it then takes priority).
