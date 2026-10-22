import { Logger } from '@book000/node-utils'
import { isValid, parse } from 'date-fns'

/**
 * Change Log の 1 項目
 */
export interface ChangeLogItem {
  /** 通知済み管理に使う ID。旧形式の `notified.json` との互換のためタイトルと同じ値 */
  id: string
  /** 項目のタイトル (`<Update>` 内の最初の h2) */
  title: string
  /** `<Update>` の `label` から解釈した日付。解釈できない場合は null */
  date: Date | null
  /** 公式ドキュメント上の項目のアンカー URL */
  url: string
  /** タイトルより後ろの本文 (共通インデント除去済み) */
  text: string
}

const CHANGE_LOG_URL = 'https://docs.discord.com/developers/change-log'
const LABEL_DATE_FORMAT = 'MMMM d, yyyy'
const UPDATE_OPEN_PATTERN = /^<Update\s+label="([^"]*)"/
const UPDATE_CLOSE_PATTERN = /^\s*<\/Update>\s*$/
const TITLE_PATTERN = /^[ \t]*## (.+)$/

/**
 * 行頭の空白文字数を返す。
 *
 * @param line 対象の行
 * @returns 行頭の空白 (半角スペースとタブ) の文字数
 */
function countIndent(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * 全行から共通インデントを取り除く。空行は無視して共通インデントを求める。
 *
 * @param lines 対象の行
 * @returns 共通インデントを取り除いた行
 */
function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => countIndent(line))
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0
  return lines.map((line) => line.slice(minIndent))
}

/**
 * 本文の行のうち、最初の h2 の位置とタイトルを探す。
 *
 * @param lines 開始タグの次の行から `</Update>` の前までの行
 * @returns 最初の h2 の行番号 (0 始まり) とタイトル。h2 が無い場合は null
 */
function findTitle(lines: string[]): { index: number; title: string } | null {
  for (const [index, line] of lines.entries()) {
    const match = TITLE_PATTERN.exec(line)
    if (match) {
      return { index, title: match[1].trim() }
    }
  }
  return null
}

/**
 * `label` から公式ドキュメント上のアンカー付き URL を作る。
 *
 * @param label `<Update>` の `label` 属性値
 * @returns アンカー付き URL
 */
function getItemUrl(label: string): string {
  const slug = label.toLowerCase().replaceAll(',', '').replaceAll(/\s+/g, '-')
  return `${CHANGE_LOG_URL}#${slug}`
}

/**
 * `label` を日付として解釈する。
 *
 * @param label `<Update>` の `label` 属性値
 * @returns 解釈した日付。解釈できない場合は null
 */
function parseLabelDate(label: string): Date | null {
  const date = parse(label, LABEL_DATE_FORMAT, new Date())
  return isValid(date) ? date : null
}

/**
 * Change Log の MDX から項目を取り出す。
 *
 * `<Update label="...">` から `</Update>` までを 1 項目とし、本文の最初の h2 をタイトルにする。
 * タイトルが無い項目や `label` が空の項目は警告ログを出してスキップする。
 *
 * @param body Change Log の MDX 全文
 * @returns 項目の配列 (MDX 上の出現順)
 */
export function parseChangeLog(body: string): ChangeLogItem[] {
  const logger = Logger.configure('parseChangeLog')
  const lines = body.split(/\r?\n/)
  const items: ChangeLogItem[] = []

  let index = 0
  while (index < lines.length) {
    const open = UPDATE_OPEN_PATTERN.exec(lines[index])
    if (!open) {
      index++
      continue
    }
    const label = open[1]

    // rss の description に ">" を含む行があるため、開始タグは ">" で終わる最初の行で閉じる
    let tagEnd = index
    while (tagEnd < lines.length && !lines[tagEnd].trimEnd().endsWith('>')) {
      tagEnd++
    }
    let close = tagEnd + 1
    while (close < lines.length && !UPDATE_CLOSE_PATTERN.test(lines[close])) {
      close++
    }
    if (close >= lines.length) {
      logger.warn(`❌ Skipped update without closing tag: "${label}"`)
      break
    }
    index = close + 1

    if (label === '') {
      logger.warn('❌ Skipped update with empty label')
      continue
    }
    const block = lines.slice(tagEnd + 1, close)
    const heading = findTitle(block)
    if (heading === null) {
      logger.warn(`❌ Skipped update without title heading: "${label}"`)
      continue
    }

    items.push({
      id: heading.title,
      title: heading.title,
      date: parseLabelDate(label),
      url: getItemUrl(label),
      text: dedent(block.slice(heading.index + 1))
        .join('\n')
        .trim(),
    })
  }

  return items
}
