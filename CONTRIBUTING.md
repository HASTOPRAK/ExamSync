# Contributing to ExamSync

Thank you for your interest in contributing. This document covers everything you need to get started.

---

## Development Setup

Follow the [Getting Started](README.md#getting-started) guide in the README to get a local environment running before making any changes.

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code — protected, deploy on push |
| `dev` | Integration branch — merge feature branches here first |
| `feature/*` | New features (e.g. `feature/google-oauth`) |
| `fix/*` | Bug fixes (e.g. `fix/schedule-conflict`) |
| `chore/*` | Tooling, deps, config (e.g. `chore/update-deps`) |

**Never push directly to `main`.** Open a pull request from `dev` → `main` when a milestone is ready.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`

**Examples:**
```
feat(auth): add Google OAuth for teacher accounts
fix(scheduler): resolve room double-booking on same time slot
chore(deps): bump bcrypt to 6.0.0
docs(readme): add deployment section
test(scheduler): add conflict graph edge cases
```

---

## Pull Requests

1. Branch off `dev`, not `main`
2. Keep PRs focused — one feature or fix per PR
3. All CI checks must pass before merging
4. Write a clear description: **what** changed and **why**
5. Reference any related issues with `Closes #123`

---

## Code Style

- **Backend:** ES Modules (`import`/`export`), async/await, no semicolons not enforced but be consistent with surrounding code
- **Frontend:** Functional components, hooks only — no class components
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components, `snake_case` for database columns
- **No commented-out code** in PRs — delete it or leave it as a proper comment explaining why

---

## Testing

Every non-trivial change should include tests or update existing ones.

```bash
cd backend  && npm test
cd frontend && npm test
```

CI will block the merge if tests fail.

---

## Reporting Issues

Open a [GitHub Issue](../../issues) with:
- A clear title
- Steps to reproduce
- Expected vs actual behaviour
- Environment (OS, Node version, browser)
