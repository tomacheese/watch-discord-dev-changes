import { Logger } from '@book000/node-utils'
import { isValid, parse } from 'date-fns'

/**
 * A single Change Log entry.
 */
export interface ChangeLogItem {
  /** ID used for notified tracking. Kept equal to the title so existing `notified.json` files stay valid */
  id: string
  /** Entry title (the first h2 inside `<Update>`) */
  title: string
  /** Date parsed from the `<Update>` `label`, or null if it cannot be parsed */
  date: Date | null
  /** Anchor URL of the entry on the official docs site */
  url: string
  /** Body after the title, with the common indentation removed */
  text: string
}

const CHANGE_LOG_URL = 'https://docs.discord.com/developers/change-log'
const LABEL_DATE_FORMAT = 'MMMM d, yyyy'
const UPDATE_OPEN_PATTERN = /^<Update\s+label="([^"]*)"/
const UPDATE_CLOSE_PATTERN = /^\s*<\/Update>\s*$/
const TITLE_PATTERN = /^[ \t]*## (.+)$/

/**
 * Counts the leading whitespace characters of a line.
 *
 * @param line The line to inspect
 * @returns Number of leading whitespace characters
 */
function countIndent(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * Removes the common indentation from all lines. Blank lines are ignored when computing it.
 *
 * @param lines The lines to dedent
 * @returns The lines without the common indentation
 */
function dedent(lines: string[]): string[] {
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim() !== '') {
      minIndent = Math.min(minIndent, countIndent(line))
    }
  }
  const indent = Number.isFinite(minIndent) ? minIndent : 0
  return lines.map((line) => line.slice(indent))
}

/**
 * Finds the first h2 in the body and returns its position and title.
 *
 * @param lines Lines from the one after the opening tag up to just before `</Update>`
 * @returns 0-based line index and title of the first h2, or null if there is none
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
 * Builds the anchored URL on the official docs site from a `label`.
 *
 * @param label The `label` attribute value of `<Update>`
 * @returns The anchored URL
 */
function getItemUrl(label: string): string {
  const slug = label.toLowerCase().replaceAll(',', '').replaceAll(/\s+/g, '-')
  return `${CHANGE_LOG_URL}#${slug}`
}

/**
 * Parses a `label` as a date.
 *
 * @param label The `label` attribute value of `<Update>`
 * @returns The parsed date, or null if it cannot be parsed
 */
function parseLabelDate(label: string): Date | null {
  const date = parse(label, LABEL_DATE_FORMAT, new Date())
  return isValid(date) ? date : null
}

/**
 * Extracts entries from the Change Log MDX.
 *
 * Each entry spans from `<Update label="...">` to `</Update>`, and the first h2 in the body is its title.
 * Entries without a title or with an empty `label` are skipped with a warning.
 * On an entry without a closing tag, a warning is logged and parsing stops.
 *
 * @param body The full Change Log MDX
 * @returns The entries in order of appearance in the MDX
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

    // The rss description attribute can contain lines with ">", so the opening tag ends at the first line that ends with ">"
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
