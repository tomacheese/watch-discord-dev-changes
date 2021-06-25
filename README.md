# WatchDiscordDevChanges

Discord の [Change Log - Discord Developer Portal](https://discord.com/developers/docs/change-log) ([GitHub file](https://raw.githubusercontent.com/discord/discord-api-docs/master/docs/Change_Log.md)) に更新があったときに Discord の特定のチャンネルに通知します。

## Installation

1. Clone from GitHub repository: `git clone https://github.com/jaoafa/WatchDiscordDevChanges.git`
2. Install the dependency packages from `requirements.txt`: `pip3 install -U -r requirements.txt`
2. Write to `config.json`
3. Run with `python3 -m src`

## Requirements

- Python 3.x (Tested with `Python 3.9`)
- Dependency packages: `requests`
- Vaild Discord bot token and channel id

