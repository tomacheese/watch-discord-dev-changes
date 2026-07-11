# GitHub Copilot Instructions

GitHub Copilot のコードレビュー向け指示です。このリポジトリの PR をレビューする際の観点をまとめます。

## プロジェクト概要

Discord の Developer Change Log を定期監視し、新しい変更ログを検知して Discord（Webhook または Bot Token）へ通知する TypeScript / Node.js 製ツールです。

## 技術スタック

- 言語: TypeScript、実行環境: Node.js、パッケージマネージャー: pnpm
- 実行: tsx / テスト: Jest（ts-jest）/ Lint: ESLint + Prettier
- 主要ライブラリ: `@book000/node-utils`（設定管理・Discord 通知）、`date-fns`（日付パース）
- HTTP 取得は Node.js 標準の `fetch` を使用（外部 HTTP クライアントは導入していない）

## レビュー時の重点確認事項

- 認証情報（Discord Webhook URL・Bot Token）がコード・テスト・ログ・コミットに混入していないか。混入があれば必ず指摘する
- `data/config.json` や環境変数から読み込む機密値がリポジトリに含まれていないか
- `fetch` 呼び出しにレスポンス status やネットワーク例外のエラーハンドリングがあるか（既存コードは失敗時に英語でログ出力する方針）
- 新規のユーティリティ関数に対応する単体テスト（`*.test.ts`）が追加されているか
- 公開関数・インターフェースに日本語 JSDoc があるか
- 通知済み管理（`data/notified.json`）のロジック変更で、重複通知や取りこぼしを招いていないか

## コーディング規約（レビュー基準）

- TypeScript の `skipLibCheck` を有効化して型エラーを回避していないか
- 命名: 変数・関数はキャメルケース、クラス・インターフェースはパスカルケース
- エラーメッセージ・ログ出力は英語。先頭に絵文字を使う場合は既存の `❌` に統一されているか
- `@book000/node-utils` が提供する機能の自前再実装になっていないか

## コミット・PR 規約

- [Conventional Commits](https://www.conventionalcommits.org/) 形式（`<type>(<scope>): <description>`）で、description は日本語
- 日本語と英数字の間には半角スペースを入れる

## フラグ不要な既知パターン

- `data/config.json` / `data/notified.json` は実行時に生成されるファイルであり、リポジトリに存在しないことは正常
- 依存パッケージの更新 PR（`chore(deps):`）は Renovate による自動更新であり、レビュー観点は差分の妥当性に限る
