# GEMINI.md

## 目的
Gemini CLI 向けのコンテキストと作業方針を定義します。

## 出力スタイル
- 言語: 日本語
- トーン: プロフェッショナルかつ簡潔
- 形式: Markdown

## 共通ルール
- 会話は日本語で行う。
- コミットメッセージは Conventional Commits に従い、説明は日本語とする。
- 日本語と英数字の間には半角スペースを挿入する。

## プロジェクト概要
- Discord Developer Change Log を監視し、更新を Discord に通知するツール。
- 技術スタック: TypeScript, Node.js, pnpm, axios, Jest.

## コーディング規約
- 日本語での JSDoc 記載。
- `skipLibCheck` の使用禁止。
- 既存の命名規則とディレクトリ構造（`src/`）の維持。

## 開発コマンド
```bash
pnpm install  # 依存関係インストール
pnpm dev      # 開発
pnpm start    # 実行
pnpm test     # テスト
pnpm lint     # Lint
pnpm fix      # 自動修正
```

## 注意事項
- 認証情報（Webhook URL, Token）をコミットに含めない。
- 既存の `@book000/node-utils` などの共通ライブラリの利用を優先する。

## リポジトリ固有
- データの永続化は `data/notified.json` で行われる。
- 設定は `src/config.ts` で定義されており、`data/config.json` を読み込む。
