# GitHub Copilot Instructions

## プロジェクト概要
- 目的: Discord Developer Change Log を定期的に監視し、更新があれば Discord チャンネルに通知する。
- 主な機能: 変更ログの取得（スクレイピング）、新規変更の検知、Discord への通知（Webhook または Bot Token）、既読管理。
- 対象ユーザー: Discord 開発者、Discord 関連のコミュニティ運営者。

## 共通ルール
- 会話は日本語で行う。
- PR とコミットは [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) に従う。
  - `<type>(<scope>): <description>` 形式
  - `<description>` は日本語で記載
- 日本語と英数字の間には半角スペースを入れる。

## 技術スタック
- 言語: TypeScript
- 実行環境: Node.js
- パッケージマネージャー: pnpm
- 主要ライブラリ:
  - axios: HTTP クライアント
  - date-fns: 日付操作
  - tsx: TypeScript 実行
  - jest: テストフレームワーク

## コーディング規約
- TypeScript の `skipLibCheck` は原則として無効にせず、型定義を正しく扱う。
- 関数やインターフェースには日本語で JSDoc を記載する。
- 命名規則: キャメルケース（変数、関数）、パスカルケース（クラス、インターフェース）。

## 開発コマンド
```bash
# 依存関係のインストール
pnpm install

# 開発（ウォッチモード）
pnpm dev

# 実行
pnpm start

# テスト実行
pnpm test

# Lint とフォーマットのチェック
pnpm lint

# 自動修正
pnpm fix
```

## テスト方針
- テストフレームワーク: Jest
- 方針: ユーティリティ関数（`utils.ts`）を中心にユニットテストを作成する。

## セキュリティ / 機密情報
- `data/config.json` や環境変数に含まれる API キーや Webhook URL を Git にコミットしない。
- ログに機密情報を出力しない。

## ドキュメント更新
- `README.md`
- 各種プロンプトファイル（`.github/copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`）

## リポジトリ固有
- 設定ファイルはデフォルトで `data/config.json` を使用する。
- 通知済み情報の管理はデフォルトで `data/notified.json` を使用する。
