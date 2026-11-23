import { DiscordEmbed } from '@book000/node-utils'
import { ChangeLogItem } from './change-log'

const TITLE_LIMIT = 256
const DESCRIPTION_LIMIT = 4096
const FIELD_VALUE_LIMIT = 1024
const CODE_PREFIX = '```markdown\n'
const CODE_SUFFIX = '\n```'
const CODE_OVERHEAD = CODE_PREFIX.length + CODE_SUFFIX.length

/** Splits text by UTF-16 length without separating a surrogate pair. */
function splitText(text: string, limit: number): string[] {
  const chunks: string[] = []
  let chunk = ''
  for (const character of text) {
    if (chunk.length + character.length > limit) {
      chunks.push(chunk)
      chunk = ''
    }
    chunk += character
  }
  chunks.push(chunk)
  return chunks
}

/** Wraps text in the Markdown code fence used by notifications. */
function codeBlock(text: string): string {
  return CODE_PREFIX + text + CODE_SUFFIX
}

/**
 * Builds one embed per message, preserving body and translation text across parts.
 * One description and one field keep each message below the 6000-character total.
 * Long titles use an ellipsis; every part links to the complete original entry.
 */
export function buildChangeLogEmbeds(
  item: ChangeLogItem,
  translatedTitle: string | null,
  translatedText: string | null
): DiscordEmbed[] {
  const title =
    item.title.length > TITLE_LIMIT
      ? splitText(item.title, TITLE_LIMIT - 1)[0] + '…'
      : item.title
  const descriptions = splitText(
    item.text,
    DESCRIPTION_LIMIT - CODE_OVERHEAD
  ).map((text) => codeBlock(text))
  if (translatedTitle) {
    if (
      translatedTitle.length + 2 + descriptions[0].length <=
      DESCRIPTION_LIMIT
    ) {
      descriptions[0] = translatedTitle + '\n\n' + descriptions[0]
    } else {
      descriptions.unshift(...splitText(translatedTitle, DESCRIPTION_LIMIT))
    }
  }
  const translations = translatedText
    ? splitText(translatedText, FIELD_VALUE_LIMIT - CODE_OVERHEAD).map((text) =>
        codeBlock(text)
      )
    : []
  const timestamp = item.date?.toISOString() ?? new Date().toISOString()

  return Array.from(
    { length: Math.max(descriptions.length, translations.length) },
    (_, index) => ({
      title,
      url: item.url,
      timestamp,
      description: descriptions[index],
      fields:
        index < translations.length
          ? [{ name: 'Translated', value: translations[index] }]
          : undefined,
    })
  )
}
