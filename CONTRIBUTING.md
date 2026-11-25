# Contributing

How the team works on this repository. If you have never used Git, read section 1 first: it takes five minutes.

## 1. Git in five minutes

- **Git** keeps the history of every file on your PC. **GitHub** is the website that holds the shared copy.
- A **commit** is a saved snapshot of your changes, with a short message.
- A **branch** is your own line of work. `main` is the shared, working version: nobody works on it directly.
- A **pull request (PR)** asks to merge your branch into `main`. A teammate reviews it first.
- **pull** downloads the others' work. **push** uploads your commits.

One-time setup on your PC:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"     # the email of your GitHub account
git clone <repository URL> drivefix
cd drivefix
```

## 2. Daily workflow

```powershell
git switch main
git pull                                   # get the latest main
git switch -c feature/s2-orders            # new branch for one task

# ... work, then save a snapshot:
git status                                 # what changed?
git add services/s2-parts                  # stage YOUR files (avoid "git add ." if unsure)
git commit -m "feat(s2): create and list orders"

git push -u origin feature/s2-orders       # first push of this branch; later just: git push
```

Then on GitHub, click **Compare & pull request**, fill in the template and ask one teammate to review it.
After it is merged: `git switch main ; git pull`, then delete the old branch with `git branch -d feature/s2-orders`.

If `main` moved while you worked: `git switch main ; git pull ; git switch feature/s2-orders ; git merge main`.

## 3. Branch names

`<type>/<service or area>-<short-description>`, lowercase, with hyphens:

| Type | When | Example |
| --- | --- | --- |
| `feature/` | new behaviour | `feature/s3-booking-slots` |
| `fix/` | bug fix | `fix/s4-offer-timeout` |
| `docs/` | documentation only | `docs/integration-s5` |
| `contract/` | contract change (see section 5) | `contract/s2-order-payurl` |
| `chore/` | tooling, config, cleanup | `chore/frontend-deps` |

## 4. Commit messages

`type(scope): what it does`, in the present tense, short (72 characters at most):

```
feat(s2): add stock check when ordering
fix(frontend): show the pay link after refresh
docs(contract): explain the payUrl field
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Scopes: `s1` ... `s6`, `frontend`, `contract`,
`contract-check`, `docs`.

## 5. Team rules

1. **Never push to `main` directly.** Every change goes through a pull request with one approval.
2. **Only change your own folder** (`services/<your service>/`). If you need a change somewhere else, open an
   issue or ask its owner.
3. **The contract is shared.** Changes to `contract/` must be **additive only** (a new optional field or a new
   endpoint, never a rename or a removal). Add a line to `contract/CHANGELOG.md`, use a `contract/...` branch,
   and Chafie must approve the PR.
4. **Never commit secrets or local files:** `.env`, database files (`db.sqlite3`), `node_modules/`, `.venv/`.
   The root `.gitignore` already blocks them. Commit `.env.example` instead.
5. **Run the checker before your PR:** `cd tools\contract-check ; .\check.ps1 -Service s2` must show 0 FAIL.
   Paste the summary into the PR.
6. Keep your service's `README.md` up to date: how to install, run, seed and test it.

## 6. Pull request checklist

The PR template asks for this:

- [ ] The branch is up to date with `main`.
- [ ] Only my folder changed (or a contract change, with its CHANGELOG line).
- [ ] The service starts and loads the seed with one command.
- [ ] `contract-check` shows 0 FAIL (summary pasted).
- [ ] No `.env`, database or build folders are committed.

## 7. Common problems

| Problem | Fix |
| --- | --- |
| `rejected ... fetch first` when pushing | Someone pushed before you: `git pull`, then push again. |
| Merge conflict | Open the file, keep the right lines between `<<<<<<<` and `>>>>>>>`, delete the markers, then `git add <file>` and `git commit`. |
| Committed a `.env` by mistake | `git rm --cached .env`, commit, push, and tell the team: the secret must be changed. |
| Did my work on `main` by mistake (not pushed yet) | `git switch -c feature/my-task`: your commits move to the new branch. |
