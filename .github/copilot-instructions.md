# GitHub Copilot Instructions

Follow [AGENTS.md](../AGENTS.md) for the project overview, commands, architecture, conventions, and language rules. When reviewing PRs, check in particular:

- Credentials (Discord webhook URL, bot token, translation `gasUrl`) are not present in code, tests, logs, or commits.
- `fetch` calls handle non-OK responses and network errors (existing code logs an English message and returns).
- New utility functions have unit tests (`*.test.ts`) and public functions and interfaces have English JSDoc.
- Changes to notified tracking do not cause duplicate notifications or misses. The ID is the entry title; changing its format re-notifies every entry. Entries older than 30 days are recorded without a notification, and nothing is sent on the first run.
- `skipLibCheck` is not enabled to hide type errors, and `@book000/node-utils` features are not reimplemented.
- Deliverables are in English; log messages are in English.

Known patterns not to flag:

- `data/config.json` and `data/notified.json` are created at runtime and absent from the repository.
- `chore(deps):` PRs are automated Renovate updates; review only the validity of the diff.
