# Services

One folder per backend service. Each service is independent: its own code, database, port, `README.md`
and `.env`. Any language or framework is fine **as long as it follows the contract** in `../contract/`.

| Folder | Service | Port | Owner | Status |
| --- | --- | --- | --- | --- |
| `s1-identity/` | S1 Identity | 4001 | Chafie | Done |
| `s2-parts/` | S2 Parts | 4002 | Person A | To do |
| `s3-mechanic/` | S3 Mechanic | 4003 | Person B | To do |
| `s4-towing/` | S4 Towing | 4004 | Person C | To do |
| `s5-payment/` | S5 Payment | 4005 | Person D | To do |
| `s6-notification/` | S6 Notification | 4006 | Person E | To do |

## Adding your service

1. Work on a branch (see [`../CONTRIBUTING.md`](../CONTRIBUTING.md)), for example `feature/s2-parts-setup`.
2. Create **your folder only**, with the name from the table (`services/s2-parts/` ...). Do not change
   another person's folder.
3. Put these in your folder:
   - your code;
   - `README.md`: how to install, run and test it (copy the structure of `s1-identity/README.md`);
   - `.env.example`: copy `../contract/.env.example` and set your `PORT`. Never commit `.env`;
   - a seed command that loads `../contract/seed/<your service>.json`;
   - a `.gitignore` for your stack (virtual env, `node_modules`, database file, `.env`).
4. Use the shared values from `../contract/.env.example`: `JWT_SECRET`, `SERVICE_KEY`, `CORS_ORIGIN`.
   A different `JWT_SECRET` means every request gets 401.
5. Check it: `cd ..\tools\contract-check ; .\check.ps1 -Service s2` must show **0 FAIL**.
6. Open a pull request. Paste the checker summary into it.

## Using S1 while you build

S1 issues the tokens your service checks. Two options:
- **Run it yourself** (recommended): `cd s1-identity ; .\setup.ps1` once, then `.\run.ps1`.
- **Use Chafie's PC** on the same Wi-Fi: `http://CHAFIE-IP:4001/api/v1` (see `../docs/INTEGRATION.md`).
