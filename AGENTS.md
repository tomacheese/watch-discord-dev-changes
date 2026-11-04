# AGENTS.md

## Language

- Write all deliverables in English: commit messages, PR/Issue titles and bodies, review comments, code comments and JSDoc, and documentation (README, AGENTS.md, CLAUDE.md, Copilot instructions).
- Exceptions: end-user-facing notification text (such as the Japanese translation produced for Discord embeds), quotations, technical identifiers, external text, generated files, and the fork-PR approval comment in `.github/workflows/docker.yml` (also its `body-includes` match key).
- Log and error messages are in English.

## Overview

A TypeScript / Node.js tool that polls Discord's [Developer Change Log](https://discord.com/developers/docs/change-log) (`developers/change-log.mdx` on the `main` branch of `discord/discord-api-docs`) every hour and notifies a Discord channel (via webhook or bot token) of new entries. Notified entries are persisted to avoid duplicates. The app is private and runs from source with `tsx`; it is packaged with Docker.

## Commands

Use pnpm. The Node.js version is in `.node-version`.

```bash
pnpm install        # install dependencies
pnpm dev            # run with tsx watch
pnpm start          # run with tsx
pnpm test           # Jest (ts-jest, **/*.test.ts)
pnpm lint           # prettier --check + eslint + tsc
pnpm fix            # prettier --write + eslint --fix
```

## Architecture

- `src/main.ts`: entry point. Loads and validates the configuration, then starts `Crawler`.
- `src/config.ts`: `Configuration` (`ConfigFramework` from `@book000/node-utils`) for `data/config.json` (`CONFIG_PATH` overrides the path).
- `src/crawler.ts`: fetches the MDX with native `fetch` on startup and then every hour, parses it with `src/change-log.ts`, and sends embeds for entries that are not yet notified through the `Discord` class from `@book000/node-utils`. Optionally translates the title and body through `Utils.translate`.
- `src/change-log.ts`: parses `<Update label="...">` blocks into entries (ID = title, date, URL, body). Tested with `src/__fixtures__/change-log.mdx`.
- `src/notified.ts`: persistence of notified IDs in `data/notified.json` (`NOTIFIED_PATH` overrides the path).
- `src/utils.ts`: Markdown/Discord escaping around translation and the Google Apps Script translation call.

Behaviors to preserve:

- The notified ID is the entry title. Changing the ID format invalidates existing `notified.json` files and re-notifies every entry.
- On the first run (no `notified.json`), entries are recorded without sending messages.
- Entries older than 30 days (`MAX_NOTIFY_AGE_DAYS`) are recorded without a notification.

## Conventions

- camelCase for variables and functions, PascalCase for classes and interfaces. Write JSDoc in English for functions and interfaces.
- Do not enable `skipLibCheck` to work around type errors.
- Prefer the facilities of `@book000/node-utils` (config, Discord, logging) over custom implementations.
- Log messages are in English; if prefixed with an emoji, follow the existing style (`❌` for errors).
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`<type>(<scope>): <description>`); branches follow [Conventional Branch](https://conventional-branch.github.io) (`feat/`, `fix/`, ...).
- Do not commit to or update Renovate-created PRs.

## Testing

- Jest with `ts-jest`; test files are `*.test.ts` next to the sources.
- Add a unit test for every new utility function.

## Security

- Never put Discord webhook URLs, bot tokens, or the translation `gasUrl` in code, tests, logs, or commits. `data/config.json` and credentials in environment variables must not be committed.
- `data/` (`config.json`, `notified.json`) is created and read at runtime and is git-ignored; see `README.md` for the configuration format.

## Docker and docs

- `Dockerfile` and `compose.yaml` set `CONFIG_PATH=/data/config.json` and `NOTIFIED_PATH=/data/notified.json` and mount `./data` at `/data`. Consider both files when changing paths or runtime behavior.
- Update `README.md` when features, configuration, or usage change, and this file when commands, architecture, or conventions change.
