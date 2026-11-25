# DriveFix: getting started (team guide)

Repository: https://github.com/chafiesfgit/drivefix

It already contains the full frontend, the S1 Identity service, the API contract (v1.1) and a tool that checks
your service. Your job: build **your service only**, in your own folder, following the contract.

**Deadline: 28/11.** We put everything together on 29/11. The defence is on 30/11.

---

## Step 1: Accept the invitation (today)

You got a GitHub invitation by email. Or open https://github.com/chafiesfgit/drivefix/invitations and click **Accept**.
It expires after 7 days.

## Step 2: Install (once)

| Tool | Version | Needed? |
| --- | --- | --- |
| [Git](https://git-scm.com/download/win) | latest | Yes |
| [Node.js](https://nodejs.org) | 22 or newer | Yes (the checker and the frontend use it) |
| [Python](https://www.python.org/downloads/release/python-3129/) | **3.12** (not 3.14) | Yes, to run S1 on your PC |
| Your service's language (Node, Python, Java...) | | Yes |

Then, once only, tell Git who you are:

```powershell
git config --global user.name "Your Name"
git config --global user.email "the email of your GitHub account"
```

## Step 3: Get the project and run it (once)

```powershell
git clone https://github.com/chafiesfgit/drivefix.git
cd drivefix

cd services\s1-identity
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # S1: packages, database, demo data
cd ..\..

cd frontend ; npm install ; cd ..
cd tools\contract-check ; npm install ; cd ..\..

powershell -ExecutionPolicy Bypass -File .\frontend\start-demo.ps1
```

Open http://localhost:5173 and log in with `0555000001` / `Password123`.
OTP codes are printed in the S1 window.

## Step 4: Read (in this order)

| File | Must read? | Why |
| --- | --- | --- |
| `README.md` | **Yes** | How the whole project fits together |
| `docs/INTEGRATION.md` | **Yes** | How your service connects to the frontend, the 10 common mistakes, your "definition of done" |
| `contract/openapi/<your service>.yaml` | **Yes** | Every endpoint, field and error you must build. Paste it into https://editor.swagger.io to read it easily |
| `contract/README.md` | **Yes** | Rules for every service: auth, errors, pagination, error codes |
| `services/README.md` | **Yes** | Where and how to add your service |
| `CONTRIBUTING.md` | **Yes** if you are new to Git | Branches, commits, pull requests, step by step |
| `docs/specs/backend-spec-per-service.docx` | Your section only | Business rules of your service |
| `frontend/`, `services/s1-identity/` code | No | Only as an example |
| `docs/ai-prompts/` | No | History |

## Step 5: Build your service

1. Create a branch: `git switch -c feature/s2-setup` (use your service number).
2. Create **your folder only**:

   | Service | Folder | Port |
   | --- | --- | --- |
   | S2 Parts | `services/s2-parts/` | 4002 |
   | S3 Mechanic | `services/s3-mechanic/` | 4003 |
   | S4 Towing | `services/s4-towing/` | 4004 |
   | S5 Payment | `services/s5-payment/` | 4005 |
   | S6 Notification | `services/s6-notification/` | 4006 |

3. Put in it: your code, a `README.md` (how to install, run and seed), a `.env.example`, a `.gitignore`, and a
   seed command that loads `contract/seed/<your service>.json`.
4. Save and share your work often:
   ```powershell
   git add services/s2-parts
   git commit -m "feat(s2): list parts"
   git push -u origin feature/s2-setup
   ```

## Rules (mandatory)

- Work **only in your own folder**. Never edit someone else's folder, `frontend/` or `services/s1-identity/`.
- **Never push to `main`.** Always use a branch, then open a pull request on GitHub.
- Use **exactly** the `JWT_SECRET`, `SERVICE_KEY` and `CORS_ORIGIN` from `contract/.env.example`. A different secret means every request gets 401.
- Follow the contract exactly: same URLs, camelCase JSON, UUID ids, money as whole numbers (DZD), the error format
  `{ "error": { "code", "message", "field" } }`, lists as `{ items, page, pageSize, total }`.
- **Never commit** `.env`, database files, `node_modules/` or `.venv/`.
- **Do not change the contract** without asking Chafie first.

## Before you say "done" (checklist)

- [ ] My service starts with one command and listens on its port.
- [ ] `GET /health` answers `{ "status": "ok" }`.
- [ ] The seed loads with one command (same ids as `contract/seed/`).
- [ ] The checker shows **0 FAIL**:
  ```powershell
  cd tools\contract-check
  .\check.ps1 -Service s2            # read checks
  .\check.ps1 -Service s2 -Write     # also runs your "Done when" scenario (re-seed afterwards)
  ```
- [ ] My service's "Done when" sentence from the spec works live.
- [ ] My `README.md` explains how to install, run, seed and test.
- [ ] I opened a pull request with the checker summary pasted in it.

## Questions?

Read `docs/INTEGRATION.md` first (most answers are there), then ask Chafie in the group.
