# watch-discord-dev-changes

🔔 Discord の Developer Change Log が更新されたら Discord チャンネルに通知するツールです。

## 機能

- [Discord Developer Change Log](https://discord.com/developers/docs/change-log) を定期的に監視
- 新しい変更ログが追加されたら Discord に通知
- 既に通知した変更ログの重複通知を防止

監視対象は [discord/discord-api-docs](https://github.com/discord/discord-api-docs) の `main` ブランチにある `developers/change-log.mdx` です。通知済みの管理にはタイトルを使います。

取得元の切り替えなどで未通知の項目が大量に見つかった場合に備え、日付が 30 日より古い項目は通知せず、通知済みとして記録だけします。

## 必要要件

- Node.js（`.node-version` 参照）
- pnpm

## インストール

```bash
# リポジトリのクローン
git clone https://github.com/tomacheese/watch-discord-dev-changes.git
cd watch-discord-dev-changes

# 依存関係のインストール
pnpm install
```

## 設定

`data/config.json` を作成し、Discord の通知設定を行います。

```json
{
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/..."
  }
}
```

または Bot Token を使用する場合:

```json
{
  "discord": {
    "token": "your-bot-token",
    "channelId": "channel-id"
  }
}
```

## 使用方法

```bash
# 実行
pnpm start

# 開発モード（ファイル変更を監視）
pnpm dev
```

## Docker での実行

```bash
docker compose up -d
```

## ライセンス

このプロジェクトは [MIT](LICENSE) ライセンスの下で公開されています。
