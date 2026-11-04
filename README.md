# watch-discord-dev-changes

🔔 Notifies a Discord channel when the Discord Developer Change Log is updated.

## Features

- Polls the [Discord Developer Change Log](https://discord.com/developers/docs/change-log) hourly
- Sends a Discord notification (embed) for each new entry
- Remembers notified entries to avoid duplicate notifications
- Optionally adds a Japanese translation through a Google Apps Script endpoint

The source is `developers/change-log.mdx` on the `main` branch of [discord/discord-api-docs](https://github.com/discord/discord-api-docs). Notified entries are tracked by title, so the title is the entry ID.

- On the first run (when `notified.json` does not exist yet), all current entries are recorded as notified without sending any message.
- Entries dated more than 30 days ago are recorded as notified without a notification, so a change of source does not cause a flood of messages.

## Requirements

- Node.js (see `.node-version`)
- pnpm

## Installation

```bash
git clone https://github.com/tomacheese/watch-discord-dev-changes.git
cd watch-discord-dev-changes
pnpm install
```

## Configuration

Create `data/config.json` and configure where notifications are sent. The path can be overridden with the `CONFIG_PATH` environment variable.

Using a webhook:

```json
{
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/..."
  }
}
```

Or using a bot token (both `token` and `channelId` are required):

```json
{
  "discord": {
    "token": "your-bot-token",
    "channelId": "channel-id"
  }
}
```

If `webhookUrl` is set, it takes precedence over `token` and `channelId`.

To add a translation, set the URL of a Google Apps Script translation service (optional):

```json
{
  "discord": { "webhookUrl": "https://discord.com/api/webhooks/..." },
  "translate": { "gasUrl": "https://script.google.com/macros/s/.../exec" }
}
```

Notified entries are stored in `data/notified.json`. The path can be overridden with the `NOTIFIED_PATH` environment variable.

## Usage

```bash
# Run
pnpm start

# Development mode (restarts on file changes)
pnpm dev
```

## Running with Docker

Put `config.json` in `./data` and start the container. `./data` is mounted at `/data`, where the image reads `config.json` and writes `notified.json`.

```bash
docker compose up -d
```

## License

This project is released under the [MIT](LICENSE) license.
