import { DiscordEmbed } from '@book000/node-utils'
import { ChangeLogItem } from './change-log'
import { buildChangeLogEmbeds } from './embeds'

const item: ChangeLogItem = {
  id: 'Entry',
  title: 'Entry',
  url: 'https://docs.discord.com/developers/change-log#october-14-2026',
  date: new Date('2026-10-14T00:00:00Z'),
  text: 'Original',
}

/** Checks all populated text limits for a message containing a single embed. */
function expectValid(embed: DiscordEmbed): void {
  expect(embed.title?.length ?? 0).toBeLessThanOrEqual(256)
  expect(embed.description?.length ?? 0).toBeLessThanOrEqual(4096)
  expect(embed.fields?.length ?? 0).toBeLessThanOrEqual(25)
  let total = (embed.title?.length ?? 0) + (embed.description?.length ?? 0)
  const fields = embed.fields ?? []
  for (const field of fields) {
    expect(field.name.length).toBeLessThanOrEqual(256)
    expect(field.value.length).toBeLessThanOrEqual(1024)
    total += field.name.length + field.value.length
  }
  expect(total).toBeLessThanOrEqual(6000)
  expect(embed.url).toBe(item.url)
}

/** Removes the notification's code fence so text can be reconstructed. */
function unfence(text: string): string {
  expect(text.startsWith('```markdown\n')).toBe(true)
  expect(text.endsWith('\n```')).toBe(true)
  return text.slice(12, -4)
}

describe('buildChangeLogEmbeds', () => {
  it('preserves the existing format for a short translated entry', () => {
    expect(
      buildChangeLogEmbeds(item, 'Title translation', 'Body translation')
    ).toEqual([
      {
        title: item.title,
        url: item.url,
        timestamp: item.date?.toISOString(),
        description: 'Title translation\n\n```markdown\nOriginal\n```',
        fields: [
          { name: 'Translated', value: '```markdown\nBody translation\n```' },
        ],
      },
    ])
  })

  it.each([4079, 4080, 4081, 4096, 12_000])(
    'preserves all %i original characters with bounded, complete fences',
    (length) => {
      const text = 'x'.repeat(length)
      const embeds = buildChangeLogEmbeds({ ...item, text }, null, null)

      expect(
        embeds.map((embed) => unfence(embed.description ?? '')).join('')
      ).toBe(text)
      expect(embeds).toHaveLength(Math.ceil(length / 4080))
      for (const embed of embeds) {
        expectValid(embed)
      }
    }
  )

  it.each([1007, 1008, 1009, 1024, 8000])(
    'preserves all %i translated characters within field limits',
    (length) => {
      const translation = 't'.repeat(length)
      const embeds = buildChangeLogEmbeds(item, null, translation)

      expect(
        embeds.map((embed) => unfence(embed.fields?.[0].value ?? '')).join('')
      ).toBe(translation)
      expect(embeds).toHaveLength(Math.ceil(length / 1008))
      for (const embed of embeds) {
        expectValid(embed)
      }
    }
  )

  it.each([255, 256, 257])(
    'bounds a %i-character title with an ellipsis',
    (length) => {
      const title = 'T'.repeat(length)
      const [embed] = buildChangeLogEmbeds({ ...item, title }, null, null)

      expect(embed.title).toBe(length > 256 ? 'T'.repeat(255) + '…' : title)
      expectValid(embed)
    }
  )

  it('counts the translated title and separator at the description boundary', () => {
    const text = 'x'.repeat(4000)
    const [embed] = buildChangeLogEmbeds(
      { ...item, text },
      't'.repeat(78),
      null
    )
    expect(embed.description).toHaveLength(4096)
    expectValid(embed)

    const oversized = buildChangeLogEmbeds(
      { ...item, text },
      't'.repeat(79),
      null
    )
    expect(oversized).toHaveLength(2)
    expect(oversized[0].description).toBe('t'.repeat(79))
    expect(unfence(oversized[1].description ?? '')).toBe(text)
    for (const embed of oversized) {
      expectValid(embed)
    }
  })

  it('preserves a translated title longer than a description and bounds the total', () => {
    const titleTranslation = 't'.repeat(9000)
    const text = 'x'.repeat(9000)
    const translation = 'y'.repeat(9000)
    const embeds = buildChangeLogEmbeds(
      { ...item, title: 'T'.repeat(256), text },
      titleTranslation,
      translation
    )
    expect(
      embeds
        .slice(0, 3)
        .map((embed) => embed.description)
        .join('')
    ).toBe(titleTranslation)
    expect(
      embeds
        .slice(3, 6)
        .map((embed) => unfence(embed.description ?? ''))
        .join('')
    ).toBe(text)
    expect(
      embeds.map((embed) => unfence(embed.fields?.[0].value ?? '')).join('')
    ).toBe(translation)
    for (const embed of embeds) {
      expectValid(embed)
    }
  })

  it('keeps surrogate pairs intact at all splitting and truncation boundaries', () => {
    const text = 'x'.repeat(4079) + '😀'.repeat(3000)
    const translation = 't'.repeat(1007) + '😀'.repeat(1000)
    const embeds = buildChangeLogEmbeds(
      { ...item, title: 'T'.repeat(254) + '😀😀', text },
      '😀'.repeat(3000),
      translation
    )
    expect(embeds[0].title).toBe('T'.repeat(254) + '…')
    for (const embed of embeds) {
      expectValid(embed)
      expect(embed.title?.isWellFormed()).toBe(true)
      expect(embed.description?.isWellFormed() ?? true).toBe(true)
      expect(embed.fields?.[0].value.isWellFormed() ?? true).toBe(true)
    }
    expect(
      embeds
        .filter((embed) => embed.description?.startsWith('```markdown\n'))
        .map((embed) => unfence(embed.description ?? ''))
        .join('')
    ).toBe(text)
    expect(
      embeds
        .flatMap((embed) => embed.fields ?? [])
        .map((field) => unfence(field.value))
        .join('')
    ).toBe(translation)
  })

  it('supports an empty body without translation and an undated entry', () => {
    const [embed] = buildChangeLogEmbeds(
      { ...item, text: '', date: null },
      null,
      null
    )
    expect(unfence(embed.description ?? '')).toBe('')
    expect(Number.isNaN(Date.parse(embed.timestamp ?? ''))).toBe(false)
    expectValid(embed)
  })
})
