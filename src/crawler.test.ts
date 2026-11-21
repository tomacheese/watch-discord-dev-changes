import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import timers from 'node:timers/promises'
import { Discord, Logger } from '@book000/node-utils'
import { Configuration } from './config'
import { Crawler } from './crawler'
import { Utils } from './utils'

jest.mock('@book000/node-utils', () => ({
  ...jest.requireActual<typeof import('@book000/node-utils')>(
    '@book000/node-utils'
  ),
  Discord: jest.fn(),
}))

const fixture = fs.readFileSync(
  path.resolve('src', '__fixtures__', 'change-log.mdx'),
  'utf8'
)

const TITLE_OAUTH2 = 'OAuth2 Authorization Responses Now Include `iss`'
const TITLE_EMBEDS = 'Component Embeds and Link Preview Docs'
const TITLE_UNPARSABLE = 'Entry With Unparsable Date'
const TITLE_EXPRESSIONS =
  'Guild Expressions and Events Permissions now available to developers'
const TITLE_SDK = 'Discord Social SDK Release 1.7.13024'
const TITLE_ATTACHMENT = 'Per-Attachment File Upload Behavior for Apps'

const DAY_MS = 24 * 60 * 60 * 1000

/** The parts of a sent Discord embed that the tests inspect */
interface SentEmbed {
  title: string
  url: string
  timestamp: string
  description: string
  fields?: { name: string; value: string }[]
}

/** The parts of a message passed to `Discord.sendMessage` that the tests inspect */
interface SentMessage {
  embeds: SentEmbed[]
}

/**
 * Creates a minimal configuration stub.
 *
 * @param discord The `discord` setting
 * @returns A stub usable as `Configuration`
 */
function createConfig(discord: Record<string, string>): Configuration {
  return {
    get: (key: string) => (key === 'discord' ? discord : undefined),
  } as unknown as Configuration
}

