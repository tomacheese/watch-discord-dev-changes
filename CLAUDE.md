# CLAUDE.md

Claude Code の作業方針とプロジェクト固有ルールを示します。

## プロジェクト概要

Discord の [Developer Change Log](https://discord.com/developers/docs/change-log) を定期監視し、新しい変更ログを検知して Discord に通知するツールです。監視対象は Change Log の Markdown ソース、通知先は Webhook または Bot Token 経由の Discord チャンネルです。通知済みログを永続化して重複通知を防ぎます。

## 言語・スタイル

- 会話・ドキュメント: 日本語
- コード内コメント・JSDoc: 日本語
- エラーメッセージ・ログ出力: 英語
- 日本語と英数字の間には半角スペースを挿入する

## 開発コマンド

```bash
pnpm install  # 依存関係インストール
pnpm dev      # 開発実行（tsx watch）
pnpm start    # 実行（tsx）
pnpm test     # テスト（Jest）
pnpm lint     # Lint（prettier + eslint + tsc）
pnpm fix      # 自動修正（prettier + eslint）
```

Node.js のバージョンは `.node-version` に従う。

## アーキテクチャと主要ファイル

- `src/main.ts`: エントリーポイント。設定を読み込み `Crawler` を起動する
- `src/config.ts`: 設定管理。`@book000/node-utils` の `ConfigFramework` で `data/config.json` を読み込む
- `src/crawler.ts`: Change Log を native `fetch` で取得し、`date-fns` で日付をパースして差分を検知、`Discord` クラスで通知する
- `src/notified.ts`: 通知済みログの永続化。既定パスは `data/notified.json`（環境変数 `NOTIFIED_PATH` で上書き可能）
- `src/utils.ts`: ユーティリティ関数（`utils.test.ts` で単体テスト対象）

## コーディング規約

- 命名: 変数・関数はキャメルケース、クラス・インターフェースはパスカルケース
- 関数・インターフェースには日本語で JSDoc を記載する
- TypeScript の `skipLibCheck` 有効化による型エラー回避は禁止。型定義を正しく扱う
- HTTP 取得や Discord 通知など、`@book000/node-utils` が提供する機能は自前実装せず優先利用する
- エラーメッセージ先頭に絵文字を使う場合は全体で統一する（既存コードは `❌` を使用）

## テスト

- フレームワーク: Jest（`*.test.ts` を対象、`ts-jest` で実行）
- 新規のユーティリティ関数を追加する際は必ず対応するテストを追加する

## セキュリティ・機密情報

- Discord の Webhook URL・Bot Token などの認証情報をコードやコミットに含めない
- `data/config.json` および環境変数の認証情報を Git にコミットしない
- ログに機密情報を出力しない

## 実行環境・リポジトリ固有

- `data/` 配下（`config.json`, `notified.json`）は実行時に生成・参照される。設定例は `README.md` を参照
- Docker で動作させる場合は `Dockerfile` / `compose.yaml` を使用する。変更時は両者への影響を考慮する
- Renovate が作成した PR には直接コミット・更新を行わない

## 判断記録のルール

重要な設計判断を行った場合は、判断内容の要約・検討した代替案・不採用の理由・前提条件を記録に残す。

## ドキュメント更新ルール

コード変更に伴い、影響する以下を更新する。

- `README.md`（機能・設定・使い方の変更時）
- `CLAUDE.md`（コマンド・アーキテクチャ・規約の変更時）
- `.github/copilot-instructions.md`（レビュー観点に影響する規約の変更時）

## コミット規約

- [Conventional Commits](https://www.conventionalcommits.org/) に従う（`<type>(<scope>): <description>`）
- description は日本語で記載する
- ブランチ命名は [Conventional Branch](https://conventional-branch.github.io) の短縮形（`feat/`, `fix/` 等）
