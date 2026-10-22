import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@book000/node-utils'
import { parseChangeLog } from './change-log'

const fixture = fs.readFileSync(
  path.resolve('src', '__fixtures__', 'change-log.mdx'),
  'utf8'
)

/**
 * 日付を年月日の文字列にする。
 *
 * @param date 対象の日付
 * @returns `YYYY-M-D` 形式の文字列。null の場合は null
 */
function toYmd(date: Date | null): string | null {
  return date
    ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    : null
}

describe('parseChangeLog', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the items in order of appearance', () => {
    const items = parseChangeLog(fixture)

    expect(
      items.map((item) => [item.title, toYmd(item.date), item.url])
    ).toEqual([
      [
        'OAuth2 Authorization Responses Now Include `iss`',
        '2026-10-14',
        'https://docs.discord.com/developers/change-log#october-14-2026',
      ],
      [
        'Component Embeds and Link Preview Docs',
        '2026-10-5',
        'https://docs.discord.com/developers/change-log#october-5-2026',
      ],
      [
        'Entry With Unparsable Date',
        null,
        'https://docs.discord.com/developers/change-log#someday-soon',
      ],
      [
        'Guild Expressions and Events Permissions now available to developers',
        '2025-11-20',
        'https://docs.discord.com/developers/change-log#november-20-2025',
      ],
      [
        'Discord Social SDK Release 1.7.13024',
        '2025-11-20',
        'https://docs.discord.com/developers/change-log#november-20-2025',
      ],
      [
        'Per-Attachment File Upload Behavior for Apps',
        '2025-4-3',
        'https://docs.discord.com/developers/change-log#april-03-2025',
      ],
    ])
  })

  it('uses the title as the id', () => {
    const items = parseChangeLog(fixture)

    expect(items.map((item) => item.id)).toEqual(
      items.map((item) => item.title)
    )
  })

  it('removes the common indent of 4 spaces from the text', () => {
    const items = parseChangeLog(fixture)

    expect(items[0].text).toBe(
      [
        'OAuth2 authorization responses that redirect to your `redirect_uri` now include an `iss` parameter set to `https://discord.com`, following [RFC 9207](https://www.rfc-editor.org/info/rfc9207). Our [authorization server metadata](https://discord.com/.well-known/oauth-authorization-server) and [OpenID configuration](https://discord.com/.well-known/openid-configuration) now also set `authorization_response_iss_parameter_supported` to `true`.',
        '',
        '#### Developer Resources',
        '- [Issuer Identification](/developers/topics/oauth2#issuer-identification)',
      ].join('\n')
    )
  })

  it('removes the common indent of 2 spaces from the text', () => {
    const items = parseChangeLog(fixture)

    expect(items[1].text.split('\n').slice(-4)).toEqual([
      '#### Developer Resources',
      '- [Link Previews](/developers/link-previews/overview)',
      '- [Component Embeds](/developers/link-previews/component-embeds)',
      '- [Embed Types](/developers/resources/message#embed-object-embed-types)',
    ])
    expect(items[1].text.split('\n', 1)[0]).toBe(
      "Websites can now customize how their links look when shared on Discord. Add a `discord:component-embed` JSON payload to your page and Discord renders the link preview using a [Components V2](/developers/components/reference) layout instead of the default preview. Component embeds are display-only, so nothing sends an interaction, and you don't need an app or a bot to use them."
    )
  })

  it('keeps the text as is when there is no indent', () => {
    const items = parseChangeLog(fixture)

    expect(items[3].text.split('\n').slice(-3)).toEqual([
      '- The `CREATE_EVENTS` permission (`1 << 44`) was created in July 2023 and split from `MANAGE_EVENTS` for users in December 2023.',
      '- As of today, bots now have access to the `CREATE_EVENTS` permission.',
      '- Starting on February 23, 2026, bots will need the `CREATE_EVENTS` permission to create scheduled events. `MANAGE_EVENTS` alone will no longer be sufficient.',
    ])
  })

  it('treats the first h2 as the title and keeps later h2 in the text', () => {
    const items = parseChangeLog(fixture)

    expect(items[4].title).toBe('Discord Social SDK Release 1.7.13024')
    expect(items[4].text).toBe(
      [
        'A new release of the Discord Social SDK is now available, with the following updates:',
        '',
        '## Windows',
        '',
        '- Fixed default audio device selection to once again prefer the default system audio device instead of the default communications device.',
        '',
        '## Xbox',
        '',
        '- Added support for GDK 240605 to the build.',
      ].join('\n')
    )
  })

  it('parses a zero-padded label', () => {
    const items = parseChangeLog(fixture)

    expect(toYmd(items[5].date)).toBe('2025-4-3')
  })

  it('returns a null date for a label that is not a date', () => {
    const items = parseChangeLog(fixture)

    expect(items[2].date).toBeNull()
    expect(items[2].text).toBe('The label is not a date.')
  })

  it('does not leak frontmatter, imports and trailing link references', () => {
    const items = parseChangeLog(fixture)

    const last = items.at(-1)
    expect(
      last?.text.endsWith(
        '[our documentation on file uploads](/developers/reference#uploading-files).'
      )
    ).toBe(true)
    for (const item of items) {
      expect(item.text).not.toContain(
        "import {Route} from '/snippets/route.jsx'"
      )
      expect(item.text).not.toContain('Autogenerated Reference Links')
      expect(item.text).not.toContain('[`Activity::AddButton`]')
    }
  })

  it('skips an update without a title heading and logs a warning', () => {
    const items = parseChangeLog(fixture)

    expect(items.map((item) => item.title)).not.toContain(
      'This entry has no title heading.'
    )
    expect(items).toHaveLength(6)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '❌ Skipped update without title heading: "October 1, 2026"'
    )
  })

  it('skips an update with an empty label and logs a warning', () => {
    const items = parseChangeLog(
      [
        '<Update label="" tags={["Docs"]}>',
        '  ## Title',
        '  Body',
        '</Update>',
      ].join('\n')
    )

    expect(items).toEqual([])
    expect(warn).toHaveBeenCalledWith('❌ Skipped update with empty label')
  })

  it('does not stop at a ">" inside the rss description', () => {
    const items = parseChangeLog(
      [
        '<Update label="August 13, 2024" tags={["Voice"]} rss={{',
        '    title: "Voice",',
        '    description: "Old versions (> 7 years ago)."',
        '}}>',
        '',
        '    ## Voice Gateway Version 8',
        '',
        '    Body text',
        '</Update>',
      ].join('\n')
    )

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Voice Gateway Version 8')
    expect(items[0].text).toBe('Body text')
  })

  it('stops at an update without a closing tag and logs a warning', () => {
    const items = parseChangeLog(
      [
        '<Update label="August 13, 2024" tags={["Voice"]}>',
        '  ## Complete',
        '  Body',
        '</Update>',
        '<Update label="August 14, 2024" tags={["Voice"]}>',
        '  ## Unclosed',
        '  Body',
      ].join('\n')
    )

    expect(items.map((item) => item.title)).toEqual(['Complete'])
    expect(warn).toHaveBeenCalledWith(
      '❌ Skipped update without closing tag: "August 14, 2024"'
    )
  })

  it('returns an empty array when there is no update', () => {
    expect(parseChangeLog('# Change Log\n\nNo updates here.\n')).toEqual([])
  })

  it('parses CRLF line endings', () => {
    const items = parseChangeLog(
      [
        '<Update label="August 13, 2024" tags={["Voice"]}>',
        '  ## Title',
        '  Body',
        '</Update>',
      ].join('\r\n')
    )

    expect(items.map((item) => [item.title, item.text])).toEqual([
      ['Title', 'Body'],
    ])
  })
})