describe('Crawler.run', () => {
  let tmpDir: string
  let notifiedPath: string
  let sendMessage: jest.Mock<Promise<undefined>, [SentMessage]>
  let fetchMock: jest.SpyInstance
  let infoLog: jest.SpyInstance
  let errorLog: jest.SpyInstance
  const validConfig = createConfig({
    webhookUrl: 'https://example.invalid/webhook',
  })

  /**
   * Reads the contents of the notified file.
   *
   * @returns The array of notified IDs
   */
  function readNotified(): string[] {
    return JSON.parse(fs.readFileSync(notifiedPath, 'utf8')) as string[]
  }

  /**
   * Returns the embed titles of the sent messages, in send order.
   *
   * @returns The array of embed titles
   */
  function sentTitles(): string[] {
    return sendMessage.mock.calls.map((call) => call[0].embeds[0].title)
  }

  /**
   * Replaces the Response returned by `fetch`.
   *
   * @param body The response body
   * @param status The HTTP status
   */
  function mockResponse(body: string, status = 200): void {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(body, { status }))
    )
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-test-'))
    notifiedPath = path.join(tmpDir, 'notified.json')
    process.env.NOTIFIED_PATH = notifiedPath

    sendMessage = jest.fn<Promise<undefined>, [SentMessage]>()
    sendMessage.mockResolvedValue(undefined)
    ;(Discord as unknown as jest.Mock).mockImplementation(() => ({
      sendMessage,
    }))
    fetchMock = jest.spyOn(globalThis, 'fetch')
    mockResponse(fixture)
    infoLog = jest.spyOn(Logger.prototype, 'info').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 20))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    delete process.env.NOTIFIED_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('fetches the MDX on the main branch', async () => {
    await new Crawler(validConfig).run()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/discord/discord-api-docs/main/developers/change-log.mdx'
    )
  })

  it('neither sends nor records anything when the fetch returns 404', async () => {
    mockResponse('404: Not Found', 404)

    await new Crawler(validConfig).run()

    expect(errorLog).toHaveBeenCalledWith('❌ Failed to fetch changelog: 404')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('neither sends nor records anything when the body has no update', async () => {
    mockResponse('# Change Log\n\nThe structure has changed.\n')

    await new Crawler(validConfig).run()

    expect(errorLog).toHaveBeenCalledWith('❌ No changelog entries found')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('sends only the recent and undated items and records every item', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
    expect(readNotified()).toEqual([
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
    ])
  })

  it('builds the embed from the item', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    const embed = sendMessage.mock.calls[0][0].embeds[0]
    expect(embed.title).toBe(TITLE_OAUTH2)
    expect(embed.url).toBe(
      'https://docs.discord.com/developers/change-log#october-14-2026'
    )
    expect(embed.timestamp).toBe(new Date(2026, 9, 14).toISOString())
    expect(
      embed.description.startsWith('```markdown\nOAuth2 authorization')
    ).toBe(true)
  })

  it('records the outdated items without sending them and logs their titles', async () => {
    fs.writeFileSync(notifiedPath, '[]')

    await new Crawler(validConfig).run()

    expect(infoLog).toHaveBeenCalledWith(
      `📦 Recording 3 outdated item(s) without notification: ${TITLE_EXPRESSIONS}, ${TITLE_SDK}, ${TITLE_ATTACHMENT}`
    )
    expect(sentTitles()).not.toContain(TITLE_EXPRESSIONS)
    expect(sentTitles()).not.toContain(TITLE_SDK)
    expect(sentTitles()).not.toContain(TITLE_ATTACHMENT)
  })

  it('sends an item that is exactly 30 days old', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    jest.setSystemTime(new Date(2026, 9, 5).getTime() + 30 * DAY_MS)

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
  })

  it('does not send an item that is older than 30 days by one second', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    jest.setSystemTime(new Date(2026, 9, 5).getTime() + 30 * DAY_MS + 1000)

    await new Crawler(validConfig).run()

    expect(sentTitles()).toEqual([TITLE_OAUTH2, TITLE_UNPARSABLE])
    expect(readNotified()).toContain(TITLE_EMBEDS)
  })

  it('records every item without sending on the first run', async () => {
    await new Crawler(validConfig).run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(readNotified()).toEqual([
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
    ])
  })

  it('does not notify or duplicate an item that is already notified by title', async () => {
    fs.writeFileSync(
      notifiedPath,
      JSON.stringify([TITLE_OAUTH2, TITLE_EMBEDS, TITLE_UNPARSABLE])
    )

    await new Crawler(validConfig).run()

    expect(sendMessage).not.toHaveBeenCalled()
    expect(readNotified()).toEqual([
      TITLE_OAUTH2,
      TITLE_EMBEDS,
      TITLE_UNPARSABLE,
      TITLE_EXPRESSIONS,
      TITLE_SDK,
      TITLE_ATTACHMENT,
    ])
  })

  it('logs that there is nothing new when every item is notified', async () => {
    fs.writeFileSync(
      notifiedPath,
      JSON.stringify([
        TITLE_OAUTH2,
        TITLE_EMBEDS,
        TITLE_UNPARSABLE,
        TITLE_EXPRESSIONS,
        TITLE_SDK,
        TITLE_ATTACHMENT,
      ])
    )

    await new Crawler(validConfig).run()

    expect(infoLog).toHaveBeenCalledWith('✅ No new items')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('records nothing when the Discord configuration is invalid', async () => {
    await new Crawler(createConfig({})).run()

    expect(errorLog).toHaveBeenCalledWith('❌ Discord configuration is invalid')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(fs.existsSync(notifiedPath)).toBe(false)
  })

  it('does not record an item whose send fails', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    sendMessage.mockRejectedValueOnce(new Error('send failed'))

    await expect(new Crawler(validConfig).run()).resolves.toBeUndefined()

    expect(readNotified()).not.toContain(TITLE_OAUTH2)
    expect(readNotified()).toContain(TITLE_EMBEDS)
    expect(errorLog).toHaveBeenCalledWith(
      `❌ Failed to send changelog entry: ${TITLE_OAUTH2}`
    )
  })

  it.each([0, 1])(
    'continues hourly polling after a failure in cycle %i',
    async (cycle) => {
      fs.writeFileSync(notifiedPath, '[]')
      const interval = jest
        .spyOn(timers, 'setInterval')
        .mockImplementation(async function* (): AsyncGenerator<
          null,
          undefined
        > {
          await jest.advanceTimersByTimeAsync(3_600_000)
          yield null
          await jest.advanceTimersByTimeAsync(3_600_000)
          yield null
          return undefined
        })
      mockResponse(
        '<Update label="October 14, 2026">\n## Entry\nBody\n</Update>'
      )
      if (cycle === 1) {
        fetchMock
          .mockImplementationOnce(() => Promise.resolve(new Response('')))
          .mockImplementation(() =>
            Promise.resolve(
              new Response(
                '<Update label="October 14, 2026">\n## Entry\nBody\n</Update>'
              )
            )
          )
      }
      sendMessage.mockRejectedValueOnce(
        new Error('Discord API returned 503: {}')
      )

      await new Crawler(validConfig).start()

      expect(interval).toHaveBeenCalledWith(3_600_000, null, expect.any(Object))
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(sendMessage).toHaveBeenCalledTimes(2)
      expect(readNotified()).toEqual(['Entry'])
    }
  )

  it('waits for fractional retry_after seconds and retries the same part', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    const wait = Promise.withResolvers<undefined>()
    const delay = jest.spyOn(timers, 'setTimeout').mockReturnValue(wait.promise)
    sendMessage.mockRejectedValueOnce(
      new Error('Discord API returned 429: {"retry_after":1.25,"global":true}')
    )

    const running = new Crawler(validConfig).run()
    await jest.advanceTimersByTimeAsync(0)

    expect(delay).toHaveBeenCalledWith(1250, undefined, expect.any(Object))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(readNotified()).not.toContain(TITLE_OAUTH2)
    wait.resolve(undefined)
    await running

    expect(sendMessage.mock.calls[0]).toEqual(sendMessage.mock.calls[1])
    expect(readNotified()).toContain(TITLE_OAUTH2)
  })

  it.each(['webhook', 'bot'])(
    'retries the actual node-utils %s HTTP 429 error without real network requests',
    async (mode) => {
      fs.writeFileSync(notifiedPath, '[]')
      const { Discord: ActualDiscord } = jest.requireActual<
        typeof import('@book000/node-utils')
      >('@book000/node-utils')
      ;(Discord as unknown as jest.Mock).mockImplementation(
        (options: ConstructorParameters<typeof ActualDiscord>[0]) =>
          new ActualDiscord(options)
      )
      const delay = jest
        .spyOn(timers, 'setTimeout')
        .mockResolvedValue(undefined)
      const body =
        '<Update label="October 14, 2026">\n## Entry\nBody\n</Update>'
      fetchMock
        .mockResolvedValueOnce(new Response(body))
        .mockResolvedValueOnce(
          Response.json({ retry_after: 0.25 }, { status: 429 })
        )
        .mockResolvedValueOnce(Response.json({ id: 'message-id' }))
      const config =
        mode === 'webhook'
          ? validConfig
          : createConfig({
              token: 'test-token',
              channelId: 'test-channel',
            })

      await new Crawler(config).run()

      expect(delay).toHaveBeenCalledWith(250, undefined, expect.any(Object))
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(readNotified()).toEqual(['Entry'])
    }
  )

  it('bounds retries and retries an exhausted entry on the next poll', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    const delay = jest.spyOn(timers, 'setTimeout').mockResolvedValue(undefined)
    const error = new Error('Discord API returned 429: {"retry_after":2}')
    sendMessage
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
    const crawler = new Crawler(validConfig)

    await crawler.run()
    expect(delay).toHaveBeenCalledTimes(2)
    expect(readNotified()).not.toContain(TITLE_OAUTH2)
    expect(readNotified()).toContain(TITLE_EMBEDS)

    await crawler.run()
    expect(readNotified()).toContain(TITLE_OAUTH2)
  })

  it.each([
    'Discord API returned 400: {}',
    'Discord API returned 429: invalid JSON',
    'Discord API returned 429: null',
    'Discord API returned 429: {}',
    'Discord API returned 429: {"retry_after":"2"}',
    'Discord API returned 429: {"retry_after":-1}',
    'Discord API returned 429: {"retry_after":1e999}',
    'Discord API returned 429: {"retry_after":2147484}',
  ])(
    'defers an unretryable error without a tight loop: %s',
    async (message) => {
      fs.writeFileSync(notifiedPath, '[]')
      const delay = jest
        .spyOn(timers, 'setTimeout')
        .mockResolvedValue(undefined)
      sendMessage.mockRejectedValueOnce(new Error(message))

      await new Crawler(validConfig).run()

      expect(delay).not.toHaveBeenCalled()
      expect(readNotified()).not.toContain(TITLE_OAUTH2)
    }
  )

  it('stops during a rate-limit wait without recording the entry', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    const crawler = new Crawler(validConfig)
    jest.spyOn(timers, 'setTimeout').mockImplementation(() => {
      crawler.stop()
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    })
    sendMessage.mockRejectedValueOnce(
      new Error('Discord API returned 429: {"retry_after":10}')
    )

    await crawler.start()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(readNotified()).not.toContain(TITLE_OAUTH2)
  })

  it('keeps a multipart entry pending until all original and translated parts succeed', async () => {
    fs.writeFileSync(notifiedPath, '[]')
    mockResponse(
      '<Update label="October 14, 2026">\n## Entry\n' +
        'x'.repeat(9000) +
        '\n</Update>'
    )
    const config = {
      get: (key: string) =>
        key === 'discord'
          ? { webhookUrl: 'https://example.invalid/webhook' }
          : { gasUrl: 'https://example.invalid/translate' },
    } as unknown as Configuration
    jest
      .spyOn(Utils, 'translate')
      .mockImplementation((_, text) =>
        Promise.resolve(
          text === 'Entry' ? 'Translated title' : 't'.repeat(3000)
        )
      )
    sendMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    const crawler = new Crawler(config)

    await crawler.run()
    expect(readNotified()).toEqual([])
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage.mock.calls[0][0].embeds[0].description).toBe(
      'Translated title'
    )

    sendMessage.mockImplementation(() => {
      expect(readNotified()).toEqual([])
      return Promise.resolve(undefined)
    })
    await crawler.run()
    expect(readNotified()).toEqual(['Entry'])
    expect(sendMessage).toHaveBeenCalledTimes(6)
    for (const [message] of sendMessage.mock.calls) {
      expect(message.embeds).toHaveLength(1)
      const embed = message.embeds[0]
      expect(embed.description.length).toBeLessThanOrEqual(4096)
      expect(embed.fields?.[0].value.length ?? 0).toBeLessThanOrEqual(1024)
    }
  })
})
